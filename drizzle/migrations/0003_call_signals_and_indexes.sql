create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('offer','answer','ice','hangup','renegotiate')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists call_signals_session_created_idx
  on public.call_signals(session_id, created_at);

alter table public.call_signals enable row level security;

drop policy if exists call_signals_select_participant on public.call_signals;
create policy call_signals_select_participant
on public.call_signals for select to authenticated
using (
  exists (
    select 1 from public.call_sessions cs
    where cs.id = call_signals.session_id
      and (cs.caller_id = (select auth.uid()) or cs.callee_id = (select auth.uid()))
  )
);

drop policy if exists call_signals_insert_participant on public.call_signals;
create policy call_signals_insert_participant
on public.call_signals for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.call_sessions cs
    where cs.id = call_signals.session_id
      and (cs.caller_id = (select auth.uid()) or cs.callee_id = (select auth.uid()))
  )
);

alter publication supabase_realtime add table public.call_signals;

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc);

create index if not exists conversation_members_user_conversation_idx
  on public.conversation_members(user_id, conversation_id);
