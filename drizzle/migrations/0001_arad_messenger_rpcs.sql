-- Start or reuse a 1:1 conversation
create or replace function public.start_private_conversation(_other_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid();
declare _conv uuid;
begin
  if _me is null then raise exception 'not authenticated'; end if;
  if _other_user = _me then raise exception 'cannot chat with yourself'; end if;
  if not exists (select 1 from public.profiles where id = _other_user) then
    raise exception 'user not found';
  end if;

  select c.id into _conv
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = _me
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = _other_user
  where c.kind = 'private'
  limit 1;

  if _conv is not null then return _conv; end if;

  insert into public.conversations (kind, created_by) values ('private', _me) returning id into _conv;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (_conv, _me, 'member'), (_conv, _other_user, 'member');
  return _conv;
end;
$$;
grant execute on function public.start_private_conversation(uuid) to authenticated;

-- Create a group or channel with the creator as owner
create or replace function public.create_group_conversation(
  _kind public.conversation_kind, _title text, _bio text, _member_ids uuid[]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid();
declare _conv uuid;
declare _member uuid;
begin
  if _me is null then raise exception 'not authenticated'; end if;
  if _kind = 'private' then raise exception 'use start_private_conversation'; end if;
  if coalesce(btrim(_title), '') = '' then raise exception 'title required'; end if;

  insert into public.conversations (kind, title, bio, created_by, invite_code)
  values (_kind, btrim(_title), nullif(btrim(coalesce(_bio,'')), ''), _me, encode(gen_random_bytes(8), 'hex'))
  returning id into _conv;

  insert into public.conversation_members (conversation_id, user_id, role) values (_conv, _me, 'owner');

  if _member_ids is not null then
    foreach _member in array _member_ids loop
      if _member <> _me and exists (select 1 from public.profiles where id = _member) then
        insert into public.conversation_members (conversation_id, user_id, role)
        values (_conv, _member, 'member')
        on conflict do nothing;
      end if;
    end loop;
  end if;
  return _conv;
end;
$$;
grant execute on function public.create_group_conversation(public.conversation_kind, text, text, uuid[]) to authenticated;

-- Join via invite code
create or replace function public.join_conversation_by_invite(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid();
declare _conv uuid;
begin
  if _me is null then raise exception 'not authenticated'; end if;
  select id into _conv from public.conversations where invite_code = btrim(_code);
  if _conv is null then raise exception 'invalid invite'; end if;
  if exists (select 1 from public.conversation_bans where conversation_id = _conv and user_id = _me) then
    raise exception 'banned from conversation';
  end if;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (_conv, _me, 'member') on conflict do nothing;
  return _conv;
end;
$$;
grant execute on function public.join_conversation_by_invite(text) to authenticated;

-- Rotate a group invite code (admins only)
create or replace function public.rotate_invite_code(_conversation_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _code text;
begin
  if not public.is_conversation_admin(_conversation_id, auth.uid()) then
    raise exception 'not permitted';
  end if;
  _code := encode(gen_random_bytes(8), 'hex');
  update public.conversations set invite_code = _code where id = _conversation_id;
  return _code;
end;
$$;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- Ban + remove in one step (admins only)
create or replace function public.ban_conversation_member(_conversation_id uuid, _user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_conversation_admin(_conversation_id, auth.uid()) then
    raise exception 'not permitted';
  end if;
  if public.conversation_role(_conversation_id, _user_id) = 'owner' then
    raise exception 'cannot ban the owner';
  end if;
  delete from public.conversation_members where conversation_id = _conversation_id and user_id = _user_id;
  insert into public.conversation_bans (conversation_id, user_id, banned_by)
  values (_conversation_id, _user_id, auth.uid()) on conflict do nothing;
end;
$$;
grant execute on function public.ban_conversation_member(uuid, uuid) to authenticated;

-- Unread counts for the signed-in user
create or replace function public.unread_counts()
returns table (conversation_id uuid, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.conversation_id, count(msg.id)
  from public.conversation_members m
  left join public.messages msg
    on msg.conversation_id = m.conversation_id
   and msg.created_at > m.last_read_at
   and msg.sender_id <> m.user_id
   and msg.deleted_at is null
  where m.user_id = auth.uid()
  group by m.conversation_id;
$$;
grant execute on function public.unread_counts() to authenticated;