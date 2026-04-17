import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Mail, Package, UserPlus, UserMinus, RefreshCw, MessageSquare, CheckCircle2, History } from 'lucide-react';

interface Props {
  orderId: string;
  triggerClassName?: string;
}

interface OrderEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  supplier_name: string | null;
  metadata: any;
  created_at: string;
}

const ICONS: Record<string, any> = {
  created: Package,
  status_changed: RefreshCw,
  supplier_assigned: UserPlus,
  supplier_unassigned: UserMinus,
  email_sent: Mail,
  supplier_responded: CheckCircle2,
  comment: MessageSquare,
  note: MessageSquare,
};

function formatDateGroup(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(date, today)) return "Aujourd'hui";
  if (isSameDay(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OrderTimeline({ orderId, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('order_events' as any)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    setEvents((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    load();
    const channel = supabase
      .channel(`order-events-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events', filter: `order_id=eq.${orderId}` }, (payload) => {
        setEvents(prev => [payload.new as OrderEvent, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  // Group events by day
  const groups: Record<string, OrderEvent[]> = {};
  events.forEach(e => {
    const key = formatDateGroup(new Date(e.created_at));
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={triggerClassName}>
          <History className="h-4 w-4 mr-1.5" />
          Historique
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Chronologie de la commande
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Seuls vous et les autres employés peuvent voir cette chronologie.
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {loading && events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun événement encore.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groups).map(([day, dayEvents]) => (
                <div key={day}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{day}</h3>
                  <div className="relative space-y-4 pl-6 border-l border-border ml-2">
                    {dayEvents.map(event => {
                      const Icon = ICONS[event.event_type] || Clock;
                      const time = new Date(event.created_at).toLocaleTimeString('fr-CA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <div key={event.id} className="relative">
                          <div className="absolute -left-[31px] top-0.5 h-5 w-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
                            <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-snug text-foreground">{event.title}</p>
                              {event.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 break-words">{event.description}</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
