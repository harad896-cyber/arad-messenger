export type { Profile } from "@/lib/messenger";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data;
}

export async function getUnreadCounts() {
  return (await rpc("get_unread_counts")) ?? [];
}
export async function markConversationRead(conversationId: string) {
  return rpc("mark_conversation_read", { p_conversation_id: conversationId });
}
export async function markMessageRead(messageId: string) {
  return rpc("mark_message_read", { p_message_id: messageId });
}
export async function deleteForMe(messageId: string) {
  return rpc("delete_message_for_me", { p_message_id: messageId });
}
export async function setReaction(messageId: string, reaction: string) {
  return rpc("set_message_reaction", { p_message_id: messageId, p_reaction: reaction });
}
export async function pinGroupMessage(conversationId: string, messageId: string) {
  return rpc("pin_group_message", { p_conversation_id: conversationId, p_message_id: messageId });
}
export async function unpinGroupMessage(conversationId: string, messageId: string) {
  return rpc("unpin_group_message", { p_conversation_id: conversationId, p_message_id: messageId });
}
export async function addGroupMember(conversationId: string, userId: string) {
  return rpc("add_group_member", { p_conversation_id: conversationId, p_user_id: userId });
}
export async function removeGroupMember(conversationId: string, userId: string) {
  return rpc("remove_group_member", { p_conversationid: conversationId, p_user_id: userId });
}
export async function setMemberRole(conversationId: string, userId: string, role: string) {
  return rpc("set_group_member_role", { p_conversation_id: conversationId, p_user_id: userId, p_role: role });
}
export async function leaveGroup(conversationId: string) {
  return rpc("leave_group", { p_conversation_id: conversationId });
}
export async function createInvite(conversationId: string, maxUses?: number | null, expiresAt?: string | null, requiresApproval = false) {
  return rpc("create_group_invite", {
    p_conversation_id: conversationId,
    p_max_uses: maxUses ?? null,
    p_expires_at: expiresAt ?? null,
    p_requires_approval: requiresApproval,
  });
}
export async function revokeInvite(conversationId: string) {
  return rpc("revoke_conversation_invite", { p_conversation_id: conversationId });
}
export async function joinByInvite(code: string) {
  return rpc("join_conversation_by_invite", { p_code: code });
}
export async function setGroupPermissions(conversationId: string, allowReactions: boolean, allowMemberAdd: boolean) {
  return rpc("set_group_permissions", {
    p_conversation_id: conversationId,
    p_allow_reactions: allowReactions,
    p_allow_member_add: allowMemberAdd,
  });
}
export async function updateGroupSettings(conversationId: string, patch: {
  title?: string | null; description?: string | null; avatar_url?: string | null;
  is_public?: boolean; username?: string | null; join_approval?: boolean;
  only_admins_can_post?: boolean; only_admins_can_add?: boolean;
  auto_delete_seconds?: number; allow_reactions?: boolean;
}) {
  const { data: current, error: readError } = await db.from("conversations").select("*").eq("id", conversationId).single();
  if (readError) throw readError;
  return rpc("update_group_settings", {
    p_conversation_id: conversationId,
    p_title: patch.title ?? current.title,
    p_description: patch.description ?? current.description,
    p_avatar_url: patch.avatar_url ?? current.avatar_url,
    p_is_public: patch.is_public ?? current.is_public,
    p_username: patch.username ?? current.username,
    p_join_approval: patch.join_approval ?? current.join_approval,
    p_only_admins_can_post: patch.only_admins_can_post ?? current.only_admins_can_post,
    p_only_admins_can_add: patch.only_admins_can_add ?? current.only_admins_can_add,
    p_auto_delete_seconds: patch.auto_delete_seconds ?? current.auto_delete_seconds ?? 0,
    p_allow_reactions: patch.allow_reactions ?? current.allow_reactions ?? true,
  });
}

export async function getContacts(userId: string) {
  const { data, error } = await db.from("contacts").select("id,contact_id,created_at").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return data ?? [];
}
export async function addContact(userId: string, contactId: string) {
  const { error } = await db.from("contacts").upsert({ user_id: userId, contact_id: contactId }, { onConflict: "user_id,contact_id" });
  if (error) throw error;
}
export async function removeContact(userId: string, contactId: string) {
  const { error } = await db.from("contacts").delete().eq("user_id", userId).eq("contact_id", contactId);
  if (error) throw error;
}

export async function getChatPreferences(userId: string) {
  const { data, error } = await db.from("chat_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function setChatPreferences(userId: string, patch: Record<string, unknown>) {
  const { data, error } = await db.from("chat_preferences").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return data;
}
export async function getUserSettings(userId: string) {
  const { data, error } = await db.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function setUserSettings(userId: string, patch: Record<string, unknown>) {
  const { data, error } = await db.from("user_settings").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return data;
}

export async function toggleMute(userId: string, conversationId: string, muted: boolean) {
  if (muted) {
    const { error } = await db.from("chat_mutes").upsert({ user_id: userId, conversation_id: conversationId }, { onConflict: "user_id,conversation_id" });
    if (error) throw error;
  } else {
    const { error } = await db.from("chat_mutes").delete().eq("user_id", userId).eq("conversation_id", conversationId);
    if (error) throw error;
  }
}
export async function toggleArchive(userId: string, conversationId: string, archived: boolean) {
  if (archived) {
    const { error } = await db.from("chat_archives").upsert({ user_id: userId, conversation_id: conversationId }, { onConflict: "user_id,conversation_id" });
    if (error) throw error;
  } else {
    const { error } = await db.from("chat_archives").delete().eq("user_id", userId).eq("conversation_id", conversationId);
    if (error) throw error;
  }
}
export async function toggleChatPin(userId: string, conversationId: string, pinned: boolean) {
  if (pinned) {
    const { error } = await db.from("chat_pins").upsert({ user_id: userId, conversation_id: conversationId }, { onConflict: "user_id,conversation_id" });
    if (error) throw error;
  } else {
    const { error } = await db.from("chat_pins").delete().eq("user_id", userId).eq("conversation_id", conversationId);
    if (error) throw error;
  }
}
export async function saveDraft(userId: string, conversationId: string, body: string) {
  const { error } = await db.from("message_drafts").upsert({ user_id: userId, conversation_id: conversationId, body }, { onConflict: "user_id,conversation_id" });
  if (error) throw error;
}
export async function loadDraft(userId: string, conversationId: string) {
  const { data, error } = await db.from("message_drafts").select("body").eq("user_id", userId).eq("conversation_id", conversationId).maybeSingle();
  if (error) throw error;
  return data?.body ?? "";
}
export async function clearDraft(userId: string, conversationId: string) {
  const { error } = await db.from("message_drafts").delete().eq("user_id", userId).eq("conversation_id", conversationId);
  if (error) throw error;
}

export async function scheduleMessage(conversationId: string, senderId: string, body: string, scheduledFor: string, replyTo?: string | null) {
  const { data, error } = await db.from("scheduled_messages").insert({
    conversation_id: conversationId, sender_id: senderId, body, message_type: "text",
    scheduled_for: scheduledFor, reply_to: replyTo ?? null, status: "pending",
  }).select().single();
  if (error) throw error;
  return data;
}
export async function listScheduledMessages(senderId: string, conversationId?: string) {
  let q = db.from("scheduled_messages").select("*").eq("sender_id", senderId).eq("status", "pending").order("scheduled_for");
  if (conversationId) q = q.eq("conversation_id", conversationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function cancelScheduledMessage(id: string) {
  const { error } = await db.from("scheduled_messages").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function createStory(userId: string, text: string, background = "0xFF7C3AED") {
  const { data, error } = await db.from("stories").insert({ user_id: userId, text, background, media_type: "text" }).select().single();
  if (error) throw error;
  return data;
}
export async function listStories(userIds: string[]) {
  if (!userIds.length) return [];
  const { data, error } = await db.from("stories").select("*").in("user_id", userIds).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function markStoryViewed(storyId: string, viewerId: string) {
  const { error } = await db.from("story_views").upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: "story_id,viewer_id" });
  if (error) throw error;
}

export async function saveMessage(userId: string, messageId: string, message: { body: string | null; message_type: string }) {
  const { error } = await db.from("saved_messages").upsert({
    user_id: userId, source_message_id: messageId, body: message.body ?? "", message_type: message.message_type,
  }, { onConflict: "user_id,source_message_id" });
  if (error) throw error;
}
export async function listSavedMessages(userId: string) {
  const { data, error } = await db.from("saved_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function searchMessages(conversationId: string, term: string) {
  const { data, error } = await db.from("messages").select("*").eq("conversation_id", conversationId).is("deleted_at", null).ilike("body", `%${term.replace(/[%_]/g, "")}%`).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}
