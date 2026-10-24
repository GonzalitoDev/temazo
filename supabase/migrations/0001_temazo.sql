-- Temazo: clon de Spotify sobre el catálogo de Audius. En Supabase va solo lo del usuario.
-- Prefijo temazo_ para convivir con otras apps. Sin triggers en auth.users.

create table public.temazo_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{2,32}$'),
  display_name text not null check (length(display_name) between 1 and 40),
  color text not null default '#1fb27a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  share_activity boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.temazo_likes (
  user_id uuid not null references public.temazo_profiles(id) on delete cascade,
  track_id text not null check (length(track_id) between 1 and 32),
  track jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index on public.temazo_likes (user_id, created_at desc);

create table public.temazo_playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.temazo_profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 300),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.temazo_playlists (owner_id, updated_at desc);

create table public.temazo_playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.temazo_playlists(id) on delete cascade,
  track_id text not null check (length(track_id) between 1 and 32),
  track jsonb not null,
  position double precision not null,
  added_at timestamptz not null default now()
);
create index on public.temazo_playlist_tracks (playlist_id, position);

create table public.temazo_follow_artists (
  user_id uuid not null references public.temazo_profiles(id) on delete cascade,
  artist_id text not null check (length(artist_id) between 1 and 32),
  artist jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table public.temazo_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.temazo_profiles(id) on delete cascade,
  track_id text not null,
  track jsonb not null,
  played_at timestamptz not null default now()
);
create index on public.temazo_history (user_id, played_at desc);

create table public.temazo_friends (
  follower_id uuid not null references public.temazo_profiles(id) on delete cascade,
  followee_id uuid not null references public.temazo_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index on public.temazo_friends (followee_id);

create table public.temazo_now_playing (
  user_id uuid primary key references public.temazo_profiles(id) on delete cascade,
  track jsonb not null,
  is_playing boolean not null default true,
  updated_at timestamptz not null default now()
);

-- los jsonb de temas tienen un tamaño razonable
alter table public.temazo_likes add constraint track_small check (pg_column_size(track) < 4096);
alter table public.temazo_playlist_tracks add constraint track_small check (pg_column_size(track) < 4096);
alter table public.temazo_history add constraint track_small check (pg_column_size(track) < 4096);
alter table public.temazo_now_playing add constraint track_small check (pg_column_size(track) < 4096);
alter table public.temazo_follow_artists add constraint artist_small check (pg_column_size(artist) < 4096);

-- ---------- helpers ----------

create or replace function public.temazo_follows(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.temazo_friends f where f.follower_id = auth.uid() and f.followee_id = p_user);
$$;

create or replace function public.temazo_owns_playlist(p_playlist uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.temazo_playlists p where p.id = p_playlist and p.owner_id = auth.uid());
$$;

create or replace function public.temazo_can_see_playlist(p_playlist uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.temazo_playlists p where p.id = p_playlist and (p.owner_id = auth.uid() or p.is_public));
$$;

-- el historial guarda los últimos 200 por usuario
create or replace function public.temazo_trim_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.temazo_history h
  where h.user_id = new.user_id
    and h.id < (select min(id) from (select id from public.temazo_history where user_id = new.user_id order by id desc limit 200) t);
  return null;
end $$;
create trigger temazo_trim_history after insert on public.temazo_history
  for each row execute function public.temazo_trim_history();

-- updated_at de la playlist cuando cambian sus temas
create or replace function public.temazo_touch_playlist()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.temazo_playlists set updated_at = now() where id = coalesce(new.playlist_id, old.playlist_id);
  return null;
end $$;
create trigger temazo_touch_playlist after insert or update or delete on public.temazo_playlist_tracks
  for each row execute function public.temazo_touch_playlist();

-- ---------- RLS ----------

alter table public.temazo_profiles enable row level security;
alter table public.temazo_likes enable row level security;
alter table public.temazo_playlists enable row level security;
alter table public.temazo_playlist_tracks enable row level security;
alter table public.temazo_follow_artists enable row level security;
alter table public.temazo_history enable row level security;
alter table public.temazo_friends enable row level security;
alter table public.temazo_now_playing enable row level security;

create policy temazo_profiles_select on public.temazo_profiles for select to authenticated using (true);
create policy temazo_profiles_insert on public.temazo_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy temazo_profiles_update on public.temazo_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy temazo_likes_all on public.temazo_likes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy temazo_follow_artists_all on public.temazo_follow_artists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy temazo_history_select on public.temazo_history for select to authenticated using (user_id = (select auth.uid()));
create policy temazo_history_insert on public.temazo_history for insert to authenticated with check (user_id = (select auth.uid()));
create policy temazo_history_delete on public.temazo_history for delete to authenticated using (user_id = (select auth.uid()));

create policy temazo_playlists_select on public.temazo_playlists for select to authenticated using (owner_id = (select auth.uid()) or is_public);
create policy temazo_playlists_insert on public.temazo_playlists for insert to authenticated with check (owner_id = (select auth.uid()));
create policy temazo_playlists_update on public.temazo_playlists for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy temazo_playlists_delete on public.temazo_playlists for delete to authenticated using (owner_id = (select auth.uid()));

create policy temazo_playlist_tracks_select on public.temazo_playlist_tracks for select to authenticated using (public.temazo_can_see_playlist(playlist_id));
create policy temazo_playlist_tracks_insert on public.temazo_playlist_tracks for insert to authenticated with check (public.temazo_owns_playlist(playlist_id));
create policy temazo_playlist_tracks_update on public.temazo_playlist_tracks for update to authenticated using (public.temazo_owns_playlist(playlist_id)) with check (public.temazo_owns_playlist(playlist_id));
create policy temazo_playlist_tracks_delete on public.temazo_playlist_tracks for delete to authenticated using (public.temazo_owns_playlist(playlist_id));

create policy temazo_friends_select on public.temazo_friends for select to authenticated using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
create policy temazo_friends_insert on public.temazo_friends for insert to authenticated with check (follower_id = (select auth.uid()));
create policy temazo_friends_delete on public.temazo_friends for delete to authenticated using (follower_id = (select auth.uid()));

-- lo que suena: lo ve el dueño y quienes lo siguen, si comparte la actividad
create policy temazo_now_playing_select on public.temazo_now_playing for select to authenticated using (
  user_id = (select auth.uid())
  or (public.temazo_follows(user_id) and exists (select 1 from public.temazo_profiles p where p.id = user_id and p.share_activity))
);
create policy temazo_now_playing_insert on public.temazo_now_playing for insert to authenticated with check (user_id = (select auth.uid()));
create policy temazo_now_playing_update on public.temazo_now_playing for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy temazo_now_playing_delete on public.temazo_now_playing for delete to authenticated using (user_id = (select auth.uid()));

revoke update on public.temazo_profiles from anon, authenticated;
grant update (display_name, color, share_activity) on public.temazo_profiles to authenticated;
revoke update on public.temazo_playlist_tracks from anon, authenticated;
grant update (position) on public.temazo_playlist_tracks to authenticated;
revoke update on public.temazo_playlists from anon, authenticated;
grant update (name, description, is_public) on public.temazo_playlists to authenticated;

revoke all on public.temazo_profiles, public.temazo_likes, public.temazo_playlists, public.temazo_playlist_tracks,
  public.temazo_follow_artists, public.temazo_history, public.temazo_friends, public.temazo_now_playing from anon;

revoke execute on function public.temazo_follows(uuid), public.temazo_owns_playlist(uuid), public.temazo_can_see_playlist(uuid) from public, anon;
grant execute on function public.temazo_follows(uuid), public.temazo_owns_playlist(uuid), public.temazo_can_see_playlist(uuid) to authenticated;
revoke execute on function public.temazo_trim_history(), public.temazo_touch_playlist() from public, anon, authenticated;

alter publication supabase_realtime add table public.temazo_now_playing;
