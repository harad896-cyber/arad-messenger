-- Advanced Arad Messenger features
-- Applied to Supabase project bkbdcqequyvubjmrbpqo

create or replace function public.delete_message_for_me(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (select 1 from public.messages m join public.conversation_members cm on cm.conversation_id=m.conversation_id and cm.user_id=auth.uid() where m.id=p_message_id) then raise exception 'message not accessible'; end if;
  insert into public.message_user_deletions(message_id,user_id) values(p_message_id,auth.uid()) on conflict do nothing;
end;
$fn$;
revoke all on function public.delete_message_for_me(uuid) from public, anon;
grant execute on function public.delete_message_for_me(uuid) to authenticated;

create or replace function public.process_scheduled_messages()
returns integer language plpgsql security definer set search_path = public as $fn$
declare r record; inserted_id uuid; total integer := 0;
begin
  for r in select * from public.scheduled_messages where status='pending' and scheduled_for<=now() order by scheduled_for for update skip locked loop
    begin
      insert into public.messages(conversation_id,sender_id,body,message_type,reply_to) values(r.conversation_id,r.sender_id,r.body,r.message_type,r.reply_to) returning id into inserted_id;
      update public.scheduled_messages set status='sent',sent_message_id=inserted_id,sent_at=now() where id=r.id;
      total:=total+1;
    exception when others then
      update public.scheduled_messages set status='failed',error_message=left(sqlerrm,500) where id=r.id;
    end;
  end loop;
  return total;
end;
$fn$;
revoke all on function public.process_scheduled_messages() from public, anon, authenticated;

do $block$
begin
  if not exists (select 1 from cron.job where jobname='arad-process-scheduled-messages') then
    perform cron.schedule('arad-process-scheduled-messages','* * * * *',$job$select public.process_scheduled_messages();$job$);
  end if;
end
$block$;

drop policy if exists "members read group invites" on public.group_invites;
create policy "members read group invites" on public.group_invites for select to authenticated using (exists(select 1 from public.conversation_members cm where cm.conversation_id=group_invites.conversation_id and cm.user_id=auth.uid()));
drop policy if exists "admins manage group invites" on public.group_invites;
create policy "admins manage group invites" on public.group_invites for all to authenticated using (public.is_conversation_admin(conversation_id)) with check (public.is_conversation_admin(conversation_id));

drop policy if exists "admins manage group permissions" on public.group_admin_permissions;
create policy "admins manage group permissions" on public.group_admin_permissions for all to authenticated using (public.is_conversation_admin(conversation_id)) with check (public.is_conversation_admin(conversation_id));

drop policy if exists "members read group restrictions" on public.group_member_restrictions;
create policy "members read group restrictions" on public.group_member_restrictions for select to authenticated using (user_id=auth.uid() or public.is_conversation_admin(conversation_id));
drop policy if exists "admins manage group restrictions" on public.group_member_restrictions;
create policy "admins manage group restrictions" on public.group_member_restrictions for all to authenticated using (public.is_conversation_admin(conversation_id)) with check (public.is_conversation_admin(conversation_id));

drop policy if exists "admins read group audit" on public.group_audit_logs;
create policy "admins read group audit" on public.group_audit_logs for select to authenticated using (public.is_conversation_admin(conversation_id));

create index if not exists messages_reply_to_idx on public.messages(reply_to);
create index if not exists message_reads_user_message_idx on public.message_reads(user_id,message_id);
create index if not exists message_deletions_user_message_idx on public.message_user_deletions(user_id,message_id);
create index if not exists scheduled_messages_due_idx on public.scheduled_messages(status,scheduled_for);
