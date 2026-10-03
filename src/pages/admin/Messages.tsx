import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Search, Send, Loader2, Mail, ExternalLink, MessagesSquare, CheckCircle2, XCircle, PencilLine, Paperclip } from 'lucide-react';

type Att = { name: string; path: string; mime: string; size: number };

function AttachmentItem({ a }: { a: Att }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from('order-attachments').createSignedUrl(a.path, 3600, a.mime.startsWith('image/') ? undefined : { download: a.name }).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [a.path]);
  if (a.mime.startsWith('image/') && url) return (
    <a href={url} target="_blank" rel="noreferrer" className="block mt-2"><img src={url} alt={a.name} className="rounded-lg max-h-56 max-w-full object-cover border" /></a>
  );
  return (
    <a href={url ?? undefined} download={a.name} className="flex items-center gap-2 mt-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs hover:bg-muted">
      <Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{a.name}</span><span className="text-muted-foreground shrink-0">{Math.max(1, Math.round(a.size / 1024))} Ko</span>
    </a>
  );
}

type Msg = {
  id: string; order_id: string; supplier_id: string | null; sender_name: string; content: string;
  created_at: string; source: string; kind: string; user_id: string; attachments?: Att[] | null;
};
type OrderLite = { id: string; order_number: string; client_name: string; status: string; delivery_date: string | null };
type Conversation = { key: string; orderId: string; supplierId: string; messages: Msg[]; last: Msg };

const READ_KEY = 'rc-messages-read';
const readMap = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); } catch { return {}; } };

const initials = (n: string) => n.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
const timeLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
};
const isFromSupplier = (m: Msg) => m.source === 'email' || m.source === 'action';

function Avatar({ name, logo, className }: { name: string; logo?: string | null; className?: string }) {
  return logo ? (
    <img src={logo} alt={name} className={cn('rounded-full object-contain bg-card border', className)} />
  ) : (
    <div className={cn('rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold text-xs', className)}>{initials(name)}</div>
  );
}

export default function Messages() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderLite>>({});
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reads, setReads] = useState(readMap());
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data: msgs } = await supabase
      .from('order_messages')
      .select('id, order_id, supplier_id, sender_name, content, created_at, source, kind, user_id, attachments')
      .not('supplier_id', 'is', null)
      .order('created_at', { ascending: true });
    const list = (msgs || []) as unknown as Msg[];
    setMessages(list);

    const orderIds = [...new Set(list.map(m => m.order_id))];
    const supplierIds = [...new Set(list.map(m => m.supplier_id!))];
    const [{ data: ords }, { data: profs }, { data: sups }] = await Promise.all([
      orderIds.length ? supabase.from('orders').select('id, order_number, client_name, status, delivery_date').in('id', orderIds) : Promise.resolve({ data: [] as OrderLite[] }),
      supplierIds.length ? supabase.from('profiles').select('user_id, full_name, company_name').in('user_id', supplierIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from('suppliers').select('id, name, logo_url'),
    ]);
    // Resolve the real supplier company from the email address used in the thread
    const [{ data: threads }, { data: contacts }] = await Promise.all([
      supplierIds.length ? supabase.from('supplier_email_threads').select('supplier_id, supplier_email').in('supplier_id', supplierIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from('supplier_contacts').select('email, supplier_id'),
    ]);
    const supNameById: Record<string, string> = {};
    (sups || []).forEach((s: any) => { supNameById[s.id] = s.name; });
    const supByEmail: Record<string, string> = {};
    (contacts || []).forEach((c: any) => { if (c.email) supByEmail[c.email.toLowerCase()] = supNameById[c.supplier_id]; });
    setOrders(Object.fromEntries((ords || []).map(o => [o.id, o])));
    const names: Record<string, string> = {};
    (profs || []).forEach((p: any) => { names[p.user_id] = p.company_name || p.full_name; });
    (threads || []).forEach((t: any) => { const n = t.supplier_email && supByEmail[t.supplier_email.toLowerCase()]; if (n) names[t.supplier_id] = n; });
    setSupplierNames(names);
    const logoByName: Record<string, string> = {};
    (sups || []).forEach((s: any) => { if (s.logo_url) logoByName[s.name.toLowerCase()] = s.logo_url; });
    const l: Record<string, string> = {};
    Object.entries(names).forEach(([id, n]) => { if (n && logoByName[n.toLowerCase()]) l[id] = logoByName[n.toLowerCase()]; });
    setLogos(l);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('messages-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages' }, () => load())
      .subscribe();
    const poll = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  const conversations = useMemo(() => {
    const map: Record<string, Conversation> = {};
    messages.forEach(m => {
      const key = `${m.order_id}:${m.supplier_id}`;
      if (!map[key]) map[key] = { key, orderId: m.order_id, supplierId: m.supplier_id!, messages: [], last: m };
      map[key].messages.push(m);
      map[key].last = m;
    });
    return Object.values(map).sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [messages]);

  const nameOf = (id: string, fallback?: string) => supplierNames[id] || fallback || 'Fournisseur';
  const isUnread = (c: Conversation) => isFromSupplier(c.last) && (!reads[c.key] || reads[c.key] < c.last.created_at);

  const suppliers = useMemo(() => {
    const m: Record<string, { id: string; name: string; count: number; unread: number }> = {};
    conversations.forEach(c => {
      const s = m[c.supplierId] ||= { id: c.supplierId, name: nameOf(c.supplierId), count: 0, unread: 0 };
      s.count++; if (isUnread(c)) s.unread++;
    });
    return Object.values(m).sort((a, b) => a.name.localeCompare(b.name));
  }, [conversations, supplierNames, reads]);

  const visible = conversations.filter(c => {
    if (supplierFilter !== 'all' && c.supplierId !== supplierFilter) return false;
    if (!search) return true;
    const o = orders[c.orderId];
    const q = search.toLowerCase();
    return [o?.order_number, o?.client_name, nameOf(c.supplierId)].some(v => v?.toLowerCase().includes(q));
  });

  const active = conversations.find(c => c.key === activeKey) || null;

  useEffect(() => {
    if (!active) return;
    const next = { ...readMap(), [active.key]: active.last.created_at };
    localStorage.setItem(READ_KEY, JSON.stringify(next));
    setReads(next);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [active?.key, active?.last.id]);

  const send = async () => {
    if (!active || !text.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-supplier-email', {
        body: { order_id: active.orderId, supplier_id: active.supplierId, content: text.trim() },
      });
      if (error) throw error;
      setText('');
      load();
    } catch (e) {
      console.error(e);
      toast.error("Le message n'a pas pu être envoyé");
    } finally {
      setSending(false);
    }
  };

  const activeOrder = active ? orders[active.orderId] : null;
  const activeName = active ? nameOf(active.supplierId, active.messages.find(isFromSupplier)?.sender_name) : '';

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-card">
      {/* Suppliers filter */}
      <div className="w-56 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b"><h1 className="font-bold text-lg">Messages</h1></div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button onClick={() => setSupplierFilter('all')} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left', supplierFilter === 'all' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted')}>
            <MessagesSquare className="h-4 w-4" /><span className="flex-1">Tous</span><span className="text-xs opacity-70">{conversations.length}</span>
          </button>
          {suppliers.map(s => (
            <button key={s.id} onClick={() => setSupplierFilter(s.id)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left', supplierFilter === s.id ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted')}>
              <Avatar name={s.name} logo={logos[s.id]} className="h-6 w-6 text-[10px]" />
              <span className="flex-1 truncate">{s.name}</span>
              {s.unread > 0 ? <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{s.unread}</span> : <span className="text-xs opacity-70">{s.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une commande…" className="pl-9 rounded-full bg-muted/50 border-0" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : visible.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10 px-4">Aucune conversation. Elles apparaissent dès qu'une commande est envoyée à un fournisseur.</p>
            : visible.map(c => {
              const o = orders[c.orderId];
              const unread = isUnread(c);
              const name = nameOf(c.supplierId, c.messages.find(isFromSupplier)?.sender_name);
              return (
                <button key={c.key} onClick={() => setActiveKey(c.key)} className={cn('w-full flex gap-3 px-3 py-3 text-left hover:bg-muted/60', activeKey === c.key && 'bg-muted')}>
                  <Avatar name={name} logo={logos[c.supplierId]} className="h-11 w-11 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={cn('truncate flex-1 text-sm', unread ? 'font-bold' : 'font-medium')}>{o?.order_number || 'Commande'} · {name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{timeLabel(c.last.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cn('text-xs truncate flex-1', unread ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                        {isFromSupplier(c.last) ? '' : 'Vous : '}{c.last.content.split('\n')[0]}
                      </p>
                      {unread && <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <MessagesSquare className="h-10 w-10" />
            <p>Choisis une conversation</p>
          </div>
        ) : (
          <>
            <div className="h-16 border-b px-4 flex items-center gap-3">
              <Avatar name={activeName} logo={logos[active.supplierId]} className="h-10 w-10" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{activeName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Commande {activeOrder?.order_number} · {activeOrder?.client_name}{activeOrder?.delivery_date ? ` · Livraison ${activeOrder.delivery_date}` : ''}
                </p>
              </div>
              {activeOrder && <Badge variant="outline">{activeOrder.status}</Badge>}
              <Button asChild variant="ghost" size="sm"><Link to={`/admin/orders/${active.orderId}`}><ExternalLink className="h-4 w-4" />Ouvrir la commande</Link></Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
              {active.messages.map((m, i) => {
                const prev = active.messages[i - 1];
                const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 30 * 60000;
                const time = showTime && <p className="text-center text-[11px] text-muted-foreground py-2">{new Date(m.created_at).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}</p>;

                if (m.kind === 'dispatch') return (
                  <div key={m.id}>{time}<div className="flex justify-center"><div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1.5 max-w-md"><Mail className="h-3.5 w-3.5 shrink-0" />{m.content.replace(/^📧\s*/, '')}</div></div></div>
                );
                if (m.kind.startsWith('action_')) {
                  const cfg = m.kind === 'action_accept' ? { I: CheckCircle2, c: 'border-success/40 bg-success/10 text-success' }
                    : m.kind === 'action_decline' ? { I: XCircle, c: 'border-destructive/40 bg-destructive/10 text-destructive' }
                    : { I: PencilLine, c: 'border-warning/50 bg-warning/10 text-warning' };
                  return (
                    <div key={m.id}>{time}<div className="flex justify-start"><div className={cn('border rounded-2xl px-4 py-3 max-w-md', cfg.c)}>
                      <div className="flex items-center gap-2 font-semibold text-sm"><cfg.I className="h-4 w-4" />Réponse via bouton</div>
                      <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{m.content.replace(/^[✅❌✏️]\uFE0F?\s*/u, '')}</p>
                    </div></div></div>
                  );
                }
                const mine = !isFromSupplier(m);
                return (
                  <div key={m.id}>{time}
                    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('rounded-2xl px-4 py-2 max-w-md text-sm whitespace-pre-wrap break-words', mine ? 'bg-secondary text-secondary-foreground rounded-br-md' : 'bg-card border rounded-bl-md')}>
                        {m.content}
                        {(m.attachments || []).map((a) => <AttachmentItem key={a.path} a={a} />)}
                        {m.source === 'email' && <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1"><Mail className="h-3 w-3" />par courriel</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3 flex gap-2 items-end">
              <Textarea
                value={text} onChange={e => setText(e.target.value)} rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={`Écrire à ${activeName} — envoyé dans son fil de courriels`}
                className="resize-none rounded-2xl min-h-[42px] max-h-32"
              />
              <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="rounded-full h-[42px] w-[42px] shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
