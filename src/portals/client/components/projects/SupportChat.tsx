import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, MessageSquarePlus, Paperclip, Send, HelpCircle, Folder } from "lucide-react";
import { type ClientProject, type InvoiceOrder, fmtDay } from "@/lib/clientProjects";
import { StatusBadge } from "./OrderTracking";

type Att = { name: string; path: string; mime: string; size: number };
type Thread = { id: string; order_id: string | null; subject: string | null; last_message_at: string | null; created_at: string };
type Msg = { id: string; thread_id: string; sender_name: string; sender_role: string; source: string; content: string; attachments: Att[]; created_at: string };

const READ_KEY = "rc-support-read";
const readMap = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(READ_KEY) || "{}"); } catch { return {}; } };

function AttachmentItem({ a }: { a: Att }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { supabase.storage.from("support-attachments").createSignedUrl(a.path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null)); }, [a.path]);
  if (a.mime.startsWith("image/") && url) return <a href={url} target="_blank" rel="noreferrer" className="block mt-2"><img src={url} alt={a.name} className="rounded-lg max-h-48 max-w-full border" /></a>;
  return <a href={url ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-2 mt-2 text-xs underline"><Paperclip className="h-3.5 w-3.5" />{a.name}</a>;
}

async function upload(userId: string, files: File[]): Promise<Att[]> {
  const out: Att[] = [];
  for (const f of files) {
    if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} dépasse 20 Mo`); continue; }
    const path = `${userId}/${crypto.randomUUID()}/${f.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("support-attachments").upload(path, f, { contentType: f.type });
    if (error) throw error;
    out.push({ name: f.name, path, mime: f.type || "application/octet-stream", size: f.size });
  }
  return out;
}

export function SupportChat({ orders, projects }: { orders: InvoiceOrder[]; projects: ClientProject[] }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | "new" | null>(null);
  const [pickProject, setPickProject] = useState<string | null>(null);
  const [pickOrder, setPickOrder] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [reads, setReads] = useState(readMap());
  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: t } = await supabase.from("support_threads").select("id, order_id, subject, last_message_at, created_at").not("last_message_at", "is", null).order("last_message_at", { ascending: false });
    setThreads((t || []) as Thread[]);
    const ids = (t || []).map((x) => x.id);
    if (ids.length) {
      const { data: m } = await supabase.from("support_messages").select("*").in("thread_id", ids).order("created_at");
      setMessages((m || []) as unknown as Msg[]);
    } else setMessages([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("client-support").on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));
  const thread = threads.find((t) => t.id === active);
  const threadMsgs = messages.filter((m) => m.thread_id === active);
  const lastOf = (id: string) => [...messages].reverse().find((m) => m.thread_id === id);
  const unread = (id: string) => { const l = lastOf(id); return !!l && l.sender_role === "staff" && (!reads[id] || reads[id] < l.created_at); };

  useEffect(() => {
    if (!thread) return;
    const l = lastOf(thread.id);
    if (l) { const next = { ...readMap(), [thread.id]: l.created_at }; localStorage.setItem(READ_KEY, JSON.stringify(next)); setReads(next); }
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [active, messages.length]);

  const send = async () => {
    if (!user || (!text.trim() && !files.length)) return;
    setSending(true);
    try {
      const atts = await upload(user.id, files);
      if (active === "new") {
        const { data, error } = await supabase.rpc("start_support_thread", { _order_id: pickOrder, _content: text, _attachments: atts });
        if (error) throw error;
        setActive(data as string);
      } else if (active) {
        const { error } = await supabase.rpc("post_support_message", { _thread_id: active, _content: text, _attachments: atts });
        if (error) throw error;
      }
      setText(""); setFiles([]); await load();
    } catch (e) { toast.error((e as Error).message || "Le message n'a pas pu être envoyé"); }
    finally { setSending(false); }
  };

  const visibleOrders = orders.filter((o) => !pickProject || o.project_id === pickProject);
  const composer = (
    <div className="border-t p-3 space-y-2">
      {files.length > 0 && <div className="flex flex-wrap gap-2">{files.map((f, i) => <button key={i} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-xs rounded-full bg-muted px-3 py-1">{f.name} ✕</button>)}</div>}
      <div className="flex gap-2 items-end">
        <input ref={fileRef} type="file" multiple hidden accept="image/*,application/pdf" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-full" onClick={() => fileRef.current?.click()} aria-label="Joindre un fichier"><Paperclip className="h-4 w-4" /></Button>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Écrivez votre message au support…" className="resize-none rounded-2xl min-h-[44px] max-h-32"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button onClick={send} disabled={sending || (!text.trim() && !files.length)} size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Envoyer">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto my-12" />;

  if (active === "new") return (
    <div className="rounded-xl border bg-card flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setActive(null)} aria-label="Retour"><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="font-bold">Nouvelle discussion</h2>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm font-semibold">À propos de quoi nous écrivez-vous ?</p>
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
          <button onClick={() => setPickProject(null)} className={cn("snap-start shrink-0 rounded-full border px-4 py-2 text-sm", !pickProject ? "bg-secondary text-secondary-foreground" : "bg-card")}>Tous les projets</button>
          {projects.map((p) => <button key={p.id} onClick={() => { setPickProject(p.id); setPickOrder(null); }} className={cn("snap-start shrink-0 rounded-full border px-4 py-2 text-sm flex items-center gap-2", pickProject === p.id ? "bg-secondary text-secondary-foreground" : "bg-card")}><Folder className="h-3.5 w-3.5" />{p.name} · {p.code}</button>)}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
          <button onClick={() => setPickOrder(null)} className={cn("snap-start shrink-0 w-44 rounded-xl border p-3 text-left", pickOrder === null ? "border-primary ring-2 ring-primary" : "")}>
            <HelpCircle className="h-5 w-5 mb-2" /><p className="font-bold text-sm">Question générale</p><p className="text-xs text-muted-foreground">Aucune commande précise</p>
          </button>
          {visibleOrders.map((o) => (
            <button key={o.id} onClick={() => setPickOrder(o.id)} className={cn("snap-start shrink-0 w-52 rounded-xl border p-3 text-left space-y-1", pickOrder === o.id ? "border-primary ring-2 ring-primary" : "")}>
              <p className="font-bold text-sm">{o.order_number}</p>
              <p className="text-xs text-muted-foreground truncate">{o.project_name || "Sans projet"}</p>
              <p className="text-xs">{o.delivery_date ? `Livraison ${fmtDay(o.delivery_date)}` : fmtDay(o.created_at)}</p>
              <StatusBadge status={o.status} />
            </button>
          ))}
        </div>
      </div>
      {composer}
    </div>
  );

  if (thread) {
    const o = thread.order_id ? orderById[thread.order_id] : null;
    return (
      <div className="rounded-xl border bg-card flex flex-col h-[70vh]">
        <div className="p-4 border-b flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActive(null)} aria-label="Retour"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0"><h2 className="font-bold truncate">{o ? `Commande ${o.order_number}` : thread.subject || "Question générale"}</h2>
            {o && <p className="text-xs text-muted-foreground">{o.project_name || "Sans projet"}</p>}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
          {threadMsgs.map((m) => {
            const mine = m.sender_role === "client";
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("rounded-2xl px-4 py-2 max-w-md text-sm whitespace-pre-wrap break-words", mine ? "bg-secondary text-secondary-foreground rounded-br-md" : "bg-card border rounded-bl-md")}>
                  {!mine && <p className="text-xs font-bold mb-1">{m.sender_name} · Support RenoCart</p>}
                  {m.content}
                  {(m.attachments || []).map((a) => <AttachmentItem key={a.path} a={a} />)}
                  <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1">{m.source === "email" && <Mail className="h-3 w-3" />}{new Date(m.created_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        {composer}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Écrivez-nous ici, ou répondez au courriel de confirmation de votre commande.</p>
        <Button className="h-11 font-bold shrink-0" onClick={() => { setActive("new"); setPickOrder(null); setPickProject(null); }}><MessageSquarePlus className="h-4 w-4 mr-2" />Nouvelle discussion</Button>
      </div>
      {threads.length === 0 ? <p className="text-center text-muted-foreground py-12">Aucune discussion pour l'instant.</p> : (
        <div className="rounded-xl border bg-card divide-y">
          {threads.map((t) => {
            const o = t.order_id ? orderById[t.order_id] : null; const l = lastOf(t.id); const u = unread(t.id);
            return (
              <button key={t.id} onClick={() => setActive(t.id)} className="w-full text-left p-4 hover:bg-muted/50 flex gap-3 items-center">
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm truncate", u ? "font-black" : "font-semibold")}>{o ? `Commande ${o.order_number}` : t.subject || "Question générale"}{o?.project_name ? ` · ${o.project_name}` : ""}</p>
                  <p className="text-xs text-muted-foreground truncate">{l ? `${l.sender_role === "client" ? "Toi : " : ""}${l.content.split("\n")[0]}` : ""}</p>
                </div>
                {u && <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
