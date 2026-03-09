import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { toast } from 'sonner';

interface StatsData {
  totalOrders: number;
  approvedOrders: number;
  declinedOrders: number;
  pendingOrders: number;
  avgApprovalTime: number;
  supplierStats: Array<{
    name: string;
    approved: number;
    declined: number;
    pending: number;
    avgTime: number;
  }>;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AdminStats() {
  const [stats, setStats] = useState<StatsData>({
    totalOrders: 0,
    approvedOrders: 0,
    declinedOrders: 0,
    pendingOrders: 0,
    avgApprovalTime: 0,
    supplierStats: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get all orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*');

      if (ordersError) throw ordersError;

      // Get supplier responses with proper joins
      const { data: responses, error: responsesError } = await supabase
        .from('supplier_responses')
        .select(`
          *,
          supplier_assignments!inner(
            supplier_id,
            assigned_at
          )
        `);

      if (responsesError) throw responsesError;

      // Calculate stats
      const totalOrders = orders?.length || 0;
      const deliveredOrders = orders?.filter(o => o.status === 'delivered').length || 0;
      const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

      // Calculate supplier stats
      const supplierMap = new Map<string, { approved: number; declined: number; pending: number; times: number[] }>();
      
      responses?.forEach((response: any) => {
        const supplierId = response.supplier_assignments?.supplier_id;
        const supplierName = response.supplier_assignments?.profiles?.company_name || 
                           response.supplier_assignments?.profiles?.full_name || 
                           'Unknown Supplier';

        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, { approved: 0, declined: 0, pending: 0, times: [] });
        }

        const stats = supplierMap.get(supplierId)!;
        
        if (response.status === 'confirmed') {
          stats.approved++;
        } else if (response.status === 'declined') {
          stats.declined++;
        } else {
          stats.pending++;
        }

        if (response.responded_at) {
          const responseTime = new Date(response.responded_at).getTime() - new Date(response.supplier_assignments?.assigned_at).getTime();
          stats.times.push(responseTime / (1000 * 60 * 60)); // Convert to hours
        }
      });

      const supplierStats = Array.from(supplierMap.entries()).map(([id, data]) => {
        const supplier = responses?.find((r: any) => r.supplier_assignments?.supplier_id === id);
        const name = supplier?.supplier_assignments?.profiles?.company_name || 
                    supplier?.supplier_assignments?.profiles?.full_name || 
                    'Unknown';
        
        return {
          name,
          approved: data.approved,
          declined: data.declined,
          pending: data.pending,
          avgTime: data.times.length > 0 ? data.times.reduce((a, b) => a + b, 0) / data.times.length : 0,
        };
      });

      setStats({
        totalOrders,
        approvedOrders: deliveredOrders,
        declinedOrders: cancelledOrders,
        pendingOrders,
        avgApprovalTime: 0,
        supplierStats,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Approved', value: stats.approvedOrders, color: COLORS[3] },
    { name: 'Declined', value: stats.declinedOrders, color: COLORS[4] },
    { name: 'Pending', value: stats.pendingOrders, color: COLORS[2] },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-center py-8 text-muted-foreground">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-rc-navy">Supplier Statistics</h1>
        <p className="text-sm text-muted-foreground mt-1">Performance metrics and analytics</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-rc-navy">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.approvedOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Declined</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats.declinedOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{stats.pendingOrders}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
            <CardDescription>Breakdown of all orders by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Performance</CardTitle>
            <CardDescription>Approved vs Declined by supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.supplierStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" fill={COLORS[3]} name="Approved" />
                <Bar dataKey="declined" fill={COLORS[4]} name="Declined" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Average Response Time by Supplier</CardTitle>
            <CardDescription>Time taken to respond (in hours)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.supplierStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgTime" fill={COLORS[0]} name="Avg Response Time (hours)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
