import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Order = Database['public']['Tables']['orders']['Row'] & {
  order_items?: Array<{ count: number }>;
};

type FilterType = 'all' | 'new' | 'contacted' | 'done' | 'late';

export default function AdminOverview() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredOrders = () => {
    let filtered = orders;

    // Apply status filter
    if (activeFilter === 'new') {
      filtered = filtered.filter(o => o.status === 'pending');
    } else if (activeFilter === 'contacted') {
      filtered = filtered.filter(o => o.status === 'in_progress');
    } else if (activeFilter === 'done') {
      filtered = filtered.filter(o => o.status === 'delivered');
    } else if (activeFilter === 'late') {
      const today = new Date();
      filtered = filtered.filter(o => {
        const deliveryDate = new Date(o.delivery_date);
        return deliveryDate < today && o.status !== 'delivered';
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(o =>
        o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.client_address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: 'New' },
      in_progress: { variant: 'default', label: 'Contacted' },
      delivered: { variant: 'outline', label: 'Done' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const isLate = (deliveryDate: string, status: string) => {
    if (status === 'delivered') return false;
    const today = new Date();
    const delivery = new Date(deliveryDate);
    return delivery < today;
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rc-navy">Orders Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all orders and deliveries</p>
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setActiveFilter('all')}
          className={activeFilter === 'all' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}
        >
          All Orders
        </Button>
        <Button
          variant={activeFilter === 'new' ? 'default' : 'outline'}
          onClick={() => setActiveFilter('new')}
          className={activeFilter === 'new' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}
        >
          New
        </Button>
        <Button
          variant={activeFilter === 'contacted' ? 'default' : 'outline'}
          onClick={() => setActiveFilter('contacted')}
          className={activeFilter === 'contacted' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}
        >
          Contacted
        </Button>
        <Button
          variant={activeFilter === 'done' ? 'default' : 'outline'}
          onClick={() => setActiveFilter('done')}
          className={activeFilter === 'done' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}
        >
          Done
        </Button>
        <Button
          variant={activeFilter === 'late' ? 'destructive' : 'outline'}
          onClick={() => setActiveFilter('late')}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Late Orders
        </Button>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
        ) : filteredOrders.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No orders found</p>
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
                    {isLate(order.delivery_date, order.status) && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Late
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><span className="font-medium">Client:</span> {order.client_name}</p>
                    <p><span className="font-medium">Address:</span> {order.client_address}</p>
                    <p><span className="font-medium">Delivery:</span> {new Date(order.delivery_date).toLocaleDateString()} - {order.delivery_time_window}</p>
                    {order.truck_type && <p><span className="font-medium">Truck:</span> {order.truck_type}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-sm font-medium">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
