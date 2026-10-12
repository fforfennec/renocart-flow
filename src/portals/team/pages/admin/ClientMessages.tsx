import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Search, Send, Loader2, Mail, Globe, ExternalLink, MessagesSquare, Paperclip, Link2 } from 'lucide-react';

type Att = { name: string; path: string; mime: string; size: number };
type Thread = { id: string; owner_id: string | null; customer_email: string | null; order_id: string | null; subject: string | null; last_message_at: string | null };
type Msg = { id: string; thread_id: string; sender_name: string; sender_role: string; source: string; content: string; attachments: Att[]; created_at: string };
type OrderLite = { id: string; order_number: string; client_name: string; status: string; customer_email: string | null; project_name: string | null; delivery_date: string | null };

const READ_KEY = 'rc-client-messages-read';
const readMap = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); } catch { return {}; } };
const initials = (n: string) => n.split(/[\s@.]+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
};

function AttachmentItem({ a }: { a: Att }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { supabase.storage.from('support-attachments').createSignedUrl(a.path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null)); }, [a.path]);
  if (a.mime.startsWith('image/') && url) return <a href={url} target="_blank" rel="noreferrer" className="block mt-2"><img src={url} alt={a.name} className="rounded-lg max-h-56 max-w-full border" /></a>;
  return <a href={url ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-2 mt-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs"><Paperclip className="h-3.5 w-3.5" />{a.name}</a>;
}

export default function ClientMessages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderLite>>({});
  const [clientOrders, setClientOrders] = useState<OrderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reads, setReads] = useState(readMap());
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data: t } = await supabase.from('support_threads').select('id, owner_id, customer_email, order_id, subject, last_message_at').not('last_message_at', 'is', null).order('last_message_at', { ascending: false });
    const list = (t || []) as Thread[];
    setThreads(list);
    const ids = list.map(x => x.id);
    const { data: m } = ids.length ? await supabase.from('support_messages').select('*').in('thread_id', ids).order('created_at') : { data: [] };
    setMessages((m || []) as unknown as Msg[]);
    const oids = [...new Set(list.map(x => x.order_id).filter(Boolean))] as string[];
    const { data: o } = oids.length ? await supabase.from('orders').select('id, order_number, client_name, status, customer_email, project_name, delivery_date').in('id', oids) : { data: [] };
    setOrders(Object.fromEntries((o || []).map((x: OrderLite) => [x.id, x])));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('client-messages-page').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => load()).subscribe();
    const poll = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  const clientKey = (t: Thread) => (t.customer_email || 'inconnu').toLowerCase();
  const msgsOf = (id: string) => messages.filter(m => m.thread_id === id);
  const lastOf = (id: string) => { const l = msgsOf(id); return l[l.length - 1]; };
  const clientName = (t: Thread) => msgsOf(t.id).find(m => m.sender_role === 'client')?.sender_name || (t.order_id && orders[t.order_id]?.client_name) || t.customer_email || 'Client';
  const isUnread = (t: Thread) => { const l = lastOf(t.id); return !!l && l.sender_role === 'client' && (!reads[t.id] || reads[t.id] < l.created_at); };

  const clients = useMemo(() => {
    const m: Record<string, { key: string; name: string; count: number; unread: number }> = {};
    threads.forEach(t => { const c = m[clientKey(t)] ||= { key: clientKey(t), name: clientName(t), count: 0, unread: 0 }; c.count++; if (isUnread(t)) c.unread++; });
    return Object.values(m).sort((a, b) => a.name.localeCompare(b.name));
  }, [threads, messages, reads, orders]);

  const visible = threads.filter(t => {
    if (clientFilter !== 'all' && clientKey(t) !== clientFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [t.order_id && orders[t.order_id]?.order_number, clientName(t), t.customer_email, t.subject].some(v => v && String(v).toLowerCase().includes(q));
  });

  const active = threads.find(t => t.id === activeId) || null;
  const activeMsgs = active ? msgsOf(active.id) : [];
  const activeOrder = active?.order_id ? orders[active.order_id] : null;

  useEffect(() => {
    if (!active) return;
    const l = lastOf(active.id);
    if (l) { const next = { ...readMap(), [active.id]: l.created_at }; localStorage.setItem(READ_KEY, JSON.stringify(next)); setReads(next); }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    // Orders of this client, for linking the conversation to an order.
    if (active.customer_email) supabase.from('orders').select('id, order_number, client_name, status, customer_email, project_name, delivery_date').ilike('customer_email', active.customer_email).order('created_at', { ascending: false }).limit(100).then(({ data }) => setClientOrders((data || []) as OrderLite[]));
    else setClientOrders([]);
  }, [active?.id, activeMsgs.length]);

  const assign = async (orderId: string) => {
    if (!active) return;
    const id = orderId === 'none' ? null : orderId;
    const o = clientOrders.find(x => x.id === id);
    const { error } = await supabase.from('support_threads').update({ order_id: id, subject: o ? `Commande ${o.order_number}` : active.subject }).eq('id', active.id);
    if (error) return toast.error("Impossible d'assigner la commande");
    toast.success(o ? `Discussion liée à ${o.order_number}` : 'Commande retirée');
    load();
  };

  const send = async () => {
    if (!active || !text.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('support-reply', { body: { thread_id: active.id, content: text.trim() } });
      if (error) throw error;
      setText('');
      if (data && !data.emailed) toast.message('Message envoyé sur le site (pas de courriel pour ce client).');
      load();
    } catch (e) { console.error(e); toast.error("Le message n'a pas pu être envoyé"); }
    finally { setSending(false); }
  };

  const activeName = active ? clientName(active) : '';

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-card">
      <div className="w-56 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b"><h1 className="font-bold text-lg">Messages clients</h1></div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button onClick={() => setClientFilter('all')} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left', clientFilter === 'all' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted')}>
            <MessagesSquare className="h-4 w-4" /><span className="flex-1">Tous</span><span className="text-xs opacity-70">{threads.length}</span>
          </button>
          {clients.map(c => (
            <button key={c.key} onClick={() => setClientFilter(c.key)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left', clientFilter === c.key ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted')}>
              <div className="h-6 w-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">{initials(c.name)}</div>
              <span className="flex-1 truncate">{c.name}</span>
              {c.unread > 0 ? <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{c.unread}</span> : <span className="text-xs opacity-70">{c.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b"><div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher client ou commande…" className="pl-9 rounded-full bg-muted/50 border-0" />
        </div></div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : visible.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10 px-4">Aucune discussion client pour l'instant.</p>
            : visible.map(t => {
              const o = t.order_id ? orders[t.order_id] : null; const l = lastOf(t.id); const unread = isUnread(t); const name = clientName(t);
              return (
                <button key={t.id} onClick={() => setActiveId(t.id)} className={cn('w-full flex gap-3 px-3 py-3 text-left hover:bg-muted/60', activeId === t.id && 'bg-muted')}>
                  <div className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold shrink-0">{initials(name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={cn('truncate flex-1 text-sm', unread ? 'font-bold' : 'font-medium')}>{o?.order_number || 'Sans commande'} · {name}</span>
                      {l && <span className="text-[11px] text-muted-foreground shrink-0">{timeLabel(l.created_at)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cn('text-xs truncate flex-1', unread ? 'text-foreground font-semibold' : 'text-muted-foreground')}>{l ? `${l.sender_role === 'staff' ? 'Vous : ' : ''}${l.content.split('\n')[0]}` : ''}</p>
                      {unread && <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2"><MessagesSquare className="h-10 w-10" /><p>Choisis une conversation</p></div>
        ) : (<>
          <div className="min-h-16 border-b px-4 py-2 flex items-center gap-3 flex-wrap">
            <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold">{initials(activeName)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{activeName}</p>
              <p className="text-xs text-muted-foreground truncate">{active.customer_email}{activeOrder ? ` · ${activeOrder.order_number}${activeOrder.project_name ? ` · ${activeOrder.project_name}` : ''}` : ' · Aucune commande liée'}</p>
            </div>
            {activeOrder && <Badge variant="outline">{activeOrder.status}</Badge>}
            <Select value={active.order_id ?? 'none'} onValueChange={assign}>
              <SelectTrigger className="w-56 h-9"><Link2 className="h-4 w-4 mr-1" /><SelectValue placeholder="Assigner une commande" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune commande</SelectItem>
                {active.order_id && !clientOrders.some(o => o.id === active.order_id) && activeOrder && <SelectItem value={activeOrder.id}>{activeOrder.order_number}</SelectItem>}
                {clientOrders.map(o => <SelectItem key={o.id} value={o.id}>{o.order_number}{o.project_name ? ` · ${o.project_name}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeOrder && <Button asChild variant="ghost" size="sm"><Link to={`/admin/orders/${activeOrder.id}`}><ExternalLink className="h-4 w-4" />Ouvrir</Link></Button>}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
            {activeMsgs.map((m, i) => {
              const prev = activeMsgs[i - 1];
              const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 30 * 60000;
              const mine = m.sender_role === 'staff';
              return (
                <div key={m.id}>
                  {showTime && <p className="text-center text-[11px] text-muted-foreground py-2">{new Date(m.created_at).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                  <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn('rounded-2xl px-4 py-2 max-w-md text-sm whitespace-pre-wrap break-words', mine ? 'bg-secondary text-secondary-foreground rounded-br-md' : 'bg-card border rounded-bl-md')}>
                      {mine && <p className="text-[10px] opacity-70 mb-0.5">{m.sender_name}</p>}
                      {m.content}
                      {(m.attachments || []).map(a => <AttachmentItem key={a.path} a={a} />)}
                      <span className="flex items-center gap-1 text-[10px] opacity-70 mt-1">{m.source === 'email' ? <><Mail className="h-3 w-3" />via courriel</> : <><Globe className="h-3 w-3" />via le site</>}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-3 flex gap-2 items-end">
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={1}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Répondre à ${activeName} — visible sur le site et envoyé par courriel`} className="resize-none rounded-2xl min-h-[42px] max-h-32" />
            <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="rounded-full h-[42px] w-[42px] shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </>)}
      </div>
    </div>
  );
}
