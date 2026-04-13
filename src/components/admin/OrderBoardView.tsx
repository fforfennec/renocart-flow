import { useNavigate } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { AssignmentInfo, isLate, LateBadge } from './OrderCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect, DragEvent } from 'react';
import { Package, Truck } from 'lucide-react';

type Order = Database['public']['Tables']['orders']['Row'];

interface Props {
  orders: Order[];
  assignmentsByOrder: Record<string, AssignmentInfo[]>;
  onOrderUpdate?: (orderId: string, updates: Partial<Order>) => void;
}

const COLUMNS = [
  { key: 'pending', label: 'Nouveau', color: 'border-t-muted-foreground' },
  { key: 'assigned', label: 'Assigné', color: 'border-t-blue-500' },
  { key: 'in_progress', label: 'En cours', color: 'border-t-amber-500' },
  { key: 'on_hold', label: 'En attente', color: 'border-t-orange-400' },
  { key: 'delivered', label: 'Livré', color: 'border-t-green-500' },
  { key: 'cancelled', label: 'Annulé', color: 'border-t-destructive' },
];

export default function OrderBoardView({ orders, assignmentsByOrder, onOrderUpdate }: Props) {
  const navigate = useNavigate();
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [supplierLogos, setSupplierLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('suppliers').select('name, logo_url').not('logo_url', 'is', null).then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach(s => { if (s.logo_url) map[s.name.toLowerCase()] = s.logo_url; });
      setSupplierLogos(map);
    });
  }, []);

  const getLogoForAssignment = (a: AssignmentInfo) => {
    const name = ((a.profiles as any)?.company_name || (a.profiles as any)?.full_name || '').toLowerCase();
    return supplierLogos[name] || null;
  };

  const handleDragStart = (e: DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(colKey);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: DragEvent, newStatus: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggedOrderId) return;

    const order = orders.find(o => o.id === draggedOrderId);
    if (!order || order.status === newStatus) { setDraggedOrderId(null); return; }

    // Optimistic update
    onOrderUpdate?.(draggedOrderId, { status: newStatus });

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', draggedOrderId);
      if (error) throw error;
      toast.success(`Commande déplacée vers "${COLUMNS.find(c => c.key === newStatus)?.label}"`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors du changement de statut');
      // Revert
      onOrderUpdate?.(draggedOrderId, { status: order.status });
    }
    setDraggedOrderId(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
      {COLUMNS.map((col) => {
        const columnOrders = orders.filter(o => o.status === col.key);
        const isDragOver = dropTarget === col.key;

        return (
          <div
            key={col.key}
            className={`min-w-[240px] w-[240px] shrink-0 flex flex-col rounded-lg transition-colors ${
              isDragOver ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-muted/30'
            }`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className={`flex items-center gap-2 px-3 py-2.5 border-t-[3px] rounded-t-lg ${col.color}`}>
              <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
              <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5 font-medium">
                {columnOrders.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {columnOrders.map((order) => {
                const assignments = assignmentsByOrder[order.id] || [];
                const supplier = assignments.find(a => a.assignment_type === 'material');
                const dsp = assignments.find(a => a.assignment_type === 'delivery');
                const isDragging = draggedOrderId === order.id;

                return (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, order.id)}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className={`bg-background border rounded-lg p-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-1.5 ${
                      isDragging ? 'opacity-40 scale-95' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-rc-navy">{order.order_number}</span>
                      {isLate(order.delivery_date, order.status) && <LateBadge />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{order.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.delivery_date).toLocaleDateString('fr-CA')} · {order.delivery_time_window}
                    </p>
                    {(supplier || dsp) && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {supplier && (() => {
                          const logo = getLogoForAssignment(supplier);
                          const name = (supplier.profiles as any)?.company_name || (supplier.profiles as any)?.full_name || '?';
                          return logo ? (
                            <div className="h-5 w-5 rounded-full bg-white border flex items-center justify-center overflow-hidden" title={name}>
                              <img src={logo} alt={name} className="h-4 w-4 object-contain" />
                            </div>
                          ) : (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]">
                              {name}
                            </span>
                          );
                        })()}
                        {dsp && (() => {
                          const logo = getLogoForAssignment(dsp);
                          const name = (dsp.profiles as any)?.company_name || (dsp.profiles as any)?.full_name || '?';
                          return logo ? (
                            <div className="h-5 w-5 rounded-full bg-white border flex items-center justify-center overflow-hidden" title={name}>
                              <img src={logo} alt={name} className="h-4 w-4 object-contain" />
                            </div>
                          ) : (
                            <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]">
                              {name}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
              {columnOrders.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8 italic">Aucune commande</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
