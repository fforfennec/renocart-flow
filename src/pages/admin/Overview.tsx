import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertCircle, List, LayoutGrid, CalendarDays, Play, Pause, Bot } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { AssignmentInfo } from '@/components/admin/OrderCard';
import OrderListView from '@/components/admin/OrderListView';
import OrderBoardView from '@/components/admin/OrderBoardView';
import OrderCalendarView from '@/components/admin/OrderCalendarView';
import OrderAutomationView from '@/components/admin/OrderAutomationView';

type Order = Database['public']['Tables']['orders']['Row'];
type FilterType = 'all' | 'new' | 'contacted' | 'done' | 'late';
type ViewType = 'list' | 'board' | 'calendar' | 'automation';

export default function AdminOverview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeView, setActiveView] = useState<ViewType>('list');
  const [assignmentsByOrder, setAssignmentsByOrder] = useState<Record<string, AssignmentInfo[]>>({});
  const [automationsPaused, setAutomationsPaused] = useState<boolean | null>(null);

  useEffect(() => {
    loadOrders();
    loadAutomationState();
  }, []);

  const loadAutomationState = async () => {
    const { data } = await supabase
      .from('app_settings' as any)
      .select('value')
      .eq('key', 'automations_paused')
      .single();
    if (data) setAutomationsPaused((data as any).value === 'true');
  };

  const toggleAutomations = async () => {
    const newValue = !automationsPaused;
    const { error } = await supabase
      .from('app_settings' as any)
      .update({ value: String(newValue), updated_at: new Date().toISOString() } as any)
      .eq('key', 'automations_paused');
    if (error) {
      toast.error('Failed to update automation state');
      return;
    }
    setAutomationsPaused(newValue);
    toast.success(newValue ? 'Automations paused' : 'Automations resumed');
  };

  const loadOrders = async () => {
    try {
      // Auto-archive old delivered orders (3+ business days)
      await supabase.rpc('archive_old_delivered_orders');

      const [ordersRes, assignmentsRes, suppliersRes] = await Promise.all([
        supabase.from('orders').select('*').neq('status', 'archived').order('created_at', { ascending: false }),
        supabase.from('supplier_assignments').select('order_id, supplier_id, assignment_type, assigned_at'),
        supabase.from('suppliers').select('id, name, logo_url'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      setOrders(ordersRes.data || []);

      if (!assignmentsRes.error && assignmentsRes.data) {
        // Fetch profiles separately (no FK)
        const supplierIds = [...new Set(assignmentsRes.data.map(a => a.supplier_id))];
        let profilesMap: Record<string, { full_name: string; company_name: string | null }> = {};
        if (supplierIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name, company_name')
            .in('user_id', supplierIds);
          (profilesData || []).forEach(p => {
            profilesMap[p.user_id] = { full_name: p.full_name, company_name: p.company_name };
          });
        }

        // Build a name→logo_url map from CRM suppliers
        const logoMap: Record<string, string> = {};
        (suppliersRes.data || []).forEach(s => {
          if (s.logo_url) logoMap[s.name.toLowerCase()] = s.logo_url;
        });

        const map: Record<string, AssignmentInfo[]> = {};
        assignmentsRes.data.forEach((a) => {
          if (!map[a.order_id]) map[a.order_id] = [];
          const profile = profilesMap[a.supplier_id] || null;
          const name = (profile?.company_name || profile?.full_name || '').toLowerCase();
          map[a.order_id].push({
            ...a,
            profiles: profile,
            logo_url: logoMap[name] || null,
          } as any);
        });
        setAssignmentsByOrder(map);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredOrders = () => {
    let filtered = orders;

    if (activeFilter === 'new') {
      filtered = filtered.filter(o => o.status === 'pending');
    } else if (activeFilter === 'contacted') {
      filtered = filtered.filter(o => o.status === 'in_progress');
    } else if (activeFilter === 'done') {
      filtered = filtered.filter(o => o.status === 'delivered');
    } else if (activeFilter === 'late') {
      const today = new Date();
      filtered = filtered.filter(o => new Date(o.delivery_date) < today && o.status !== 'delivered');
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.order_number.toLowerCase().includes(s) ||
        o.client_name.toLowerCase().includes(s) ||
        o.client_address.toLowerCase().includes(s)
      );
    }

    return filtered;
  };

  const handleOrderRead = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'in_progress' } : o));
  };

  const handleOrderUpdate = (orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
  };

  const filteredOrders = getFilteredOrders();

  const views: { key: ViewType; label: string; icon: React.ReactNode }[] = [
    { key: 'list', label: 'List', icon: <List className="h-4 w-4" /> },
    { key: 'board', label: 'Board', icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'calendar', label: 'Calendar', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'automation', label: 'Automation', icon: <Bot className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rc-navy">Orders Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all orders and deliveries</p>
        </div>

        {/* Automation Toggle */}
        {automationsPaused !== null && (
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={toggleAutomations}
              variant={automationsPaused ? 'outline' : 'default'}
              className={automationsPaused
                ? 'border-orange-400 text-orange-600 hover:bg-orange-50 gap-2'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2'
              }
              size="lg"
            >
              {automationsPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              {automationsPaused ? 'Resume Automations' : 'Automations Active'}
            </Button>
            {automationsPaused ? (
              <p className="text-sm text-orange-600 font-medium flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Automations paused — manual dispatch required
              </p>
            ) : (
              <p className="text-sm text-emerald-600 font-medium">✓ All automations are running</p>
            )}
          </div>
        )}
      </div>

      {/* Search */}
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
      {activeView !== 'calendar' && (
        <div className="flex gap-2 flex-wrap">
          <Button variant={activeFilter === 'all' ? 'default' : 'outline'} onClick={() => setActiveFilter('all')} className={activeFilter === 'all' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}>All Orders</Button>
          <Button variant={activeFilter === 'new' ? 'default' : 'outline'} onClick={() => setActiveFilter('new')} className={activeFilter === 'new' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}>New</Button>
          <Button variant={activeFilter === 'contacted' ? 'default' : 'outline'} onClick={() => setActiveFilter('contacted')} className={activeFilter === 'contacted' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}>Contacted</Button>
          <Button variant={activeFilter === 'done' ? 'default' : 'outline'} onClick={() => setActiveFilter('done')} className={activeFilter === 'done' ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}>Done</Button>
          <Button variant={activeFilter === 'late' ? 'destructive' : 'outline'} onClick={() => setActiveFilter('late')}><AlertCircle className="h-4 w-4 mr-2" />Late Orders</Button>
        </div>
      )}

      {/* View tabs */}
      <div className="flex items-center border-b">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeView === v.key
                ? 'border-rc-navy text-rc-navy'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
      ) : filteredOrders.length === 0 && activeView !== 'calendar' ? (
        <p className="text-center py-8 text-muted-foreground">No orders found</p>
      ) : (
        <>
          {activeView === 'list' && (
            <OrderListView orders={filteredOrders} assignmentsByOrder={assignmentsByOrder} onOrderRead={handleOrderRead} onOrderUpdate={handleOrderUpdate} />
          )}
          {activeView === 'board' && (
            <OrderBoardView orders={filteredOrders} assignmentsByOrder={assignmentsByOrder} onOrderUpdate={handleOrderUpdate} />
          )}
          {activeView === 'calendar' && (
            <OrderCalendarView orders={filteredOrders} assignmentsByOrder={assignmentsByOrder} />
          )}
          {activeView === 'automation' && (
            <OrderAutomationView orders={filteredOrders} assignmentsByOrder={assignmentsByOrder} />
          )}
        </>
      )}
    </div>
  );
}
