import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, ChevronDown, Send } from 'lucide-react';
import pontMassonLogo from '@/assets/pont-masson-logo.png';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { AssignmentInfo, getStatusBadge, isLate, LateBadge, getSupplierInitial, getSupplierName } from './OrderCard';
import { toast } from 'sonner';

function PontMassonTimeBadge({ assignedAt }: { assignedAt: string }) {
  const [mins, setMins] = useState(() => Math.floor((Date.now() - new Date(assignedAt).getTime()) / 60000));
  useEffect(() => {
    const interval = setInterval(() => setMins(Math.floor((Date.now() - new Date(assignedAt).getTime()) / 60000)), 60000);
    return () => clearInterval(interval);
  }, [assignedAt]);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 border border-yellow-300 rounded px-2 py-0.5">
      <Send className="h-3 w-3" />
      Pont-Masson — {mins < 1 ? '<1' : mins}min
    </span>
  );
}

type Order = Database['public']['Tables']['orders']['Row'];

interface Props {
  orders: Order[];
  assignmentsByOrder: Record<string, AssignmentInfo[]>;
  onOrderRead?: (orderId: string) => void;
  onOrderUpdate?: (orderId: string, updates: Partial<Order>) => void;
}

const ACTION_OPTIONS = [
  { label: 'Assign', value: 'assign' },
  { label: 'Cancel', value: 'cancel' },
  { label: 'Hold', value: 'hold' },
  { label: 'Return', value: 'return' },
];

const STATUS_OPTIONS = [
  { label: 'New', value: 'pending' },
  { label: 'Contacted', value: 'in_progress' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Done', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Returned', value: 'returned' },
];

export default function OrderListView({ orders, assignmentsByOrder, onOrderRead, onOrderUpdate }: Props) {
  const navigate = useNavigate();

  const handleAction = async (e: React.MouseEvent, order: Order, action: string) => {
    e.stopPropagation();
    if (action === 'cancel') {
      await updateStatus(order.id, 'cancelled');
    } else if (action === 'hold') {
      await updateStatus(order.id, 'on_hold');
    } else if (action === 'return') {
      await updateStatus(order.id, 'returned');
    } else if (action === 'assign') {
      navigate(`/admin/orders/${order.id}`);
    }
  };

  const handleStatusChange = async (e: React.MouseEvent, orderId: string, status: string) => {
    e.stopPropagation();
    await updateStatus(orderId, status);
  };

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) {
      toast.error('Failed to update order');
    } else {
      onOrderUpdate?.(orderId, { status });
      toast.success('Order updated');
    }
  };

  return (
    <>
      {/* Column Headers */}
      <div className="flex items-center gap-2 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <div className="flex-1">Order</div>
        <div className="w-28 text-center">Action</div>
        <div className="w-32 text-center">Status</div>
        <div className="w-10 text-center" title="Supplier"><Package className="h-3.5 w-3.5 mx-auto" /></div>
        <div className="w-10 text-center" title="DSP"><Truck className="h-3.5 w-3.5 mx-auto" /></div>
        <div className="w-20 text-right">Created</div>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const assignments = assignmentsByOrder[order.id] || [];
          const materialSuppliers = assignments.filter(a => a.assignment_type === 'material');
          const dspSuppliers = assignments.filter(a => a.assignment_type === 'delivery');

          const isNew = order.status === 'pending';

          const handleClick = async () => {
            if (isNew) {
              onOrderRead?.(order.id);
              await supabase.from('orders').update({ status: 'in_progress' }).eq('id', order.id);
            }
            navigate(`/admin/orders/${order.id}`);
          };

          return (
            <div
              key={order.id}
              onClick={handleClick}
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-2 ${
                isNew ? 'bg-destructive/8 border-destructive/30 ring-1 ring-destructive/20' : 'bg-background'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-rc-navy">{order.order_number}</h3>
                  {getStatusBadge(order.status)}
                  {isLate(order.delivery_date, order.status) && <LateBadge />}
                </div>
                {order.status === 'assigned' && materialSuppliers.length > 0 && materialSuppliers[0].assigned_at && (
                  <PontMassonTimeBadge assignedAt={materialSuppliers[0].assigned_at} />
                )}
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><span className="font-medium">Client:</span> {order.client_name}</p>
                  <p><span className="font-medium">Address:</span> {order.client_address}</p>
                  <p><span className="font-medium">Delivery:</span> {new Date(order.delivery_date).toLocaleDateString()} - {order.delivery_time_window}</p>
                  {order.truck_type && <p><span className="font-medium">Truck:</span> {order.truck_type}</p>}
                </div>
              </div>

              {/* Action dropdown */}
              <div className="w-28 shrink-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 text-xs">
                      Action
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {ACTION_OPTIONS.map((opt) => (
                      <DropdownMenuItem key={opt.value} onClick={(e) => handleAction(e, order, opt.value)}>
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status dropdown */}
              <div className="w-32 shrink-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 text-xs">
                      Status
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={(e) => handleStatusChange(e, order.id, opt.value)}
                        className={order.status === opt.value ? 'bg-accent font-medium' : ''}
                      >
                        {opt.label}
                        {order.status === opt.value && <span className="ml-auto text-primary">●</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Supplier column - clickable */}
              <div className="w-10 flex flex-col items-center justify-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                {materialSuppliers.length > 0 ? materialSuppliers.map((s, i) => {
                  const logoUrl = (s as any).logo_url;
                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <div
                          className="h-8 w-8 rounded-full bg-white border flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                        >
                          {logoUrl ? (
                            <img src={logoUrl} alt={getSupplierName(s)} className="h-6 w-6 object-contain" />
                          ) : (
                            <img src={pontMassonLogo} alt={getSupplierName(s)} className="h-6 w-6 object-contain" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{getSupplierName(s)} — Cliquer pour changer</TooltipContent>
                    </Tooltip>
                  );
                }) : (
                  <div
                    className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* DSP column - clickable */}
              <div className="w-10 flex flex-col items-center justify-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                {dspSuppliers.length > 0 ? dspSuppliers.map((s, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        className="h-8 w-8 rounded-full bg-accent/50 flex items-center justify-center text-xs font-bold text-accent-foreground cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                      >
                        {getSupplierInitial(s)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{getSupplierName(s)} — Cliquer pour changer</TooltipContent>
                  </Tooltip>
                )) : (
                  <div
                    className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
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
