import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive, Check, CheckCheck, LogOut, Menu, MessageCircle, Mic, MoreVertical,
  Paperclip, Pause, Phone, Play, Plus, Search, Send, Settings, Smile,
  Square, Trash2, UserMinus, UserPlus, Users, Video, X, Loader2, Pencil,
} from "lucide-react";
import {
  addMember, createAttachmentMessage, createDirectConversation, createGroup,
  deleteMessage, editMessage, ensureProfile, getAttachmentUrl, getMessageAttachments,
  loadConversations, loadMembers, loadMessages, loadProfiles, searchProfiles,
  sendMessage, setPresence, supabase, toggleReaction,
} from "@/lib/messenger";
import { CallOverlay } from "@/components/CallOverlay";

type SessionUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };
type Profile = Awaited<ReturnType<typeof ensureProfile>>;
type Conv = Awaited<ReturnType<typeof loadConversations>>[number];
type Msg = Awaited<ReturnType<typeof loadMessages>>[number];

export const Route = createFileRoute("/")({ component: Messenger });

function Avatar({ name, url, size = "md" }: { name?: string | null; url?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-20 text-2xl" };
  return url ? <img src={url} alt="" className={`${sizes[size]} rounded-full object-cover`} /> :
    <div className={`${sizes[size]} grid shrink-0 place-items-center rounded-full bg-primary/20 font-bold text-primary`}>
      {(name ?? "آ").trim().slice(0, 1)}
    </div>;
}

function Messenger() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, Msg | undefined>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [attachments, setAttachments] = useState<Record<string, any[]>>({});
  const [composer, setComposer] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [search, setSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<Profile[]>([]);
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<any>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeTitle = useMemo(() => {
    if (!active) return "";
    if (active.type !== "direct") return active.title ?? "گروه";
    const members = Object.values(profiles).filter((p) => p.id !== session?.id);
    return members[0]?.display_name ?? members[0]?.username ?? "گفتگو";
  }, [active, profiles, session?.id]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSession(data.session?.user ?? null); setAuthLoading(false); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next?.user ?? null);
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await ensureProfile(session);
        if (cancelled) return;
        setProfile(p);
        await setPresence(session.id, true);
        const convs = await loadConversations(session.id);
        if (cancelled) return;
        setConversations(convs);
        const memberIds = [...new Set((await Promise.all(convs.map((c) => loadMembers(c.id)))).flat().map((m) => m.user_id))];
        const ps = await loadProfiles(memberIds);
        const map: Record<string, Profile> = {};
        ps.forEach((x) => { map[x.id] = x; });
        if (!cancelled) setProfiles(map);
        const latest: Record<string, Msg | undefined> = {};
        await Promise.all(convs.map(async (c) => {
          const rows = await loadMessages(c.id);
          latest[c.id] = rows.at(-1);
        }));
        if (!cancelled) {
          setLastMessages(latest);
          if (!activeId && convs[0]) setActiveId(convs[0].id);
        }
      } catch (e) {
        showNotice(e instanceof Error ? e.message : "خطا در بارگذاری");
      }
    })();
    return () => { cancelled = true; void setPresence(session.id, false); };
  }, [session]);

  useEffect(() => {
    if (!activeId || !session) return;
    let cancelled = false;
    loadMessages(activeId).then(async (rows) => {
      if (cancelled) return;
      setMessages(rows);
      const atts = await getMessageAttachments(rows.map((m) => m.id));
      const map: Record<string, any[]> = {};
      atts.forEach((a: any) => { (map[a.message_id] ??= []).push(a); });
      if (!cancelled) setAttachments(map);
    }).catch((e) => showNotice(e instanceof Error ? e.message : "خطا در پیام‌ها"));
    return () => { cancelled = true; };
  }, [activeId, session]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel("arad-messenger-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (payload: any) => {
        const row = payload.new as Msg;
        if (!row?.conversation_id) return;
        setLastMessages((x) => ({ ...x, [row.conversation_id]: row }));
        if (row.conversation_id === activeId) {
          const rows = await loadMessages(row.conversation_id);
          setMessages(rows);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, async () => {
        const convs = await loadConversations(session.id);
        setConversations(convs);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, async () => {
        const convs = await loadConversations(session.id);
        setConversations(convs);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "call_sessions" }, (payload: any) => {
        const row = payload.new;
        if (row?.callee_id === session.id && row.status === "ringing") setCall({ session: row, incoming: true });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, activeId]);

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setBusy(true);
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { data: { display_name: authName.trim(), username: authUsername.trim().toLowerCase() } },
        });
        if (error) throw error;
        if (!data.session) showNotice("حساب ساخته شد؛ اگر تأیید ایمیل فعال باشد، ایمیل خود را تأیید کن.");
        if (data.user) await ensureProfile(data.user);
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "ورود ناموفق بود");
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (session) await setPresence(session.id, false);
    await supabase.auth.signOut();
    setProfile(null); setConversations([]); setActiveId(null);
  }

  async function sendText() {
    if (!session || !activeId || !composer.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await editMessage(editing.id, composer.trim());
        setEditing(null);
      } else {
        await sendMessage(activeId, session.id, composer.trim(), "text", replyTo?.id);
        setReplyTo(null);
      }
      setComposer("");
      setMessages(await loadMessages(activeId));
    } catch (e) { showNotice(e instanceof Error ? e.message : "ارسال ناموفق بود"); }
    finally { setBusy(false); }
  }

  async function startRecording() {
    if (!session || !activeId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((x) => MediaRecorder.isTypeSupported(x)) ?? "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaStream.current = null;
        if (!chunks.current.length || recordingSeconds < 1) return;
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        const ext = recorder.mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        try {
          await createAttachmentMessage(activeId, session.id, file, "voice", recordingSeconds * 1000);
          setMessages(await loadMessages(activeId));
        } catch (e) { showNotice(e instanceof Error ? e.message : "آپلود ویس ناموفق بود"); }
      };
      recorder.start(250);
      mediaRecorder.current = recorder;
      setRecordingSeconds(0);
      setRecording(true);
    } catch (e) {
      showNotice("دسترسی میکروفون داده نشد یا مرورگر از ضبط صدا پشتیبانی نمی‌کند.");
    }
  }

  function stopRecording(cancel = false) {
    if (!mediaRecorder.current) return;
    const r = mediaRecorder.current;
    if (cancel) chunks.current = [];
    r.stop();
    mediaRecorder.current = null;
    setRecording(false);
  }

  async function uploadFile(file: File) {
    if (!session || !activeId) return;
    setBusy(true);
    try {
      await createAttachmentMessage(activeId, session.id, file);
      setMessages(await loadMessages(activeId));
    } catch (e) { showNotice(e instanceof Error ? e.message : "ارسال فایل ناموفق بود"); }
    finally { setBusy(false); }
  }

  async function createNewGroup() {
    if (!session || !newGroupName.trim()) return;
    try {
      const c = await createGroup(session.id, newGroupName, newGroupMembers.map((x) => x.id));
      setConversations(await loadConversations(session.id));
      setActiveId(c.id);
      setShowNew(false); setNewGroupName(""); setNewGroupMembers([]);
      showNotice("گروه ساخته شد.");
    } catch (e) { showNotice(e instanceof Error ? e.message : "ساخت گروه ناموفق بود"); }
  }

  async function startDirect(p: Profile) {
    if (!session) return;
    try {
      const id = await createDirectConversation(session.id, p.id);
      const convs = await loadConversations(session.id);
      setConversations(convs); setActiveId(id);
      setProfiles((x) => ({ ...x, [p.id]: p }));
      setShowNew(false);
    } catch (e) { showNotice(e instanceof Error ? e.message : "ساخت گفتگو ناموفق بود"); }
  }

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="animate-spin" /></div>;
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} name={authName} setName={setAuthName} username={authUsername} setUsername={setAuthUsername} error={authError} busy={busy} onSubmit={submitAuth} />;

  const visibleConversations = conversations.filter((c) => {
    const title = c.type === "direct" ? Object.values(profiles).find((p) => p.id !== session.id)?.display_name ?? "" : c.title ?? "";
    return !search.trim() || title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div dir="rtl" className="flex h-dvh min-w-0 overflow-hidden bg-background text-foreground">
      <aside className={`flex w-full max-w-[360px] shrink-0 flex-col border-l border-border bg-card ${activeId ? "hidden md:flex" : "flex"}`}>
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Avatar name={profile?.display_name} url={profile?.avatar_url} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">آراد مسنجر</div>
            <div className="truncate text-xs text-muted-foreground">@{profile?.username ?? "user"}</div>
          </div>
          <button className="icon-btn" title="گفتگوی جدید" onClick={() => setShowNew(true)}><Plus /></button>
          <button className="icon-btn" title="خروج" onClick={signOut}><LogOut /></button>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی گفتگو..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleConversations.map((c) => {
            const title = c.type === "direct"
              ? Object.values(profiles).find((p) => p.id !== session.id && conversations.some((cc) => cc.id === c.id))?.display_name ?? "گفتگوی خصوصی"
              : c.title ?? "گفتگو";
            const last = lastMessages[c.id];
            return <button key={c.id} onClick={() => setActiveId(c.id)} className={`flex w-full items-center gap-3 p-3 text-right hover:bg-muted ${activeId === c.id ? "bg-muted" : ""}`}>
              <Avatar name={title} url={c.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{title}</span><span className="text-[10px] text-muted-foreground">{last ? new Date(last.created_at).toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"}) : ""}</span></div>
                <div className="truncate text-xs text-muted-foreground">{last?.body ?? (last?.message_type === "audio" ? "پیام صوتی" : "فایل") ?? "گفتگوی جدید"}</div>
              </div>
            </button>;
          })}
          {!visibleConversations.length && <div className="p-8 text-center text-sm text-muted-foreground">هنوز گفتگویی نداری.</div>}
        </div>
      </aside>

      <main className={`min-w-0 flex-1 ${activeId ? "flex" : "hidden md:flex"} flex-col`}>
        {!active ? <EmptyState onNew={() => setShowNew(true)} /> : <>
          <header className="flex min-h-16 items-center gap-3 border-b border-border px-3">
            <button className="icon-btn md:hidden" onClick={() => setActiveId(null)}><Menu /></button>
            <Avatar name={activeTitle} url={active.avatar_url} />
            <button className="min-w-0 flex-1 text-right" onClick={() => active.type === "group" && setShowMembers(true)}>
              <div className="truncate font-bold">{activeTitle}</div>
              <div className="text-xs text-muted-foreground">{active.type === "group" ? "گروه" : active.type === "channel" ? "کانال" : "خصوصی"}</div>
            </button>
            {active.type === "direct" && <><button className="icon-btn" title="تماس صوتی" onClick={() => setCall({ conversation: active, type: "voice" })}><Phone /></button><button className="icon-btn" title="تماس تصویری" onClick={() => setCall({ conversation: active, type: "video" })}><Video /></button></>}
            <button className="icon-btn" onClick={() => setShowMembers(true)}><MoreVertical /></button>
          </header>

          <div className="chat-grid min-h-0 flex-1 overflow-y-auto px-3 py-5">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
              {messages.map((m) => <MessageBubble key={m.id} message={m} own={m.sender_id === session.id} profile={profiles[m.sender_id]} attachment={attachments[m.id]?.[0]} onReply={() => setReplyTo(m)} onEdit={() => {setEditing(m);setComposer(m.body ?? "");}} onDelete={async()=>{await deleteMessage(m.id);setMessages(await loadMessages(active.id));}} onReact={async()=>{await toggleReaction(m.id,session.id,"❤️");}} />)}
              {!messages.length && <div className="m-auto rounded-2xl bg-card/80 px-5 py-3 text-sm text-muted-foreground">اولین پیام را بفرست.</div>}
            </div>
          </div>

          <div className="border-t border-border bg-card p-2">
            {replyTo && <div className="mx-auto mb-2 flex max-w-4xl items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs"><span className="flex-1 truncate">پاسخ به: {replyTo.body ?? "پیام صوتی"}</span><button onClick={()=>setReplyTo(null)}><X className="size-4"/></button></div>}
            {editing && <div className="mx-auto mb-2 flex max-w-4xl items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs"><Pencil className="size-4"/><span className="flex-1">ویرایش پیام</span><button onClick={()=>{setEditing(null);setComposer("")}}><X className="size-4"/></button></div>}
            <div className="mx-auto flex max-w-4xl items-end gap-2">
              <button className="icon-btn" title="پیوست" onClick={() => fileInput.current?.click()} disabled={busy}><Paperclip /></button>
              <input ref={fileInput} type="file" className="hidden" accept="image/*,audio/*,video/*,application/pdf" onChange={(e)=>{const f=e.target.files?.[0];if(f) void uploadFile(f);e.currentTarget.value=""}} />
              {recording ? <div className="flex flex-1 items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3"><span className="size-2 animate-pulse rounded-full bg-destructive"/><span className="text-sm">{recordingSeconds} ثانیه</span><button className="mr-auto text-xs" onClick={()=>stopRecording(true)}>لغو</button><button className="icon-btn bg-destructive text-destructive-foreground" onClick={()=>stopRecording(false)}><Square/></button></div> :
              <input value={composer} onChange={(e)=>setComposer(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendText()}}} placeholder="پیام..." className="min-h-11 flex-1 rounded-2xl bg-muted px-4 outline-none" />}
              {!composer.trim() && !editing ? <button className="icon-btn" title="ضبط ویس" onClick={()=>void startRecording()}><Mic /></button> : <button className="icon-btn bg-primary text-primary-foreground" onClick={()=>void sendText()} disabled={busy}><Send /></button>}
            </div>
          </div>
        </>}
      </main>

      {showMembers && active && <MembersPanel conversation={active} currentUserId={session.id} profiles={profiles} close={()=>setShowMembers(false)} onAdded={async()=>{setConversations(await loadConversations(session.id));}} search={memberSearch} setSearch={setMemberSearch} notify={showNotice} />}
      {showNew && <NewConversationPanel currentUserId={session.id} close={()=>setShowNew(false)} groupName={newGroupName} setGroupName={setNewGroupName} selected={newGroupMembers} setSelected={setNewGroupMembers} onGroup={createNewGroup} onDirect={startDirect} />}
      {call && <CallOverlay userId={session.id} profile={profile} conversation={call.conversation ?? active} type={call.type} incoming={call.incoming} incomingSession={call.session} onClose={()=>setCall(null)} />}
      {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2 text-sm text-background shadow-xl">{notice}</div>}
    </div>
  );
}

function AuthScreen({mode,setMode,email,setEmail,password,setPassword,name,setName,username,setUsername,error,busy,onSubmit}:{mode:"login"|"signup";setMode:(x:"login"|"signup")=>void;email:string;setEmail:(x:string)=>void;password:string;setPassword:(x:string)=>void;name:string;setName:(x:string)=>void;username:string;setUsername:(x:string)=>void;error:string;busy:boolean;onSubmit:(e:React.FormEvent)=>void}) {
  return <div dir="rtl" className="grid min-h-screen place-items-center bg-background px-4"><form onSubmit={onSubmit} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="mb-7 text-center"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground">آ</div><h1 className="mt-4 text-2xl font-black">آراد مسنجر</h1><p className="mt-1 text-sm text-muted-foreground">{mode==="login"?"ورود به حساب":"ساخت حساب جدید"}</p></div>
    {mode==="signup" && <><label className="label">نام</label><input className="field" value={name} onChange={e=>setName(e.target.value)} required/><label className="label">نام کاربری</label><input className="field" value={username} onChange={e=>setUsername(e.target.value)} placeholder="arad_123" required/></>}
    <label className="label">ایمیل</label><input className="field" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label className="label">رمز عبور</label><input className="field" type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/>
    {error && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}<button disabled={busy} className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50">{busy?<Loader2 className="animate-spin"/>:mode==="login"?"ورود":"ثبت‌نام"}</button>
    <button type="button" className="mt-4 w-full text-sm text-primary" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"حساب ندارم":"حساب دارم؛ ورود"}</button>
  </form></div>;
}

function EmptyState({onNew}:{onNew:()=>void}) { return <div dir="rtl" className="grid h-full place-items-center"><div className="text-center"><div className="mx-auto grid size-20 place-items-center rounded-3xl bg-primary/10 text-primary"><MessageCircle className="size-10"/></div><h2 className="mt-4 text-xl font-bold">آراد مسنجر</h2><p className="mt-1 text-sm text-muted-foreground">یک گفتگو را انتخاب کن یا گفتگوی جدید بساز.</p><button onClick={onNew} className="mt-5 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground">گفتگوی جدید</button></div></div>; }

function MessageBubble({message,own,profile,attachment,onReply,onEdit,onDelete,onReact}:{message:Msg;own:boolean;profile:Profile|undefined;attachment:any;onReply:()=>void;onEdit:()=>void;onDelete:()=>Promise<void>;onReact:()=>Promise<void>}) {
  const [url,setUrl]=useState("");
  useEffect(()=>{if(attachment?.storage_path)getAttachmentUrl(attachment.storage_path).then(setUrl).catch(()=>{});},[attachment?.storage_path]);
  const isAudio=message.message_type==="audio";
  return <div className={`group flex ${own?"justify-start":"justify-end"}`}><div className={`relative max-w-[min(80%,620px)] rounded-2xl px-3 py-2 shadow-sm ${own?"bg-primary text-primary-foreground rounded-br-md":"bg-card border border-border rounded-bl-md"}`}>
    {!own&&<div className="mb-1 text-[11px] font-bold opacity-70">{profile?.display_name??"کاربر"}</div>}
    {attachment&&url&&(attachment.mime_type?.startsWith("image/")?<img src={url} alt="" className="mb-2 max-h-80 max-w-full rounded-xl object-contain"/>:isAudio?<audio src={url} controls preload="metadata" className="max-w-full"/>:<a href={url} target="_blank" rel="noreferrer" className="mb-1 block underline">{attachment.file_name??"فایل"}</a>)}
    {message.body&&<div className="whitespace-pre-wrap break-words text-sm">{message.body}</div>}
    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60"><span>{new Date(message.created_at).toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"})}</span>{own&&<CheckCheck className="size-3"/>}</div>
    <div className="absolute -top-9 right-0 hidden items-center gap-1 rounded-xl border border-border bg-popover p-1 shadow-lg group-hover:flex"><button className="icon-btn-sm" onClick={onReply}><MessageCircle/></button>{own&&<><button className="icon-btn-sm" onClick={onEdit}><Pencil/></button><button className="icon-btn-sm" onClick={()=>void onDelete()}><Trash2/></button></>}<button className="icon-btn-sm" onClick={()=>void onReact()}><Smile/></button></div>
  </div></div>;
}

function MembersPanel({conversation,currentUserId,profiles,close,onAdded,search,setSearch,notify}:{conversation:Conv;currentUserId:string;profiles:Record<string,Profile>;close:()=>void;onAdded:()=>Promise<void>;search:string;setSearch:(x:string)=>void;notify:(x:string)=>void}) {
  const [members,setMembers]=useState<any[]>([]);
  const [results,setResults]=useState<Profile[]>([]);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{loadMembers(conversation.id).then(setMembers).catch(()=>{});},[conversation.id]);
  useEffect(()=>{if(!search.trim())return void setResults([]);searchProfiles(search,currentUserId).then(setResults).catch(()=>setResults([]));},[search,currentUserId]);
  const add=async(p:Profile)=>{setLoading(true);try{await addMember(conversation.id,p.id);setMembers(await loadMembers(conversation.id));setSearch("");await onAdded();notify("عضو اضافه شد.");}catch(e){notify(e instanceof Error?e.message:"افزودن عضو ناموفق بود");}finally{setLoading(false);}};
  return <div className="fixed inset-y-0 left-0 z-40 w-full max-w-sm border-r border-border bg-card shadow-2xl"><div className="flex h-16 items-center gap-2 border-b border-border px-4"><button className="icon-btn" onClick={close}><X/></button><h3 className="font-bold">{conversation.type==="group"?"اعضای گروه":"اطلاعات گفتگو"}</h3></div><div className="p-4">{conversation.type==="group"&&<><div className="flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="نام کاربری برای افزودن..." className="field mt-0"/><button disabled={loading} className="icon-btn bg-primary text-primary-foreground"><UserPlus/></button></div>{results.map(p=><button key={p.id} onClick={()=>void add(p)} className="mt-2 flex w-full items-center gap-3 rounded-xl p-2 text-right hover:bg-muted"><Avatar name={p.display_name} url={p.avatar_url}/><div><div className="font-medium">{p.display_name}</div><div className="text-xs text-muted-foreground">@{p.username}</div></div></button>)}<div className="my-5 h-px bg-border"/></>}{members.map(m=>{const p=profiles[m.user_id];return <div key={m.user_id} className="flex items-center gap-3 py-2"><Avatar name={p?.display_name} url={p?.avatar_url} size="sm"/><div className="flex-1"><div className="text-sm">{p?.display_name??"کاربر"}</div><div className="text-xs text-muted-foreground">{m.role==="admin"?"مدیر":"عضو"}</div></div></div>})}</div></div>;
}

function NewConversationPanel({currentUserId,close,groupName,setGroupName,selected,setSelected,onGroup,onDirect}:{currentUserId:string;close:()=>void;groupName:string;setGroupName:(x:string)=>void;selected:Profile[];setSelected:(x:Profile[])=>void;onGroup:()=>Promise<void>;onDirect:(p:Profile)=>Promise<void>}) {
  const [tab,setTab]=useState<"direct"|"group">("direct"); const [q,setQ]=useState(""); const [results,setResults]=useState<Profile[]>([]);
  useEffect(()=>{if(!q.trim())return void setResults([]);searchProfiles(q,currentUserId).then(setResults).catch(()=>setResults([]));},[q,currentUserId]);
  return <div className="fixed inset-y-0 left-0 z-40 w-full max-w-sm border-r border-border bg-card shadow-2xl"><div className="flex h-16 items-center gap-2 border-b border-border px-4"><button className="icon-btn" onClick={close}><X/></button><h3 className="font-bold">گفتگوی جدید</h3></div><div className="flex border-b border-border"><button className={`flex-1 p-3 text-sm ${tab==="direct"?"border-b-2 border-primary text-primary":""}`} onClick={()=>setTab("direct")}>خصوصی</button><button className={`flex-1 p-3 text-sm ${tab==="group"?"border-b-2 border-primary text-primary":""}`} onClick={()=>setTab("group")}>گروه</button></div><div className="p-4">{tab==="group"&&<input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="نام گروه" className="field"/>}<input value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجوی نام کاربری..." className="field"/>{selected.length>0&&<div className="mb-2 flex flex-wrap gap-1">{selected.map(p=><button key={p.id} onClick={()=>setSelected(selected.filter(x=>x.id!==p.id))} className="rounded-full bg-primary/10 px-2 py-1 text-xs">{p.display_name} ×</button>)}</div>}{results.map(p=><button key={p.id} onClick={()=>tab==="direct"?void onDirect(p):setSelected([...selected,p])} className="flex w-full items-center gap-3 rounded-xl p-2 text-right hover:bg-muted"><Avatar name={p.display_name} url={p.avatar_url}/><div><div>{p.display_name}</div><div className="text-xs text-muted-foreground">@{p.username}</div></div></button>)}{tab==="group"&&<button onClick={()=>void onGroup()} disabled={!groupName.trim()} className="mt-4 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">ساخت گروه</button>}</div></div>;
}
