-- Aprobación manual de cuentas para Temazo: nadie usa la app hasta que un admin lo aprueba.
-- Las cuentas siguen siendo las de Supabase Auth (compartidas con Fogón); esto solo afecta a Temazo.

create table public.temazo_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.temazo_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create index on public.temazo_access (status, requested_at desc);

alter table public.temazo_admins enable row level security;
alter table public.temazo_access enable row level security;
-- sin políticas: solo se tocan con las funciones de abajo
revoke all on public.temazo_admins, public.temazo_access from anon, authenticated;

create or replace function public.temazo_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.temazo_admins a where a.user_id = auth.uid());
$$;

create or replace function public.temazo_is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.temazo_admins a where a.user_id = auth.uid())
      or exists (select 1 from public.temazo_access x where x.user_id = auth.uid() and x.status = 'approved');
$$;

-- El usuario pide acceso (si ya lo pidió no cambia nada) y recibe su estado.
create or replace function public.temazo_my_access()
returns table (status text, is_admin boolean) language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sin sesión' using errcode = '42501'; end if;
  if not exists (select 1 from public.temazo_admins a where a.user_id = uid) then
    insert into public.temazo_access (user_id, email)
    select uid, coalesce(u.email, '') from auth.users u where u.id = uid
    on conflict (user_id) do nothing;
  end if;
  return query
    select case when exists (select 1 from public.temazo_admins a where a.user_id = uid) then 'approved'
                else (select x.status from public.temazo_access x where x.user_id = uid) end,
           exists (select 1 from public.temazo_admins a where a.user_id = uid);
end $$;

create or replace function public.temazo_admin_list()
returns table (user_id uuid, email text, status text, requested_at timestamptz, decided_at timestamptz, username text, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.temazo_is_admin() then raise exception 'Solo admins' using errcode = '42501'; end if;
  return query
    select x.user_id, x.email, x.status, x.requested_at, x.decided_at, p.username, p.display_name
    from public.temazo_access x left join public.temazo_profiles p on p.id = x.user_id
    order by (x.status = 'pending') desc, x.requested_at desc;
end $$;

create or replace function public.temazo_admin_set(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.temazo_is_admin() then raise exception 'Solo admins' using errcode = '42501'; end if;
  if p_status not in ('pending', 'approved', 'rejected') then raise exception 'Estado inválido'; end if;
  update public.temazo_access set status = p_status, decided_at = now(), decided_by = auth.uid() where user_id = p_user;
  if not found then raise exception 'No existe ese pedido'; end if;
  -- si se rechaza, deja de aparecer como "escuchando ahora"
  if p_status <> 'approved' then delete from public.temazo_now_playing where user_id = p_user; end if;
end $$;

revoke execute on function public.temazo_is_admin(), public.temazo_is_approved(), public.temazo_my_access(),
  public.temazo_admin_list(), public.temazo_admin_set(uuid, text) from public, anon;
grant execute on function public.temazo_is_admin(), public.temazo_is_approved(), public.temazo_my_access(),
  public.temazo_admin_list(), public.temazo_admin_set(uuid, text) to authenticated;

-- Candado en todas las tablas de Temazo: además de sus políticas, hay que estar aprobado.
do $$
declare t text;
begin
  foreach t in array array['temazo_profiles','temazo_likes','temazo_playlists','temazo_playlist_tracks',
                           'temazo_follow_artists','temazo_history','temazo_friends','temazo_now_playing'] loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (public.temazo_is_approved()) with check (public.temazo_is_approved())', t || '_aprobado', t);
  end loop;
end $$;

-- Admins: las dos cuentas de Gonza.
insert into public.temazo_admins (user_id) values
  ('5c155c1b-4cec-45f0-b50a-6a98d297d266'),
  ('e7809edc-8559-4df6-8d2b-1fffc7a27719')
on conflict do nothing;

-- Quienes ya usaban Temazo quedan pendientes para aprobarlos desde el panel.
insert into public.temazo_access (user_id, email)
select u.id, coalesce(u.email, '') from auth.users u
where exists (select 1 from public.temazo_profiles p where p.id = u.id)
  and not exists (select 1 from public.temazo_admins a where a.user_id = u.id)
on conflict do nothing;
