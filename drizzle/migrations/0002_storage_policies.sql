-- chat media: only conversation members may upload/read, path is "<conversation_id>/<file>"
create policy "members read chat media" on storage.objects for select to authenticated
using (
  bucket_id = 'chat-media'
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
create policy "members upload chat media" on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and public.can_post_in_conversation(((storage.foldername(name))[1])::uuid, auth.uid())
);
create policy "uploader deletes chat media" on storage.objects for delete to authenticated
using (bucket_id = 'chat-media' and owner = auth.uid());

-- avatars: path is "<user_id>/<file>"
create policy "authenticated read avatars" on storage.objects for select to authenticated
using (bucket_id = 'avatars');
create policy "own avatar upload" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar update" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar delete" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);