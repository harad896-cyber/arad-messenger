import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string | null;
};

export type Conversation = {
  id: string;
  type: "direct" | "group" | "channel";
  title: string | null;
  avatar_url: string | null;
  description: string | null;
  created_by: string | null;
  invite_code: string | null;
  allow_member_add: boolean;
  only_admins_can_add: boolean;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to: string | null;
};

export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const meta = user.user_metadata ?? {};
  const displayName = String(meta.display_name ?? meta.name ?? user.email?.split("@")[0] ?? "کاربر");
  const username = String(meta.username ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || null;
  const { data, error } = await db.from("profiles").upsert({
    id: user.id,
    display_name: displayName.slice(0, 80),
    username,
    is_online: true,
    last_seen: new Date().toISOString(),
  }, { onConflict: "id" }).select().single();
  if (error) throw error;
  return data as Profile;
}

export async function setPresence(userId: string, online: boolean) {
  await db.from("profiles").update({
    is_online: online,
    last_seen: new Date().toISOString(),
  }).eq("id", userId);
}

export async function loadConversations(userId: string) {
  const { data: memberships, error: memberError } = await db
    .from("conversation_members")
    .select("conversation_id, role, conversations(*)")
    .eq("user_id", userId);
  if (memberError) throw memberError;

  const rows = (memberships ?? []).map((m: any) => ({
    ...(m.conversations as Conversation),
    member_role: m.role,
  })).filter((x: any) => x.id);
  return rows as (Conversation & { member_role: string })[];
}

export async function loadMessages(conversationId: string) {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function loadProfiles(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await db.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function searchProfiles(term: string, currentUserId: string) {
  const clean = term.trim().replace(/^@/, "");
  if (!clean) return [];
  const { data, error } = await db.from("profiles")
    .select("*")
    .neq("id", currentUserId)
    .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
    .limit(20);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function createDirectConversation(currentUserId: string, otherUserId: string) {
  const { data: existingMembers, error: memberError } = await db
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", currentUserId);
  if (memberError) throw memberError;

  for (const row of existingMembers ?? []) {
    const { data: conv } = await db.from("conversations")
      .select("id,type")
      .eq("id", row.conversation_id)
      .eq("type", "direct")
      .maybeSingle();
    if (!conv) continue;
    const { data: other } = await db.from("conversation_members")
      .select("user_id")
      .eq("conversation_id", row.conversation_id)
      .eq("user_id", otherUserId)
      .maybeSingle();
    if (other) return conv.id as string;
  }

  const { data: conv, error } = await db.from("conversations").insert({
    type: "direct",
    created_by: currentUserId,
    allow_member_add: false,
  }).select().single();
  if (error) throw error;

  const { error: membersError } = await db.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: currentUserId, role: "admin" },
    { conversation_id: conv.id, user_id: otherUserId, role: "member" },
  ]);
  if (membersError) throw membersError;
  return conv.id as string;
}

export async function createGroup(currentUserId: string, title: string, memberIds: string[]) {
  const { data: conv, error } = await db.from("conversations").insert({
    type: "group",
    title: title.trim().slice(0, 100),
    created_by: currentUserId,
    allow_member_add: true,
  }).select().single();
  if (error) throw error;

  const uniqueIds = [...new Set([currentUserId, ...memberIds])];
  const { error: memberError } = await db.from("conversation_members").insert(
    uniqueIds.map((id) => ({
      conversation_id: conv.id,
      user_id: id,
      role: id === currentUserId ? "admin" : "member",
    })),
  );
  if (memberError) throw memberError;
  return conv as Conversation;
}

export async function addMember(conversationId: string, userId: string) {
  const { error } = await db.from("conversation_members").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "member",
  });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
}

export async function removeMember(conversationId: string, userId: string) {
  const { error } = await db.from("conversation_members")
    .delete().eq("conversation_id", conversationId).eq("user_id", userId);
  if (error) throw error;
}

export async function loadMembers(conversationId: string) {
  const { data, error } = await db.from("conversation_members")
    .select("user_id,role,joined_at")
    .eq("conversation_id", conversationId);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(conversationId: string, senderId: string, body: string, messageType = "text", replyTo?: string | null) {
  const { data, error } = await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: body || null,
    message_type: messageType,
    reply_to: replyTo ?? null,
  }).select().single();
  if (error) throw error;
  return data as MessageRow;
}

export async function deleteMessage(messageId: string) {
  const { error } = await db.from("messages")
    .update({ deleted_at: new Date().toISOString(), body: null })
    .eq("id", messageId);
  if (error) throw error;
}

export async function editMessage(messageId: string, body: string) {
  const { error } = await db.from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, reaction: string) {
  const { data } = await db.from("message_reactions").select("reaction")
    .eq("message_id", messageId).eq("user_id", userId).maybeSingle();
  if (data?.reaction === reaction) {
    await db.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId);
  } else {
    await db.from("message_reactions").upsert(
      { message_id: messageId, user_id: userId, reaction },
      { onConflict: "message_id,user_id" },
    );
  }
}

export async function uploadAttachment(conversationId: string, file: File, folder = "files") {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${conversationId}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name, mime: file.type, size: file.size };
}

export async function createAttachmentMessage(conversationId: string, senderId: string, file: File, folder = "files", durationMs?: number) {
  const uploaded = await uploadAttachment(conversationId, file, folder);
  const messageType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
  const message = await sendMessage(conversationId, senderId, uploaded.name, messageType);
  const { error } = await db.from("message_attachments").insert({
    message_id: message.id,
    storage_path: uploaded.path,
    file_name: uploaded.name,
    mime_type: uploaded.mime,
    file_size: uploaded.size,
    duration_ms: durationMs ?? null,
  });
  if (error) throw error;
  return message;
}

export async function getAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function getMessageAttachments(messageIds: string[]) {
  if (!messageIds.length) return [];
  const { data, error } = await db.from("message_attachments")
    .select("*").in("message_id", messageIds);
  if (error) throw error;
  return data ?? [];
}

export async function startCall(conversationId: string, callerId: string, calleeId: string, callType: "voice" | "video") {
  const { data, error } = await db.from("call_sessions").insert({
    conversation_id: conversationId,
    caller_id: callerId,
    callee_id: calleeId,
    call_type: callType,
    status: "ringing",
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCall(id: string, patch: Record<string, unknown>) {
  const { data, error } = await db.from("call_sessions").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function sendCallSignal(sessionId: string, senderId: string, kind: string, payload: unknown) {
  const { error } = await db.from("call_signals").insert({
    session_id: sessionId,
    sender_id: senderId,
    kind,
    payload,
  });
  if (error) throw error;
}

export { supabase };
