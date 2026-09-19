-- Arad Messenger core schema

-- ENUMS
create type public.conversation_kind as enum ('private','group','channel');
create type public.member_role as enum ('owner','admin','member');
create type public.message_kind as enum ('text','voice','audio','file','image','system');
create type public.call_kind as enum ('audio','video');
create type public.call_status as enum ('ringing','accepted','declined','ended','missed','failed');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'کاربر آراد',
  bio text,
  avatar_url text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- CONVERSATIONS
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  title text,
  bio text,
  avatar_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  invite_code text unique,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  muted boolean not null default false,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
grant select, insert, update, delete on public.conversation_members to authenticated;
grant all on public.conversation_members to service_role;

create table public.conversation_bans (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
grant select, insert, delete on public.conversation_bans to authenticated;
grant all on public.conversation_bans to service_role;

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind public.message_kind not null default 'text',
  body text,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  duration_ms integer,
  waveform jsonb,
  reply_to_id uuid references public.messages(id) on delete set null,
  pinned boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;

create table public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (message_id, user_id)
);
grant select, insert, delete on public.message_hides to authenticated;
grant all on public.message_hides to service_role;

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
grant select, insert, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;

-- CALLS
create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  kind public.call_kind not null default 'audio',
  status public.call_status not null default 'ringing',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz
);
grant select, insert, update on public.call_sessions to authenticated;
grant all on public.call_sessions to service_role;

create table public.call_signals (
  id bigserial primary key,
  call_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index call_signals_call_idx on public.call_signals (call_id, id);
grant select, insert on public.call_signals to authenticated;
grant all on public.call_signals to service_role;

-- SECURITY DEFINER HELPERS (avoid RLS recursion)
create or replace function public.is_conversation_member(_conversation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members m
    where m.conversation_id = _conversation_id and m.user_id = _user_id);
$$;

create or replace function public.conversation_role(_conversation_id uuid, _user_id uuid)
returns public.member_role language sql stable security definer set search_path = public as $$
  select m.role from public.conversation_members m
    where m.conversation_id = _conversation_id and m.user_id = _user_id;
$$;

create or replace function public.is_conversation_admin(_conversation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.conversation_role(_conversation_id, _user_id) in ('owner','admin'), false);
$$;

create or replace function public.can_post_in_conversation(_conversation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not public.is_conversation_member(_conversation_id, _user_id) then false
    when (select kind from public.conversations where id = _conversation_id) = 'channel'
      then public.is_conversation_admin(_conversation_id, _user_id)
    else true
  end;
$$;

create or replace function public.message_conversation(_message_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select conversation_id from public.messages where id = _message_id;
$$;

-- POLICIES: conversations
alter table public.conversations enable row level security;
create policy "members read conversations" on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()));
create policy "creator inserts conversation" on public.conversations for insert to authenticated
  with check (created_by = auth.uid());
create policy "admins update conversation" on public.conversations for update to authenticated
  using (public.is_conversation_admin(id, auth.uid()))
  with check (public.is_conversation_admin(id, auth.uid()));
create policy "owner deletes conversation" on public.conversations for delete to authenticated
  using (public.conversation_role(id, auth.uid()) = 'owner');

-- POLICIES: members
alter table public.conversation_members enable row level security;
create policy "members read membership" on public.conversation_members for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_member(conversation_id, auth.uid()));
create policy "add members" on public.conversation_members for insert to authenticated
  with check (
    not exists (select 1 from public.conversation_bans b
      where b.conversation_id = conversation_id and b.user_id = conversation_members.user_id)
    and (
      (select created_by from public.conversations c where c.id = conversation_id) = auth.uid()
      or public.is_conversation_admin(conversation_id, auth.uid())
      or (user_id = auth.uid()
          and (select invite_code from public.conversations c where c.id = conversation_id) is not null)
    )
  );
create policy "update own or admin membership" on public.conversation_members for update to authenticated
  using (user_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid()));
create policy "leave or admin removes" on public.conversation_members for delete to authenticated
  using (user_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid()));

-- POLICIES: bans
alter table public.conversation_bans enable row level security;
create policy "members read bans" on public.conversation_bans for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "admins ban" on public.conversation_bans for insert to authenticated
  with check (public.is_conversation_admin(conversation_id, auth.uid()) and banned_by = auth.uid());
create policy "admins unban" on public.conversation_bans for delete to authenticated
  using (public.is_conversation_admin(conversation_id, auth.uid()));

-- POLICIES: messages
alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "permitted members send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_post_in_conversation(conversation_id, auth.uid()));
create policy "author or admin updates message" on public.messages for update to authenticated
  using (sender_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid()))
  with check (sender_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid()));
create policy "author or admin deletes message" on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid()));

-- POLICIES: hides
alter table public.message_hides enable row level security;
create policy "own hides read" on public.message_hides for select to authenticated using (user_id = auth.uid());
create policy "own hides insert" on public.message_hides for insert to authenticated with check (user_id = auth.uid());
create policy "own hides delete" on public.message_hides for delete to authenticated using (user_id = auth.uid());

-- POLICIES: reactions
alter table public.message_reactions enable row level security;
create policy "members read reactions" on public.message_reactions for select to authenticated
  using (public.is_conversation_member(public.message_conversation(message_id), auth.uid()));
create policy "members react" on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid()
    and public.is_conversation_member(public.message_conversation(message_id), auth.uid()));
create policy "remove own reaction" on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- POLICIES: calls
alter table public.call_sessions enable row level security;
create policy "participants read calls" on public.call_sessions for select to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid());
create policy "caller starts call" on public.call_sessions for insert to authenticated
  with check (caller_id = auth.uid() and public.is_conversation_member(conversation_id, auth.uid()));
create policy "participants update call" on public.call_sessions for update to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid())
  with check (caller_id = auth.uid() or callee_id = auth.uid());

alter table public.call_signals enable row level security;
create policy "participants read signals" on public.call_signals for select to authenticated
  using (exists (select 1 from public.call_sessions c where c.id = call_id
    and (c.caller_id = auth.uid() or c.callee_id = auth.uid())));
create policy "participants send signals" on public.call_signals for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.call_sessions c where c.id = call_id
    and (c.caller_id = auth.uid() or c.callee_id = auth.uid())));

-- bump conversation activity on new message
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation();

-- realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.call_sessions;
alter publication supabase_realtime add table public.call_signals;
alter publication supabase_realtime add table public.profiles;