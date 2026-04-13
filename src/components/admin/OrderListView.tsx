import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, ChevronDown, Send, Clock, Plus, Play, Pause } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { AssignmentInfo, getStatusBadge, isLate, LateBadge, getSupplierInitial, getSupplierName } from './OrderCard';
import { toast } from 'sonner';

function ElapsedTimeBadge({ createdAt }: { createdAt: string }) {
  const [mins, setMins] = useState(() => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  useEffect(() => {
    const interval = setInterval(() => setMins(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)), 60000);
    return () => clearInterval(interval);
  }, [createdAt]);
  const label = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60) + 'm' : ''}` : `${Math.floor(mins / 1440)}j`;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-0.5 ${mins > 60 ? 'text-destructive bg-destructive/10 border border-destructive/20' : 'text-muted-foreground bg-muted border'}`}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

type Order = Database['public']['Tables']['orders']['Row'];
type CrmSupplier = { id: string; name: string; type: string; logo_url: string | null };

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
  { label: 'Fulfilling', value: 'in_progress' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Done', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Returned', value: 'returned' },
];

function SupplierPickerBubble({
  orderId,
  assignmentType,
  currentAssignments,
  crmSuppliers,
  onAssigned,
  icon,
}: {
  orderId: string;
  assignmentType: 'material' | 'delivery';
  currentAssignments: AssignmentInfo[];
  crmSuppliers: CrmSupplier[];
  onAssigned: () => void;
  icon: React.ReactNode;
}) {
  const [assigning, setAssigning] = useState(false);
  const filteredSuppliers = crmSuppliers.filter(
    s => s.type === assignmentType || s.type === 'both' || (assignmentType === 'material' && s.type === 'material') || (assignmentType === 'delivery' && s.type === 'delivery')
  );

  const handleSelect = async (supplier: CrmSupplier) => {
    setAssigning(true);
    try {
      // Get primary contact email
      const { data: contacts } = await supabase
        .from('supplier_contacts')
        .select('email, full_name')
        .eq('supplier_id', supplier.id)
        .eq('is_primary', true)
        .limit(1);
      const email = contacts?.[0]?.email || '';
      const name = supplier.name;

      // Call dispatch
      const { data, error } = await supabase.functions.invoke('dispatch-order', {
        body: { orderId, supplierName: name, supplierEmail: email, assignmentType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${name} assigné`);
      onAssigned();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setAssigning(false);
    }
  };

  if (currentAssignments.length > 0) {
    const s = currentAssignments[0];
    const logoUrl = (s as any).logo_url;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="h-8 w-8 rounded-full bg-background border flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
            {logoUrl ? (
              <img src={logoUrl} alt={getSupplierName(s)} className="h-6 w-6 object-contain" />
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground">{getSupplierInitial(s)}</span>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Changer le fournisseur</div>
          <DropdownMenuSeparator />
          {filteredSuppliers.map(sup => (
            <DropdownMenuItem key={sup.id} onClick={() => handleSelect(sup)} disabled={assigning} className="gap-2">
              {sup.logo_url ? (
                <img src={sup.logo_url} className="h-4 w-4 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold">{sup.name.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              {sup.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
          {icon}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Assigner un fournisseur</div>
        <DropdownMenuSeparator />
        {filteredSuppliers.map(sup => (
          <DropdownMenuItem key={sup.id} onClick={() => handleSelect(sup)} disabled={assigning} className="gap-2">
            {sup.logo_url ? (
              <img src={sup.logo_url} className="h-4 w-4 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold">{sup.name.slice(0, 2).toUpperCase()}</span>
              </div>
            )}
            {sup.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function OrderListView({ orders, assignmentsByOrder, onOrderRead, onOrderUpdate }: Props) {
  const navigate = useNavigate();
  const [crmSuppliers, setCrmSuppliers] = useState<CrmSupplier[]>([]);

  useEffect(() => {
    supabase.from('suppliers').select('id, name, type, logo_url').order('name').then(({ data }) => {
      if (data) setCrmSuppliers(data);
    });
  }, []);

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

  const handleSupplierAssigned = () => {
    // Trigger a refresh - parent component should handle this
    window.location.reload();
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
                {['pending', 'assigned', 'on_hold'].includes(order.status) && (
                  <ElapsedTimeBadge createdAt={order.created_at} />
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

              {/* Supplier column - dropdown picker */}
              <div className="w-10 flex flex-col items-center justify-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <SupplierPickerBubble
                  orderId={order.id}
                  assignmentType="material"
                  currentAssignments={materialSuppliers}
                  crmSuppliers={crmSuppliers}
                  onAssigned={handleSupplierAssigned}
                  icon={<Package className="h-3.5 w-3.5 text-muted-foreground/40" />}
                />
              </div>

              {/* DSP column - dropdown picker */}
              <div className="w-10 flex flex-col items-center justify-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <SupplierPickerBubble
                  orderId={order.id}
                  assignmentType="delivery"
                  currentAssignments={dspSuppliers}
                  crmSuppliers={crmSuppliers}
                  onAssigned={handleSupplierAssigned}
                  icon={<Truck className="h-3.5 w-3.5 text-muted-foreground/40" />}
                />
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
