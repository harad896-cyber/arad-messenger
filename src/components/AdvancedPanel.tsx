import { useEffect, useState } from "react";
import { Bookmark, CalendarClock, Contact, Copy, LogOut, Settings, Shield, Sparkles, Users, X } from "lucide-react";
import {
  addContact, cancelScheduledMessage, createInvite, createStory, getContacts, getUserSettings,
  joinByInvite, leaveGroup, listSavedMessages, listScheduledMessages, listStories, markStoryViewed,
  removeContact, scheduleMessage, setUserSettings, type Profile,
} from "@/lib/features";
import { searchProfiles, type Conversation } from "@/lib/messenger";

type Props = {
  userId: string;
  profile: Profile | null;
  conversations: Conversation[];
  active: Conversation | null;
  close: () => void;
  onOpenConversation: (id: string) => void;
  onRefresh: () => Promise<void>;
  notify: (text: string) => void;
};

export function AdvancedPanel({ userId, profile, conversations, active, close, onOpenConversation, onRefresh, notify }: Props) {
  const [tab, setTab] = useState<"contacts"|"settings"|"saved"|"scheduled"|"stories"|"group">("contacts");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [saved, setSaved] = useState<any[]>([]);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [storyText, setStoryText] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getContacts(userId).then(setContacts).catch(()=>{});
    getUserSettings(userId).then(setSettings).catch(()=>{});
    listSavedMessages(userId).then(setSaved).catch(()=>{});
    listScheduledMessages(userId).then(setScheduled).catch(()=>{});
    listStories([userId, ...contacts.map(x=>x.contact_id)]).then(setStories).catch(()=>{});
  }, [userId]);

  useEffect(() => {
    if (!query.trim()) return void setResults([]);
    const t = window.setTimeout(() => searchProfiles(query, userId).then(setResults).catch(()=>setResults([])), 250);
    return () => window.clearTimeout(t);
  }, [query, userId]);

  const add = async (p: Profile) => {
    try { await addContact(userId, p.id); setContacts(await getContacts(userId)); notify("مخاطب اضافه شد."); }
    catch(e) { notify(e instanceof Error ? e.message : "افزودن مخاطب ناموفق بود"); }
  };
  const createScheduled = async () => {
    if (!active || !scheduleText.trim() || !scheduleAt) return;
    try {
      setLoading(true);
      await scheduleMessage(active.id, userId, scheduleText.trim(), new Date(scheduleAt).toISOString());
      setScheduleText(""); setScheduleAt(""); setScheduled(await listScheduledMessages(userId, active.id)); notify("پیام زمان‌بندی شد.");
    } catch(e) { notify(e instanceof Error ? e.message : "زمان‌بندی ناموفق بود"); }
    finally { setLoading(false); }
  };
  const createInviteCode = async () => {
    if (!active || active.type === "direct") return;
    try { const code = await createInvite(active.id); setInviteCode(String(code ?? "")); notify("لینک دعوت ساخته شد."); }
    catch(e) { notify(e instanceof Error ? e.message : "ساخت دعوت ناموفق بود"); }
  };
  const createStoryPost = async () => {
    if (!storyText.trim()) return;
    try { await createStory(userId, storyText.trim()); setStoryText(""); setStories(await listStories([userId, ...contacts.map(x=>x.contact_id)])); notify("استوری منتشر شد."); }
    catch(e) { notify(e instanceof Error ? e.message : "انتشار استوری ناموفق بود"); }
  };

  const nav = [
    ["contacts","مخاطبین",Contact], ["saved","ذخیره‌شده‌ها",Bookmark], ["scheduled","پیام‌های زمان‌بندی‌شده",CalendarClock],
    ["stories","استوری‌ها",Sparkles], ["settings","تنظیمات",Settings], ["group","ابزار گروه",Users],
  ] as const;

  return <div dir="rtl" className="fixed inset-y-0 left-0 z-50 flex w-full max-w-md border-r border-border bg-card shadow-2xl">
    <div className="flex w-28 shrink-0 flex-col border-l border-border bg-muted/40 p-2">
      <button className="icon-btn mb-2" onClick={close}><X/></button>
      {nav.map(([id,label,Icon]) => <button key={id} title={label} onClick={()=>setTab(id as any)} className={`mb-1 grid min-h-12 place-items-center gap-1 rounded-xl px-1 text-[10px] ${tab===id?"bg-primary text-primary-foreground":"hover:bg-muted"}`}><Icon className="size-5"/><span>{label}</span></button>)}
    </div>
    <div className="min-w-0 flex-1 overflow-y-auto p-4">
      {tab==="contacts" && <section><h2 className="text-lg font-bold">مخاطبین</h2><input className="field" value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام یا @نام‌کاربری"/>{results.map(p=><div key={p.id} className="mt-2 flex items-center gap-2 rounded-xl p-2 hover:bg-muted"><div className="min-w-0 flex-1"><div className="font-medium">{p.display_name}</div><div className="text-xs text-muted-foreground">@{p.username}</div></div><button className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={()=>onOpenConversation(p.id)}>پیام</button><button className="icon-btn-sm" onClick={()=>void add(p)}><Contact/></button></div>)}<div className="mt-5 space-y-2">{contacts.map(c=><div key={c.contact_id} className="flex items-center gap-2 rounded-xl bg-muted/50 p-3"><span className="flex-1 text-sm">{c.contact_id}</span><button className="icon-btn-sm" onClick={()=>void removeContact(userId,c.contact_id).then(async()=>setContacts(await getContacts(userId)))}><X/></button></div>)}</div></section>}

      {tab==="settings" && <SettingsTab userId={userId} settings={settings} setSettings={setSettings} notify={notify}/>}

      {tab==="saved" && <section><h2 className="text-lg font-bold">پیام‌های ذخیره‌شده</h2>{saved.map(s=><div key={s.id} className="mt-2 rounded-xl bg-muted p-3 text-sm">{s.body || "رسانه"}<div className="mt-1 text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleString("fa-IR")}</div></div>)}{!saved.length&&<p className="mt-4 text-sm text-muted-foreground">هنوز پیامی ذخیره نشده.</p>}</section>}

      {tab==="scheduled" && <section><h2 className="text-lg font-bold">پیام زمان‌بندی‌شده</h2><p className="mt-1 text-xs text-muted-foreground">برای گفتگوی فعال زمان‌بندی کن.</p><textarea className="field min-h-24 py-3" value={scheduleText} onChange={e=>setScheduleText(e.target.value)} placeholder="متن پیام"/><input className="field" type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)}/><button disabled={loading||!active} className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50" onClick={()=>void createScheduled()}>زمان‌بندی</button>{scheduled.map(s=><div key={s.id} className="mt-2 rounded-xl border border-border p-3"><div className="text-sm">{s.body}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(s.scheduled_for).toLocaleString("fa-IR")}</div><button className="mt-2 text-xs text-destructive" onClick={()=>void cancelScheduledMessage(s.id).then(async()=>setScheduled(await listScheduledMessages(userId)))}>لغو</button></div>)}</section>}

      {tab==="stories" && <section><h2 className="text-lg font-bold">استوری</h2><textarea className="field min-h-24 py-3" value={storyText} onChange={e=>setStoryText(e.target.value)} placeholder="چی می‌خوای منتشر کنی؟"/><button className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground" onClick={()=>void createStoryPost()}>انتشار</button>{stories.map(s=><button key={s.id} className="mt-3 w-full rounded-2xl p-4 text-right text-white shadow" style={{background:s.background||"#7c3aed"}} onClick={()=>void markStoryViewed(s.id,userId)}><div className="text-sm">{s.text||s.caption||"استوری"}</div><div className="mt-2 text-[10px] opacity-70">{new Date(s.created_at).toLocaleString("fa-IR")}</div></button>)}</section>}

      {tab==="group" && <section><h2 className="text-lg font-bold">ابزار گروه</h2>{!active || active.type==="direct" ? <p className="mt-4 text-sm text-muted-foreground">ابتدا یک گروه یا کانال را باز کن.</p> : <><button className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground" onClick={()=>void createInviteCode()}>ساخت لینک دعوت</button>{inviteCode&&<div className="mt-3 flex items-center gap-2 rounded-xl bg-muted p-3"><code className="flex-1 break-all text-xs">{inviteCode}</code><button className="icon-btn-sm" onClick={()=>navigator.clipboard?.writeText(inviteCode)}><Copy/></button></div>}<button className="mt-3 w-full rounded-xl border border-destructive/40 py-3 text-destructive" onClick={()=>void leaveGroup(active.id).then(async()=>{await onRefresh();close();notify("از گروه خارج شدی.")})}>خروج از گروه</button><div className="mt-6 rounded-xl bg-muted p-3 text-xs text-muted-foreground">مدیریت اعضا، نقش‌ها، محدودیت‌ها و پین پیام‌ها از پنل اطلاعات گروه انجام می‌شود.</div></>}</section>}
    </div>
  </div>;
}

function SettingsTab({userId,settings,setSettings,notify}:{userId:string;settings:any;setSettings:(x:any)=>void;notify:(x:string)=>void}) {
  const toggle = async (key:string) => {
    try { const next=await setUserSettings(userId,{[key]:!settings?.[key]}); setSettings(next); }
    catch(e){notify(e instanceof Error?e.message:"ذخیره تنظیمات ناموفق بود");}
  };
  if(!settings) return <div className="p-6 text-sm text-muted-foreground">در حال بارگذاری تنظیمات...</div>;
  const rows=[["show_online","نمایش آنلاین بودن"],["show_last_seen","نمایش آخرین بازدید"],["read_receipts","رسید خواندن"],["link_previews","پیش‌نمایش لینک"],["autoplay_voice","پخش خودکار صدا"],["notifications_enabled","اعلان‌ها"],["do_not_disturb","مزاحم نشوید"]];
  return <section><h2 className="text-lg font-bold">تنظیمات</h2>{rows.map(([key,label])=><button key={key} onClick={()=>void toggle(key)} className="mt-2 flex w-full items-center justify-between rounded-xl bg-muted p-3 text-right"><span className="text-sm">{label}</span><span className={`h-6 w-10 rounded-full p-1 ${settings[key]?"bg-primary":"bg-background"}`}><span className={`block size-4 rounded-full bg-white transition ${settings[key]?"mr-4":"mr-0"}`}/></span></button>)}</section>;
}
