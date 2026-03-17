import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';
import { AssignmentInfo, isLate, LateBadge } from './OrderCard';
import { ScrollArea } from '@/components/ui/scroll-area';

type Order = Database['public']['Tables']['orders']['Row'];

interface Props {
  orders: Order[];
  assignmentsByOrder: Record<string, AssignmentInfo[]>;
}

const COLUMNS = [
  { key: 'pending', label: 'New', color: 'bg-muted' },
  { key: 'in_progress', label: 'Contacted', color: 'bg-primary/10' },
  { key: 'on_hold', label: 'On Hold', color: 'bg-warning/10' },
  { key: 'delivered', label: 'Done', color: 'bg-success/10' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-destructive/10' },
];

export default function OrderBoardView({ orders, assignmentsByOrder }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const columnOrders = orders.filter(o => o.status === col.key);
        return (
          <div key={col.key} className="min-w-[260px] w-[260px] shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {columnOrders.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnOrders.map((order) => {
                const assignments = assignmentsByOrder[order.id] || [];
                const supplier = assignments.find(a => a.assignment_type === 'material');
                const dsp = assignments.find(a => a.assignment_type === 'delivery');

                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className="bg-background border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-rc-navy">{order.order_number}</span>
                      {isLate(order.delivery_date, order.status) && <LateBadge />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{order.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.delivery_date).toLocaleDateString()} · {order.delivery_time_window}
                    </p>
                    {(supplier || dsp) && (
                      <div className="flex gap-1 pt-1">
                        {supplier && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium truncate max-w-[110px]">
                            {(supplier.profiles as any)?.company_name || (supplier.profiles as any)?.full_name || '?'}
                          </span>
                        )}
                        {dsp && (
                          <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-medium truncate max-w-[110px]">
                            {(dsp.profiles as any)?.company_name || (dsp.profiles as any)?.full_name || '?'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {columnOrders.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No orders</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
