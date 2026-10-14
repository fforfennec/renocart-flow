import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/portals/team/TeamAuthContext';
import { toast } from 'sonner';

export type InboxMessage = { id: string; key: string; type: 'supplier' | 'client'; target: string; name: string; content: string; created_at: string; incoming: boolean };
type InboxContext = { messages: InboxMessage[]; reads: Record<string, string>; ready: boolean; markRead: (key: string, at: string) => Promise<void> };
const Context = createContext<InboxContext | null>(null);
export const unreadMessages = (messages: InboxMessage[], reads: Record<string, string>) => messages.filter(m => m.incoming && (!reads[m.key] || m.created_at > reads[m.key]));

export function AdminMessagingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [reads, setReads] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const receiptRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let running = false;
    let again = false;
    const load = async () => {
      if (running) { again = true; return; }
      running = true;
      try {
        const list: InboxMessage[] = [];
        for (const type of ['supplier', 'client'] as const) {
          for (let offset = 0; ; offset += 1000) {
            const result = type === 'supplier'
              ? await supabase.from('order_messages').select('id, order_id, supplier_id, sender_name, content, created_at, source, user_id').not('supplier_id', 'is', null).order('created_at').order('id').range(offset, offset + 999)
              : await supabase.from('support_messages').select('id, thread_id, sender_name, content, created_at, sender_role').order('created_at').order('id').range(offset, offset + 999);
            if (result.error) throw result.error;
            const rows = result.data || [];
            rows.forEach(row => {
              if ('order_id' in row) {
                const target = `${row.order_id}:${row.supplier_id}`;
                list.push({ ...row, type: 'supplier', target, key: `supplier:${target}`, name: row.sender_name, incoming: row.source === 'email' || row.source === 'action' || row.user_id === row.supplier_id });
              } else {
                list.push({ ...row, type: 'client', target: row.thread_id, key: `client:${row.thread_id}`, name: row.sender_name, incoming: row.sender_role === 'client' });
              }
            });
            if (rows.length < 1000) break;
          }
        }
        const { data, error } = await supabase.from('admin_message_reads').select('conversation_key, read_at').eq('user_id', user.id);
        if (error) throw error;
        if (stopped) return;
        const next = Object.fromEntries((data || []).map(r => [r.conversation_key, new Date(r.read_at).toISOString()]));
        Object.entries(receiptRef.current).forEach(([key, at]) => { if (!next[key] || next[key] < at) next[key] = at; });
        receiptRef.current = next;
        setReads(next); setMessages(list); setReady(true);
      } catch (error) { console.error('Inbox refresh failed', error); }
      finally { running = false; if (again && !stopped) { again = false; void load(); } }
    };
    void load();
    const channel = supabase.channel(`admin-inbox-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages' }, () => void load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_message_reads', filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    const timer = setInterval(load, 30000);
    return () => { stopped = true; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [user?.id]);
  const markRead = useCallback(async (key: string, at: string) => {
    if (!user || (receiptRef.current[key] && receiptRef.current[key] >= at)) return;
    const { error } = await supabase.from('admin_message_reads').upsert({ user_id: user.id, conversation_key: key, read_at: at }, { onConflict: 'user_id,conversation_key' });
    if (error) { toast.error('Impossible de marquer les messages comme lus'); return; }
    receiptRef.current = { ...receiptRef.current, [key]: at };
    setReads(receiptRef.current);
  }, [user?.id]);
  const value = useMemo(() => ({ messages, reads, ready, markRead }), [messages, reads, ready, markRead]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminMessaging() {
  const value = useContext(Context);
  if (!value) throw new Error('Admin messaging provider required');
  return value;
}
