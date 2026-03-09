import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertCircle, Package, Truck, User, Phone, MapPin, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type SupplierAssignment = Database['public']['Tables']['supplier_assignments']['Row'] & {
  profiles?: { full_name: string; company_name: string | null };
  supplier_responses?: Array<Database['public']['Tables']['supplier_responses']['Row']>;
};
type ItemResponse = Database['public']['Tables']['item_responses']['Row'];

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [assignments, setAssignments] = useState<SupplierAssignment[]>([]);
  const [itemResponses, setItemResponses] = useState<Record<string, ItemResponse>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      // Load order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      // Load order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('sort_order');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Load supplier assignments with profiles and responses
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('supplier_assignments')
        .select(`
          *,
          profiles:supplier_id (full_name, company_name),
          supplier_responses (*)
        `)
        .eq('order_id', orderId);

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData as any || []);

      // Load item responses
      if (assignmentsData && assignmentsData.length > 0) {
        const responseIds = assignmentsData
          .flatMap(a => (a as any).supplier_responses || [])
          .map((r: any) => r.id);

        if (responseIds.length > 0) {
          const { data: itemResponsesData } = await supabase
            .from('item_responses')
            .select('*')
            .in('response_id', responseIds);

          if (itemResponsesData) {
            const responsesMap: Record<string, ItemResponse> = {};
            itemResponsesData.forEach(ir => {
              responsesMap[ir.item_id] = ir;
            });
            setItemResponses(responsesMap);
          }
        }
      }
    } catch (error) {
      console.error('Error loading order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success(`Order status updated to ${newStatus}`);
      loadOrderDetails();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  const isLate = (deliveryDate: string, status: string) => {
    if (status === 'delivered') return false;
    const today = new Date();
    const delivery = new Date(deliveryDate);
    return delivery < today;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: 'New' },
      in_progress: { variant: 'default', label: 'Contacted' },
      on_hold: { variant: 'outline', label: 'On Hold' },
      delivered: { variant: 'outline', label: 'Done' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Order not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin')}
          className="hover:bg-rc-navy/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-rc-navy">{order.order_number}</h1>
            {getStatusBadge(order.status)}
            {isLate(order.delivery_date, order.status) && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Late
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Created on {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => updateOrderStatus('delivered')}
            disabled={order.status === 'delivered'}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Mark as Delivered
          </Button>
          <Button
            variant="outline"
            onClick={() => updateOrderStatus('on_hold')}
            disabled={order.status === 'on_hold'}
          >
            Put on Hold
          </Button>
          <Button
            variant="destructive"
            onClick={() => updateOrderStatus('cancelled')}
            disabled={order.status === 'cancelled'}
          >
            Cancel Order
          </Button>
        </div>
      </div>

      {/* Order Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="font-medium">{order.client_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {order.client_phone || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Address</p>
              <p className="font-medium flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                {order.client_address}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Delivery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Delivery Date</p>
              <p className="font-medium">{new Date(order.delivery_date).toLocaleDateString('fr-CA')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Time Window</p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {order.delivery_time_window}
              </p>
            </div>
            {order.truck_type && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Truck Type</p>
                <p className="font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {order.truck_type}
                </p>
              </div>
            )}
            {order.internal_notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Internal Notes</p>
                <p className="text-sm bg-muted p-2 rounded">{order.internal_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Materials ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No items in this order</p>
            ) : (
              items.map((item) => {
                const itemResponse = itemResponses[item.id];
                return (
                  <div key={item.id} className="p-4 border rounded-lg bg-background">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.sku && <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>}
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                        {item.client_note && (
                          <p className="text-sm text-muted-foreground mt-1 italic">Note: {item.client_note}</p>
                        )}
                        {itemResponse?.supplier_note && (
                          <p className="text-sm text-blue-600 mt-1">Supplier: {itemResponse.supplier_note}</p>
                        )}
                      </div>
                      {itemResponse && (
                        <Badge variant={itemResponse.can_fulfill ? 'default' : 'destructive'}>
                          {itemResponse.can_fulfill ? 'Available' : 'Not Available'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Supplier Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Supplier Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No suppliers assigned yet</p>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => {
                const profile = assignment.profiles as any;
                const response = (assignment.supplier_responses as any)?.[0];
                
                return (
                  <div key={assignment.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-lg">
                            {profile?.company_name || profile?.full_name || 'Unknown Supplier'}
                          </p>
                          <Badge variant="outline">{assignment.assignment_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Assigned on {new Date(assignment.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                      {response && (
                        <Badge variant={response.status === 'confirmed' ? 'default' : 'secondary'}>
                          {response.status}
                        </Badge>
                      )}
                    </div>

                    {response && (
                      <div className="bg-muted/50 p-3 rounded space-y-2 text-sm">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="font-medium">Can deliver on date?</p>
                            <p className={response.can_deliver_date ? 'text-green-600' : 'text-red-600'}>
                              {response.can_deliver_date ? 'Yes' : 'No'}
                            </p>
                            {response.alternative_date && (
                              <p className="text-xs text-muted-foreground">Alt: {new Date(response.alternative_date).toLocaleDateString()}</p>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">Can deliver at time?</p>
                            <p className={response.can_deliver_time ? 'text-green-600' : 'text-red-600'}>
                              {response.can_deliver_time ? 'Yes' : 'No'}
                            </p>
                            {response.alternative_time && (
                              <p className="text-xs text-muted-foreground">Alt: {response.alternative_time}</p>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">Can deliver with truck?</p>
                            <p className={response.can_deliver_truck ? 'text-green-600' : 'text-red-600'}>
                              {response.can_deliver_truck ? 'Yes' : 'No'}
                            </p>
                            {response.alternative_truck && (
                              <p className="text-xs text-muted-foreground">Alt: {response.alternative_truck}</p>
                            )}
                          </div>
                        </div>
                        {response.supplier_general_note && (
                          <div className="pt-2 border-t">
                            <p className="font-medium">Supplier Note:</p>
                            <p className="text-muted-foreground">{response.supplier_general_note}</p>
                          </div>
                        )}
                        {response.responded_at && (
                          <p className="text-xs text-muted-foreground">
                            Responded on {new Date(response.responded_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
