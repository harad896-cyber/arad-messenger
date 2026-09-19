import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  Ban,
  Bell,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  Copy,
  Edit3,
  Forward,
  Link2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Phone,
  Play,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ChatKind = "private" | "group" | "channel";
type Chat = {
  id: string;
  name: string;
  initials: string;
  color: string;
  kind: ChatKind;
  subtitle: string;
  time: string;
  unread?: number;
  muted?: boolean;
  online?: boolean;
};
type ChatMessage = {
  id: number;
  sender: string;
  text?: string | undefined;
  time: string;
  mine?: boolean | undefined;
  voice?: boolean | undefined;
  duration?: number | undefined;
  reply?: string | undefined;
  reaction?: string | undefined;
};

const chats: Chat[] = [
  {
    id: "design",
    name: "تیم طراحی محصول",
    initials: "ط",
    color: "bg-primary",
    kind: "group",
    subtitle: "مریم: نسخه نهایی آماده‌ست ✨",
    time: "۰۱:۲۸",
    unread: 3,
  },
  {
    id: "sara",
    name: "سارا احمدی",
    initials: "س",
    color: "bg-read",
    kind: "private",
    subtitle: "صدای تو رسید، الان گوش می‌دم",
    time: "۰۰:۴۲",
    online: true,
  },
  {
    id: "news",
    name: "کانال خبرهای آراد",
    initials: "آ",
    color: "bg-online",
    kind: "channel",
    subtitle: "به‌روزرسانی نسخه ۲ منتشر شد",
    time: "دیروز",
    muted: true,
  },
  {
    id: "family",
    name: "خانواده",
    initials: "خ",
    color: "bg-accent",
    kind: "group",
    subtitle: "بابا: جمعه منتظرتونیم",
    time: "دیروز",
    unread: 1,
  },
  {
    id: "omid",
    name: "امید رضایی",
    initials: "ا",
    color: "bg-secondary",
    kind: "private",
    subtitle: "فایل پروژه رو فرستادم",
    time: "دوشنبه",
  },
];

const initialMessages: Record<string, ChatMessage[]> = {
  design: [
    {
      id: 1,
      sender: "مریم",
      text: "سلام تیم! نسخه نهایی صفحه پرداخت آماده شد. نظرتون چیه؟",
      time: "۰۰:۵۵",
    },
    {
      id: 2,
      sender: "من",
      text: "خیلی تمیز شده 👌 فقط فاصله دکمه اصلی رو یک مقدار بیشتر کنیم.",
      time: "۰۰:۵۸",
      mine: true,
      reaction: "❤️ ۲",
    },
    {
      id: 3,
      sender: "علی",
      text: "موافقم. من همین الان روی نسخه موبایل تستش می‌کنم.",
      time: "۰۱:۰۴",
      reply: "فاصله دکمه اصلی رو یک مقدار بیشتر کنیم",
    },
    { id: 4, sender: "مریم", voice: true, duration: 47, time: "۰۱:۱۲" },
    {
      id: 5,
      sender: "من",
      text: "عالیه، نتیجه تست رو همین‌جا بفرست تا جمع‌بندی کنیم.",
      time: "۰۱:۱۸",
      mine: true,
    },
    { id: 6, sender: "مریم", text: "حتماً. نسخه نهایی آماده‌ست ✨", time: "۰۱:۲۸" },
  ],
  sara: [
    { id: 1, sender: "سارا", text: "سلام آراد، برای جلسه فردا آماده‌ای؟", time: "۲۳:۵۴" },
    {
      id: 2,
      sender: "من",
      text: "سلام، بله. نکات مهم رو هم یادداشت کردم.",
      time: "۰۰:۰۲",
      mine: true,
    },
    { id: 3, sender: "من", voice: true, duration: 34, time: "۰۰:۳۹", mine: true },
    {
      id: 4,
      sender: "سارا",
      text: "صدای تو رسید، الان گوش می‌دم",
      time: "۰۰:۴۲",
      reaction: "👍 ۱",
    },
  ],
  news: [
    {
      id: 1,
      sender: "مدیریت کانال",
      text: "نسخه ۲ آراد مسنجر منتشر شد. سرعت بیشتر، پخش بهتر پیام‌های صوتی و مدیریت پیشرفته گروه‌ها در دسترس است.",
      time: "۱۸:۳۰",
    },
    {
      id: 2,
      sender: "مدیریت کانال",
      text: "از همراهی شما ممنونیم. بازخوردهای خود را برای ما بفرستید.",
      time: "۱۸:۳۲",
      reaction: "🔥 ۱۴",
    },
  ],
  family: [{ id: 1, sender: "بابا", text: "جمعه برای ناهار منتظرتونیم 😊", time: "۲۰:۱۰" }],
  omid: [
    {
      id: 1,
      sender: "امید",
      text: "فایل پروژه رو فرستادم. اگر نکته‌ای بود خبر بده.",
      time: "۱۶:۲۲",
    },
  ],
};

const members = [
  { name: "آراد حامد", role: "مالک", initials: "آ", online: true },
  { name: "مریم حسینی", role: "مدیر", initials: "م", online: true },
  { name: "علی مرادی", role: "عضو", initials: "ع", online: false },
  { name: "نیلوفر کریمی", role: "عضو", initials: "ن", online: true },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "آراد مسنجر — گفتگوها" },
      { name: "description", content: "گفتگوهای خصوصی، گروه‌ها و کانال‌ها در آراد مسنجر" },
      { property: "og:title", content: "آراد مسنجر — گفتگوها" },
      { property: "og:description", content: "تجربه پیام‌رسان فارسی سریع و امن" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessengerApp,
});

function Avatar({
  chat,
  size = "md",
}: {
  chat: Pick<Chat, "initials" | "color" | "online">;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "grid place-items-center rounded-full font-bold text-primary-foreground shadow-inner",
          chat.color,
          size === "sm" ? "size-9 text-xs" : size === "lg" ? "size-20 text-2xl" : "size-12 text-sm",
        )}
      >
        {chat.initials}
      </div>
      {chat.online && (
        <span className="absolute bottom-0 end-0 size-3 rounded-full border-2 border-card bg-online" />
      )}
    </div>
  );
}

function MessengerApp() {
  const [activeId, setActiveId] = useState("design");
  const [messages, setMessages] = useState(initialMessages);
  const [search, setSearch] = useState("");
  const [mobileChat, setMobileChat] = useState(false);
  const [panel, setPanel] = useState<"info" | "settings" | "profile" | null>(null);
  const [replying, setReplying] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [confirm, setConfirm] = useState<{
    type: "delete" | "remove" | "ban";
    id?: number;
    name?: string;
  } | null>(null);
  const [toast, setToast] = useState("");
  const active: Chat = chats.find((c) => c.id === activeId) ?? {
    id: "design",
    name: "تیم طراحی محصول",
    initials: "ط",
    color: "bg-primary",
    kind: "group",
    subtitle: "گفتگوی گروهی",
    time: "اکنون",
  };
  const filtered = chats.filter((c) => c.name.includes(search) || c.subtitle.includes(search));

  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2400);
  };
  const selectChat = (id: string) => {
    setActiveId(id);
    setMobileChat(true);
    setPanel(null);
    setReplying(null);
  };
  const sendMessage = (message: { text: string }) => {
    const text = message.text.trim();
    if (!text || active.kind === "channel") return;
    if (editing) {
      setMessages((old) => ({
        ...old,
        [activeId]: (old[activeId] ?? []).map((m) => (m.id === editing.id ? { ...m, text } : m)),
      }));
      setEditing(null);
      notify("پیام ویرایش شد");
      return;
    }
    setMessages((old) => ({
      ...old,
      [activeId]: [
        ...(old[activeId] ?? []),
        { id: Date.now(), sender: "من", text, time: "اکنون", mine: true, reply: replying?.text },
      ],
    }));
    setReplying(null);
  };
  const deleteMessage = () => {
    if (confirm?.id)
      setMessages((old) => ({
        ...old,
        [activeId]: (old[activeId] ?? []).filter((m) => m.id !== confirm.id),
      }));
    setConfirm(null);
    notify("پیام حذف شد");
  };

  return (
    <TooltipProvider>
      <main className="h-dvh bg-background text-foreground" dir="rtl">
        <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 overflow-hidden border-border md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px] xl:border-x">
          <aside
            className={cn(
              "flex min-h-0 flex-col border-l border-border bg-card",
              mobileChat && "hidden md:flex",
            )}
          >
            <div className="flex h-20 items-center gap-3 border-b border-border px-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="منو"
                onClick={() => setPanel("settings")}
              >
                <Menu />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-extrabold">آراد مسنجر</h1>
                <p className="text-xs text-muted-foreground">Project 2 · نسخه نمایشی</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="گفتگوی جدید"
                onClick={() => notify("ساخت گفتگوی جدید در نسخه نمایشی")}
              >
                <Edit3 />
              </Button>
            </div>
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 rounded-lg border-0 bg-muted pr-10 placeholder:text-muted-foreground"
                  placeholder="جستجو در گفتگوها"
                  aria-label="جستجو در گفتگوها"
                />
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 text-xs">
              <span className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground">
                همه
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
                خوانده‌نشده
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
                گروه‌ها
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {filtered.map((chat) => (
                <Button
                  key={chat.id}
                  variant="ghost"
                  onClick={() => selectChat(chat.id)}
                  className={cn(
                    "mb-1 grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 text-right",
                    activeId === chat.id && "bg-accent",
                  )}
                >
                  <Avatar chat={chat} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="truncate font-semibold">{chat.name}</p>
                      {chat.kind === "channel" && (
                        <Volume2 className="size-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                      {chat.subtitle}
                    </p>
                  </div>
                  <div className="flex h-full flex-col items-end justify-between">
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {chat.time}
                    </span>
                    {chat.unread ? (
                      <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                        {chat.unread}
                      </span>
                    ) : chat.muted ? (
                      <BellOff className="size-3 text-muted-foreground" />
                    ) : null}
                  </div>
                </Button>
              ))}
            </div>
            <nav className="grid grid-cols-3 border-t border-border p-2">
              <NavButton
                icon={<MessageCircle />}
                label="گفتگوها"
                active
                onClick={() => {
                  setPanel(null);
                  setMobileChat(false);
                }}
              />
              <NavButton icon={<Settings />} label="تنظیمات" onClick={() => setPanel("settings")} />
              <NavButton
                icon={<span className="text-xs font-bold">آ</span>}
                label="پروفایل"
                onClick={() => setPanel("profile")}
              />
            </nav>
          </aside>

          <section
            className={cn(
              "min-h-0 min-w-0 flex-col bg-chat-surface",
              mobileChat ? "flex" : "hidden md:flex",
            )}
          >
            <header className="glass-panel z-10 grid h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 sm:px-5">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="بازگشت"
                onClick={() => setMobileChat(false)}
              >
                <ArrowRight />
              </Button>
              <button
                className="flex min-w-0 items-center gap-3 text-right"
                onClick={() => setPanel("info")}
              >
                <Avatar chat={active} />
                <div className="min-w-0">
                  <h2 className="truncate font-bold">{active.name}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {active.kind === "group"
                      ? "۱۲ عضو، ۴ نفر آنلاین"
                      : active.kind === "channel"
                        ? "۲۴٫۸ هزار دنبال‌کننده"
                        : active.online
                          ? "آنلاین"
                          : "آخرین بازدید امروز"}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1">
                {active.kind !== "channel" && (
                  <>
                    <IconTip label="تماس صوتی">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => notify("تماس صوتی در نسخه نمایشی فعال نیست")}
                      >
                        <Phone />
                      </Button>
                    </IconTip>
                    <IconTip label="تماس تصویری">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hidden sm:inline-flex"
                        onClick={() => notify("تماس تصویری در نسخه نمایشی فعال نیست")}
                      >
                        <Video />
                      </Button>
                    </IconTip>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="گزینه‌های گفتگو">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setPanel("info")}>
                      <Users /> اطلاعات گفتگو
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => notify("اعلان‌های گفتگو بی‌صدا شد")}>
                      <BellOff /> بی‌صدا کردن
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => notify("گفتگو بایگانی شد")}>
                      <Archive /> بایگانی گفتگو
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <div className="relative min-h-0 flex-1 chat-grid">
              <Conversation className="h-full">
                <ConversationContent className="mx-auto w-full max-w-3xl gap-2 px-3 py-6 sm:px-8">
                  <div className="mx-auto my-2 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                    امروز، ۲۸ شهریور
                  </div>
                  {(messages[activeId] ?? []).map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      onReply={() => setReplying(message)}
                      onEdit={() => setEditing(message)}
                      onDelete={() => setConfirm({ type: "delete", id: message.id })}
                      onReact={() => {
                        setMessages((old) => ({
                          ...old,
                          [activeId]: (old[activeId] ?? []).map((m) =>
                            m.id === message.id
                              ? { ...m, reaction: m.reaction ? undefined : "❤️ ۱" }
                              : m,
                          ),
                        }));
                      }}
                      onForward={() => notify("پیام برای ارسال انتخاب شد")}
                    />
                  ))}
                </ConversationContent>
                <ConversationScrollButton aria-label="رفتن به آخر گفتگو" />
              </Conversation>
            </div>
            <div className="border-t border-border bg-card/95 p-2 sm:p-3">
              {(replying || editing) && (
                <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 border-r-2 border-primary bg-muted px-3 py-2">
                  <Reply className="size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-primary">
                      {editing ? "ویرایش پیام" : `پاسخ به ${replying?.sender}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {editing?.text ?? replying?.text ?? "پیام صوتی"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="بستن"
                    onClick={() => {
                      setReplying(null);
                      setEditing(null);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              )}
              {active.kind === "channel" ? (
                <div className="mx-auto flex h-12 max-w-3xl items-center justify-center gap-2 rounded-lg bg-muted text-sm text-muted-foreground">
                  <LockKeyhole className="size-4" /> فقط مدیران کانال می‌توانند پیام ارسال کنند
                </div>
              ) : (
                <PromptInput
                  className="mx-auto max-w-3xl rounded-lg border-border bg-muted shadow-none"
                  onSubmit={sendMessage}
                >
                  <PromptInputTextarea
                    key={editing?.id ?? "new"}
                    defaultValue={editing?.text ?? ""}
                    placeholder="پیام بنویسید…"
                    className="min-h-12 text-right"
                    dir="rtl"
                  />
                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputButton
                        aria-label="افزودن پیوست"
                        onClick={() => notify("انتخاب فایل در این نمونه شبیه‌سازی شده است")}
                      >
                        <Paperclip />
                      </PromptInputButton>
                      <PromptInputButton
                        aria-label="ضبط پیام صوتی"
                        onClick={() => notify("برای ضبط، دسترسی میکروفون لازم است")}
                      >
                        <Mic />
                      </PromptInputButton>
                    </PromptInputTools>
                    <PromptInputSubmit aria-label="ارسال پیام">
                      <Send />
                    </PromptInputSubmit>
                  </PromptInputFooter>
                </PromptInput>
              )}
            </div>
          </section>

          <aside className="hidden min-h-0 border-r border-border bg-card xl:block">
            {panel ? (
              <SidePanel
                panel={panel}
                active={active}
                close={() => setPanel(null)}
                notify={notify}
                confirm={setConfirm}
              />
            ) : (
              <ConversationInfo active={active} notify={notify} confirm={setConfirm} />
            )}
          </aside>

          {panel && (
            <div
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm xl:hidden"
              onClick={() => setPanel(null)}
            >
              <div
                className="ms-auto h-full w-[min(88vw,360px)] bg-card"
                onClick={(e) => e.stopPropagation()}
              >
                {
                  <SidePanel
                    panel={panel}
                    active={active}
                    close={() => setPanel(null)}
                    notify={notify}
                    confirm={setConfirm}
                  />
                }
              </div>
            </div>
          )}
          {toast && (
            <div
              role="status"
              className="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-lg border border-border bg-popover px-4 py-2 text-sm shadow-xl"
            >
              {toast}
            </div>
          )}
          <ConfirmDialog
            data={confirm}
            close={() => setConfirm(null)}
            confirm={() =>
              confirm?.type === "delete"
                ? deleteMessage()
                : (notify(confirm?.type === "ban" ? "عضو مسدود شد" : "عضو از گروه حذف شد"),
                  setConfirm(null))
            }
          />
        </div>
      </main>
    </TooltipProvider>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn("h-14 flex-col gap-1 text-[11px]", active && "text-primary")}
    >
      {icon}
      {label}
    </Button>
  );
}
function IconTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ChatBubble({
  message,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onForward,
}: {
  message: ChatMessage;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: () => void;
  onForward: () => void;
}) {
  return (
    <Message
      from={message.mine ? "user" : "assistant"}
      className={cn(
        "max-w-[86%] gap-1",
        message.mine ? "ml-0 mr-auto items-end" : "ml-auto mr-0 items-start",
      )}
    >
      {!message.mine && (
        <span className="px-1 text-[11px] font-bold text-read">{message.sender}</span>
      )}
      <div className="group/bubble flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover/bubble:opacity-100 focus:opacity-100"
              aria-label="عملیات پیام"
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={message.mine ? "start" : "end"}>
            <DropdownMenuItem onClick={onReply}>
              <Reply /> پاسخ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReact}>
              <span>❤️</span> واکنش
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onForward}>
              <Forward /> ارسال به…
            </DropdownMenuItem>
            {message.mine && message.text && (
              <DropdownMenuItem onClick={onEdit}>
                <Edit3 /> ویرایش
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 /> حذف پیام
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <MessageContent
          className={cn(
            "relative rounded-lg border px-3 py-2 shadow-sm",
            message.mine
              ? "border-primary/30 bg-chat-own text-chat-own-foreground"
              : "border-border bg-chat-raised text-foreground",
          )}
        >
          {message.reply && (
            <div className="mb-1 border-r-2 border-read bg-background/15 px-2 py-1 text-[11px] opacity-80">
              {message.reply}
            </div>
          )}
          {message.voice ? (
            <VoiceMessage duration={message.duration ?? 30} mine={Boolean(message.mine)} />
          ) : (
            <p className="whitespace-pre-wrap leading-6">{message.text}</p>
          )}
          <div
            className={cn(
              "mt-1 flex items-center justify-end gap-1 text-[10px]",
              message.mine ? "text-chat-own-foreground/75" : "text-muted-foreground",
            )}
          >
            <span>{message.time}</span>
            {message.mine && <CheckCheck className="size-3 text-read" />}
          </div>
          {message.reaction && (
            <button
              onClick={onReact}
              aria-label="حذف واکنش"
              className="absolute -bottom-3 left-2 rounded-full border border-border bg-popover px-2 py-0.5 text-[11px] shadow"
            >
              {message.reaction}
            </button>
          )}
        </MessageContent>
      </div>
    </Message>
  );
}

function VoiceMessage({ duration, mine }: { duration: number; mine?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(22);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setProgress((p) => (p >= 100 ? (setPlaying(false), 0) : p + speed * 2)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  const bars = useMemo(
    () => [
      9, 15, 22, 13, 28, 18, 11, 25, 31, 16, 22, 10, 27, 19, 14, 29, 21, 12, 25, 17, 30, 15, 23, 11,
      19, 27, 14, 22,
    ],
    [],
  );
  const cycle = () => setSpeed((s) => (s === 2 ? 0.5 : s === 0.5 ? 1 : s + 0.5));
  return (
    <div className="flex min-w-[230px] items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full bg-background/15"
        aria-label={playing ? "توقف" : "پخش"}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="min-w-0 flex-1">
        <button
          className="flex h-8 w-full items-center gap-0.5"
          aria-label="جابه‌جایی در پیام صوتی"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setProgress(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
          }}
        >
          {bars.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-1 rounded-full",
                (i / bars.length) * 100 < progress
                  ? mine
                    ? "bg-chat-own-foreground"
                    : "bg-primary"
                  : "bg-muted-foreground/45",
              )}
              style={{ height: h }}
            />
          ))}
        </button>
        <span className="text-[10px] opacity-75">
          ۰:{String(Math.round(duration * (1 - progress / 100))).padStart(2, "0")}
        </span>
      </div>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={cycle}>
        {speed}×
      </Button>
    </div>
  );
}

function ConversationInfo({
  active,
  notify,
  confirm,
}: {
  active: Chat;
  notify: (s: string) => void;
  confirm: (v: { type: "delete" | "remove" | "ban"; name?: string }) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex flex-col items-center py-5">
        <Avatar chat={active} size="lg" />
        <h3 className="mt-3 text-lg font-bold">{active.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {active.kind === "group"
            ? "۱۲ عضو"
            : active.kind === "channel"
              ? "۲۴٫۸ هزار دنبال‌کننده"
              : "@sara_ahmadi"}
        </p>
      </div>
      {active.kind === "group" ? (
        <>
          <ActionRow
            icon={<Link2 />}
            title="لینک دعوت"
            subtitle="arad.chat/join/design"
            action={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="کپی لینک"
                onClick={() => {
                  navigator.clipboard?.writeText("https://arad.chat/join/design");
                  notify("لینک دعوت کپی شد");
                }}
              >
                <Copy />
              </Button>
            }
          />
          <div className="mt-6 flex items-center justify-between">
            <h4 className="text-sm font-bold">اعضا</h4>
            <Button variant="ghost" size="sm" onClick={() => notify("افزودن عضو در نسخه نمایشی")}>
              <Plus /> افزودن
            </Button>
          </div>
          <div className="mt-2 space-y-1">
            {members.map((member) => (
              <div
                key={member.name}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
              >
                <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold">
                  {member.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {member.role}
                    {member.online ? " · آنلاین" : ""}
                  </p>
                </div>
                {member.role === "عضو" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`مدیریت ${member.name}`}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => notify(`${member.name} مدیر شد`)}>
                        <ShieldCheck /> ارتقا به مدیر
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => confirm({ type: "remove", name: member.name })}
                      >
                        <UserMinus /> حذف از گروه
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => confirm({ type: "ban", name: member.name })}
                        className="text-destructive"
                      >
                        <Ban /> مسدود کردن
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <ActionRow
            icon={<Bell />}
            title="اعلان‌ها"
            subtitle="فعال"
            action={<Switch defaultChecked aria-label="اعلان‌های گفتگو" />}
          />
          <ActionRow
            icon={<Search />}
            title="جستجو در گفتگو"
            subtitle="پیام، تصویر یا فایل"
            action={<ChevronLeft className="size-4" />}
          />
        </>
      )}
    </div>
  );
}

function SidePanel({
  panel,
  active,
  close,
  notify,
  confirm,
}: {
  panel: "info" | "settings" | "profile";
  active: Chat;
  close: () => void;
  notify: (s: string) => void;
  confirm: (v: { type: "delete" | "remove" | "ban"; name?: string }) => void;
}) {
  if (panel === "info")
    return (
      <div className="h-full">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <Button variant="ghost" size="icon" aria-label="بستن" onClick={close}>
            <X />
          </Button>
          <h3 className="font-bold">اطلاعات گفتگو</h3>
        </div>
        <ConversationInfo active={active} notify={notify} confirm={confirm} />
      </div>
    );
  if (panel === "profile")
    return (
      <div className="h-full overflow-y-auto p-5">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" aria-label="بستن" onClick={close}>
            <X />
          </Button>
        </div>
        <div className="flex flex-col items-center py-4">
          <div className="relative">
            <div className="grid size-24 place-items-center rounded-full bg-primary text-3xl font-black text-primary-foreground">
              آ
            </div>
            <Button
              size="icon-sm"
              className="absolute bottom-0 left-0 rounded-full"
              aria-label="تغییر تصویر"
            >
              <Camera />
            </Button>
          </div>
          <h2 className="mt-4 text-xl font-bold">آراد حامد</h2>
          <p className="text-sm text-muted-foreground">@arad_hamed</p>
        </div>
        <label className="mt-5 block text-xs text-muted-foreground">نام نمایشی</label>
        <Input className="mt-2" defaultValue="آراد حامد" />
        <label className="mt-4 block text-xs text-muted-foreground">درباره من</label>
        <Input className="mt-2" defaultValue="طراح محصول و توسعه‌دهنده" />
        <Button className="mt-5 w-full" onClick={() => notify("پروفایل ذخیره شد")}>
          ذخیره تغییرات
        </Button>
      </div>
    );
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">تنظیمات</h2>
        <Button variant="ghost" size="icon" aria-label="بستن" onClick={close}>
          <X />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        تنظیمات این نمونه روی دستگاه ذخیره نمی‌شود
      </p>
      <div className="mt-7 space-y-2">
        <ActionRow
          icon={<Bell />}
          title="اعلان‌ها"
          subtitle="پیام و تماس"
          action={<Switch defaultChecked aria-label="اعلان‌ها" />}
        />
        <ActionRow
          icon={<LockKeyhole />}
          title="حریم خصوصی"
          subtitle="آخرین بازدید و تماس‌ها"
          action={<ChevronLeft className="size-4" />}
        />
        <ActionRow
          icon={<Archive />}
          title="داده و حافظه"
          subtitle="۱٫۲ گیگابایت"
          action={<ChevronLeft className="size-4" />}
        />
      </div>
      <Button
        variant="outline"
        className="mt-8 w-full text-destructive"
        onClick={() => notify("خروج در نمونه نمایشی انجام نمی‌شود")}
      >
        <LogOut /> خروج از حساب
      </Button>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border-b border-border p-3">
      <div className="grid size-9 place-items-center rounded-lg bg-muted text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function ConfirmDialog({
  data,
  close,
  confirm,
}: {
  data: { type: "delete" | "remove" | "ban"; id?: number; name?: string } | null;
  close: () => void;
  confirm: () => void;
}) {
  const title =
    data?.type === "delete" ? "حذف پیام" : data?.type === "ban" ? "مسدود کردن عضو" : "حذف عضو";
  return (
    <Dialog open={Boolean(data)} onOpenChange={(open) => !open && close()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader className="text-right">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {data?.type === "delete"
              ? "این پیام از گفتگوی شما حذف می‌شود. این کار قابل بازگشت نیست."
              : `آیا از انجام این کار برای ${data?.name ?? "این عضو"} مطمئن هستید؟`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={close}>
            انصراف
          </Button>
          <Button variant="destructive" onClick={confirm}>
            تأیید
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}