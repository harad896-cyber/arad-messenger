import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { loadMembers, startCall, supabase, updateCall, sendCallSignal } from "@/lib/messenger";

type Props = {
  userId: string;
  profile: any;
  conversation: any;
  type?: "voice" | "video";
  incoming?: boolean;
  incomingSession?: any;
  onClose: () => void;
};

export function CallOverlay({ userId, profile, conversation, type = "voice", incoming = false, incomingSession, onClose }: Props) {
  const [session, setSession] = useState<any>(incomingSession ?? null);
  const [status, setStatus] = useState(incoming ? "تماس ورودی" : "در حال اتصال...");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(type === "video");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const pc = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const remote = useRef<HTMLVideoElement | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    let active = true;
    const channel = supabase.channel(`call-${incomingSession?.id ?? session?.id ?? crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals" }, async (payload: any) => {
        const row = payload.new;
        if (!active || !session || row.session_id !== session.id || row.sender_id === userId) return;
        try {
          if (row.kind === "offer" && row.payload?.sdp) {
            await ensurePeer(false);
            await pc.current!.setRemoteDescription(new RTCSessionDescription(row.payload.sdp));
            for (const c of pendingCandidates.current.splice(0)) await pc.current!.addIceCandidate(c);
            const answer = await pc.current!.createAnswer();
            await pc.current!.setLocalDescription(answer);
            await updateCall(session.id, { answer_sdp: JSON.stringify(answer), status: "accepted", accepted_at: new Date().toISOString() });
            await sendCallSignal(session.id, userId, "answer", { sdp: answer });
            setStatus("در حال برقراری...");
          } else if (row.kind === "answer" && row.payload?.sdp) {
            if (!pc.current) return;
            await pc.current.setRemoteDescription(new RTCSessionDescription(row.payload.sdp));
            for (const c of pendingCandidates.current.splice(0)) await pc.current.addIceCandidate(c);
            setStatus("متصل");
          } else if (row.kind === "ice" && row.payload) {
            const candidate = row.payload as RTCIceCandidateInit;
            if (pc.current?.remoteDescription) await pc.current.addIceCandidate(candidate);
            else pendingCandidates.current.push(candidate);
          } else if (row.kind === "hangup") {
            await finish(false);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "خطای تماس");
        }
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); cleanup(); };
  }, [session?.id, userId]);

  async function ensurePeer(initiator: boolean) {
    if (pc.current) return pc.current;
    const connection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    connection.onicecandidate = (e) => {
      if (e.candidate && session) void sendCallSignal(session.id, userId, "ice", e.candidate.toJSON());
    };
    connection.ontrack = (e) => {
      if (remote.current) remote.current.srcObject = e.streams[0];
    };
    connection.onconnectionstatechange = () => {
      const s = connection.connectionState;
      if (s === "connected") { setConnected(true); setStatus("متصل"); }
      if (s === "failed") setStatus("اتصال ناموفق؛ شبکه یا TURN لازم است.");
      if (s === "disconnected") setStatus("اتصال ناپایدار...");
    };
    pc.current = connection;
    try {
      const local = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      stream.current = local;
      local.getTracks().forEach((t) => connection.addTrack(t, local));
      if (initiator) {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        if (!session) throw new Error("جلسه تماس ساخته نشده");
        await updateCall(session.id, { offer_sdp: JSON.stringify(offer) });
        await sendCallSignal(session.id, userId, "offer", { sdp: offer });
      }
    } catch (e) {
      throw e;
    }
    return connection;
  }

  useEffect(() => {
    if (incoming || session) return;
    let cancelled = false;
    (async () => {
      try {
        const members = await loadMembers(conversation.id);
        const callee = members.find((m: any) => m.user_id !== userId)?.user_id;
        if (!callee) throw new Error("طرف مقابل پیدا نشد");
        const created = await startCall(conversation.id, userId, callee, type);
        if (cancelled) return;
        setSession(created);
        await ensurePeer(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "شروع تماس ناموفق بود");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function accept() {
    try {
      setStatus("در حال اتصال...");
      await ensurePeer(false);
      if (session) await updateCall(session.id, { status: "accepted", accepted_at: new Date().toISOString() });
    } catch (e) { setError(e instanceof Error ? e.message : "پذیرش تماس ناموفق بود"); }
  }

  async function reject() {
    if (session) await updateCall(session.id, { status: "rejected", ended_at: new Date().toISOString() }).catch(() => {});
    onClose();
  }

  async function finish(send = true) {
    if (send && session) await sendCallSignal(session.id, userId, "hangup", {});
    if (session) await updateCall(session.id, { status: "ended", ended_at: new Date().toISOString() }).catch(() => {});
    cleanup();
    onClose();
  }

  function cleanup() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    pc.current?.close();
    pc.current = null;
  }

  function toggleMute() {
    const track = stream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  function toggleCamera() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamera(track.enabled);
  }

  return <div dir="rtl" className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4">
    <div className="relative flex h-full max-h-[760px] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-zinc-950 text-white shadow-2xl">
      {type === "video" && <video ref={remote} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />}
      <div className="relative flex items-center gap-3 p-5"><div className="grid size-12 place-items-center rounded-full bg-primary text-xl font-bold">{String(conversation?.title ?? "آ").slice(0,1)}</div><div><div className="font-bold">{conversation?.title ?? "تماس"}</div><div className="text-xs opacity-70">{status}</div></div></div>
      {type === "voice" && <div className="relative flex flex-1 flex-col items-center justify-center"><div className="grid size-36 place-items-center rounded-full bg-primary/20 ring-1 ring-primary/30"><Phone className="size-12 text-primary" /></div><p className="mt-6 text-sm opacity-70">{connected ? "تماس برقرار است" : status}</p></div>}
      {type === "video" && !connected && <div className="relative flex flex-1 items-center justify-center"><p className="rounded-xl bg-black/50 px-4 py-2 text-sm">{status}</p></div>}
      {error && <div className="relative mx-4 mb-3 rounded-xl bg-red-500/20 p-3 text-xs text-red-200">{error}</div>}
      <div className="relative flex items-center justify-center gap-3 p-5">
        {incoming ? <><button className="grid size-14 place-items-center rounded-full bg-green-600" onClick={()=>void accept()}><Phone/></button><button className="grid size-14 place-items-center rounded-full bg-red-600" onClick={()=>void reject()}><PhoneOff/></button></> :
        <><button className={`grid size-12 place-items-center rounded-full ${muted?"bg-white text-black":"bg-white/10"}`} onClick={toggleMute}>{muted?<MicOff/>:<Mic/>}</button>{type==="video"&&<button className={`grid size-12 place-items-center rounded-full ${camera?"bg-white/10":"bg-white text-black"}`} onClick={toggleCamera}>{camera?<Video/>:<VideoOff/>}</button>}<button className="grid size-14 place-items-center rounded-full bg-red-600" onClick={()=>void finish()}><PhoneOff/></button></>}
      </div>
    </div>
  </div>;
}
