import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Order = Database['public']['Tables']['orders']['Row'];

export default function AdminHistorique() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCompletedOrders();
  }, []);

  const loadCompletedOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['delivered', 'cancelled'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading completed orders:', error);
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredOrders = () => {
    if (!searchTerm) return orders;
    
    return orders.filter(o =>
      o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.client_address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'delivered') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Delivered</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rc-navy">Order History</h1>
          <p className="text-sm text-muted-foreground mt-1">View all completed and cancelled orders</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by order #, client, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 border-rc-gold/30 focus:border-rc-gold"
        />
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading history...</p>
        ) : filteredOrders.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No completed orders found</p>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => navigate(`/admin/orders/${order.id}`)}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-rc-navy">{order.order_number}</h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><span className="font-medium">Client:</span> {order.client_name}</p>
                    <p><span className="font-medium">Address:</span> {order.client_address}</p>
                    <p><span className="font-medium">Delivery Date:</span> {new Date(order.delivery_date).toLocaleDateString()} - {order.delivery_time_window}</p>
                    {order.truck_type && <p><span className="font-medium">Truck:</span> {order.truck_type}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Completed</p>
                  <p className="text-sm font-medium">{new Date(order.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
