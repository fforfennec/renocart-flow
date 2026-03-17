import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { AssignmentInfo, getStatusBadge, isLate, LateBadge, getSupplierInitial, getSupplierName } from './OrderCard';

type Order = Database['public']['Tables']['orders']['Row'];

interface Props {
  orders: Order[];
  assignmentsByOrder: Record<string, AssignmentInfo[]>;
  onOrderRead?: (orderId: string) => void;
}

export default function OrderListView({ orders, assignmentsByOrder }: Props) {
  const navigate = useNavigate();

  return (
    <>
      {/* Column Headers */}
      <div className="flex items-center gap-2 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <div className="flex-1">Order</div>
        <div className="w-10 text-center" title="Supplier"><Package className="h-3.5 w-3.5 mx-auto" /></div>
        <div className="w-10 text-center" title="DSP"><Truck className="h-3.5 w-3.5 mx-auto" /></div>
        <div className="w-20 text-right">Created</div>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const assignments = assignmentsByOrder[order.id] || [];
          const materialSuppliers = assignments.filter(a => a.assignment_type === 'material');
          const dspSuppliers = assignments.filter(a => a.assignment_type === 'delivery');

          return (
            <div
              key={order.id}
              onClick={() => navigate(`/admin/orders/${order.id}`)}
              className="bg-background border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-rc-navy">{order.order_number}</h3>
                  {getStatusBadge(order.status)}
                  {isLate(order.delivery_date, order.status) && <LateBadge />}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><span className="font-medium">Client:</span> {order.client_name}</p>
                  <p><span className="font-medium">Address:</span> {order.client_address}</p>
                  <p><span className="font-medium">Delivery:</span> {new Date(order.delivery_date).toLocaleDateString()} - {order.delivery_time_window}</p>
                  {order.truck_type && <p><span className="font-medium">Truck:</span> {order.truck_type}</p>}
                </div>
              </div>

              {/* Supplier column */}
              <div className="w-10 flex flex-col items-center justify-center gap-1 shrink-0">
                {materialSuppliers.length > 0 ? materialSuppliers.map((s, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {getSupplierInitial(s)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{getSupplierName(s)}</TooltipContent>
                  </Tooltip>
                )) : (
                  <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* DSP column */}
              <div className="w-10 flex flex-col items-center justify-center gap-1 shrink-0">
                {dspSuppliers.length > 0 ? dspSuppliers.map((s, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className="h-8 w-8 rounded-full bg-accent/50 flex items-center justify-center text-xs font-bold text-accent-foreground">
                        {getSupplierInitial(s)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{getSupplierName(s)}</TooltipContent>
                  </Tooltip>
                )) : (
                  <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* Date column */}
              <div className="w-20 text-right shrink-0">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
