import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink, Minus, X, MessageCircle, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Messages from '@/portals/team/pages/admin/Messages';
import ClientMessages from '@/portals/team/pages/admin/ClientMessages';
import { InboxMessage, unreadMessages, useAdminMessaging } from './AdminMessagingContext';

type WindowState = { message: InboxMessage; minimized: boolean };
export default function OverviewMessageDock() {
  const { messages, reads, ready } = useAdminMessaging();
  const { pathname } = useLocation();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const unread = unreadMessages(messages, reads).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const latest = new Map<string, InboxMessage>();
    unread.forEach(m => latest.set(m.key, m));
    const fresh = [...latest.values()].filter(m => !seen.current.has(m.id));
    messages.forEach(m => seen.current.add(m.id));
    const first = !initialized.current;
    initialized.current = true;
    if (!fresh.length) return;
    setWindows(prev => {
      const next = [...prev];
      fresh.forEach(message => {
        const index = next.findIndex(w => w.message.key === message.key);
        if (index >= 0) next[index] = { message, minimized: first ? next[index].minimized : false };
        else next.push({ message, minimized: first });
      });
      return next.slice(-3);
    });
  }, [messages, reads, ready]);
  if (pathname !== '/admin' && pathname !== '/admin/') return null;
  return <div aria-label="Discussions reçues" className="fixed bottom-0 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-end gap-3 overflow-x-auto">
    {windows.map(({ message: m, minimized }, index) => <section key={m.key} aria-label={`Discussion ${m.name}`} className={`w-[340px] max-w-[calc(100vw-1.5rem)] shrink-0 overflow-hidden rounded-t-lg border bg-card shadow-soft ${index < windows.length - 1 ? 'hidden lg:block' : ''}`}>
      <header className="flex h-12 items-center gap-1 bg-secondary px-2 text-secondary-foreground">
        <Button variant="ghost" onClick={() => setWindows(ws => ws.map(w => w.message.key === m.key ? { ...w, minimized: !w.minimized } : w))} className="min-w-0 flex-1 justify-start text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground" title={minimized ? 'Ouvrir la discussion' : 'Réduire la discussion'}>
          <MessageCircle className="h-4 w-4 shrink-0" /><span className="truncate">{m.name}</span>
          {unreadMessages(messages.filter(msg => msg.key === m.key), reads).length > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{unreadMessages(messages.filter(msg => msg.key === m.key), reads).length}</span>}
        </Button>
        <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground" title="Ouvrir dans Messages"><Link to={`${m.type === 'client' ? '/admin/messages-clients' : '/admin/messages'}?conversation=${encodeURIComponent(m.target)}`}><ExternalLink className="h-4 w-4" /></Link></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground" aria-label={minimized ? 'Ouvrir la discussion' : 'Réduire la discussion'} onClick={() => setWindows(ws => ws.map(w => w.message.key === m.key ? { ...w, minimized: !w.minimized } : w))}>{minimized ? <ChevronUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground" aria-label="Fermer la discussion" onClick={() => setWindows(ws => ws.filter(w => w.message.key !== m.key))}><X className="h-4 w-4" /></Button>
      </header>
      {!minimized && <div className="h-[420px] max-h-[calc(100dvh-8rem)]">{m.type === 'client' ? <ClientMessages compact initialConversation={m.target} /> : <Messages compact initialConversation={m.target} />}</div>}
    </section>)}
  </div>;
}
