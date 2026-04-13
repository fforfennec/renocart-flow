import { useNavigate } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { AssignmentInfo, isLate, LateBadge } from './OrderCard';
import { Badge } from '@/components/ui/badge';
import { Clock, Mail, Users, HandMetal, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

type Order = Database['public']['Tables']['orders']['Row'];

type AutomationLane = 'waiting_priority' | 'waiting_broadcast' | 'fulfilling' | 'manual';

interface Props {
  orders: Order[];
  assignmentsByOrder: Record<string, AssignmentInfo[]>;
  responsesByOrder?: Record<string, { status: string; escalated_at: string | null; priority_rank: number | null }[]>;
}

function getAutomationLane(order: Order, assignments: AssignmentInfo[], responses?: { status: string; escalated_at: string | null; priority_rank: number | null }[]): AutomationLane {
  // Fulfilling = in_progress or any response confirmed
  if (order.status === 'in_progress') return 'fulfilling';

  // Check if there are escalated responses (broadcast phase)
  const hasEscalated = responses?.some(r => r.escalated_at !== null);
  const hasBroadcast = (assignments?.length || 0) > 1 || hasEscalated;

  if (order.status === 'pending' && (!assignments || assignments.length === 0)) {
    return 'waiting_priority'; // not yet assigned
  }

  if (order.status === 'assigned' || order.status === 'pending') {
    if (hasBroadcast) return 'waiting_broadcast';
    return 'waiting_priority';
  }

  if (order.status === 'on_hold') return 'manual';

  return 'manual';
}

function useMinutesAgo(date: string) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const calc = () => setMins(Math.floor((Date.now() - new Date(date).getTime()) / 60000));
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [date]);
  return mins;
}

function MiniOrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  const mins = useMinutesAgo(order.created_at);
  const late = isLate(order.delivery_date, order.status);

  const formatTime = (m: number) => {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}h${r > 0 ? r + 'm' : ''}`;
  };

  return (
    <button
      onClick={() => navigate(`/admin/orders/${order.id}`)}
      className="w-full text-left bg-card border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-foreground">{order.order_number}</span>
        <div className="flex items-center gap-1">
          {late && <LateBadge />}
          <Badge variant="outline" className={`text-[10px] gap-0.5 ${mins > 60 ? 'border-destructive text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="h-2.5 w-2.5" />
            {formatTime(mins)}
          </Badge>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground truncate">{order.client_name}</p>
      <p className="text-[10px] text-muted-foreground/70 truncate">{order.client_address}</p>
    </button>
  );
}

const LANES: { key: AutomationLane; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'waiting_priority', label: 'Prioritaire', icon: <Mail className="h-4 w-4" />, color: 'bg-secondary text-secondary-foreground' },
  { key: 'waiting_broadcast', label: 'Broadcast', icon: <Users className="h-4 w-4" />, color: 'bg-primary/10 text-primary' },
  { key: 'fulfilling', label: 'Fulfilling', icon: <ArrowRight className="h-4 w-4" />, color: 'bg-green-100 text-green-700' },
  { key: 'manual', label: 'Manuel', icon: <HandMetal className="h-4 w-4" />, color: 'bg-destructive/10 text-destructive' },
];

export default function OrderAutomationView({ orders, assignmentsByOrder, responsesByOrder }: Props) {
  const laneOrders: Record<AutomationLane, Order[]> = {
    waiting_priority: [],
    waiting_broadcast: [],
    fulfilling: [],
    manual: [],
  };

  orders.forEach(order => {
    const assignments = assignmentsByOrder[order.id] || [];
    const responses = responsesByOrder?.[order.id];
    const lane = getAutomationLane(order, assignments, responses);
    laneOrders[lane].push(order);
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      {LANES.map(lane => (
        <div key={lane.key} className="space-y-2">
          {/* Lane header */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className={`rounded-md p-1.5 ${lane.color} shrink-0`}>
              {lane.icon}
            </div>
            <span className="text-sm font-semibold text-foreground">{lane.label}</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {laneOrders[lane.key].length}
            </Badge>
          </div>

          {/* Order cards */}
          <div className="space-y-2 min-h-[100px]">
            {laneOrders[lane.key].length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-6">Aucune commande</p>
            ) : (
              laneOrders[lane.key].map(order => (
                <MiniOrderCard key={order.id} order={order} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
