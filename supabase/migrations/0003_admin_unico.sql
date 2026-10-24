-- El único admin de Temazo es willirexpilowey@gmail.com.
delete from public.temazo_admins a using auth.users u where u.id = a.user_id and lower(u.email) <> 'willirexpilowey@gmail.com';
insert into public.temazo_admins (user_id) select id from auth.users where lower(email) = 'willirexpilowey@gmail.com' on conflict do nothing;
