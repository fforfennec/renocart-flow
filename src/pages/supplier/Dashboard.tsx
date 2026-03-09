import { Routes, Route } from 'react-router-dom';
import { Package, Bell, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

// Temporary placeholder components
const OrdersQueue = () => <div className="p-6"><h1 className="text-2xl font-bold text-rc-navy mb-4">Pending Orders</h1><p>Orders to confirm coming soon.</p></div>;
const CompletedOrders = () => <div className="p-6"><h1 className="text-2xl font-bold text-rc-navy mb-4">Completed Deliveries</h1><p>Past orders coming soon.</p></div>;

const SupplierDashboard = () => {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex bg-rc-beige">
      {/* Sidebar - Matching Mockup Style */}
      <aside className="w-64 bg-rc-navy text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold text-rc-gold mb-1">Supplier Portal</h2>
          <p className="text-sm text-white/70">{profile?.company_name || 'Partner Company'}</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <a href="/supplier" className="flex items-center gap-3 px-3 py-2 rounded-md bg-rc-gold text-rc-navy font-medium">
            <Bell size={20} />
            <span>New Orders</span>
            <span className="ml-auto bg-rc-navy text-white text-xs py-0.5 px-2 rounded-full">3</span>
          </a>
          <a href="/supplier/active" className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors">
            <Package size={20} />
            <span>Active Deliveries</span>
          </a>
          <a href="/supplier/completed" className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors">
            <CheckCircle2 size={20} />
            <span>Completed</span>
          </a>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium">{profile?.full_name || 'Supplier User'}</p>
            <p className="text-xs text-white/50">{profile?.phone || 'No phone added'}</p>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
            onClick={signOut}
          >
            <LogOut size={20} className="mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#e5e5e5] p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header matching mockup */}
          <div className="bg-rc-navy rounded-t-lg p-4 flex justify-between items-center text-white mb-6">
            <div className="font-medium">{profile?.company_name || 'Supplier X'}</div>
            <div className="flex gap-12">
              <span className="text-rc-gold cursor-pointer">Orders</span>
              <span className="cursor-pointer hover:text-rc-gold transition-colors">Data</span>
              <span className="cursor-pointer hover:text-rc-gold transition-colors">Info</span>
            </div>
            <div className="flex items-center gap-2 text-rc-gold">
              <span>New Order</span>
              <Bell size={18} fill="currentColor" />
            </div>
          </div>
          
          <Routes>
            <Route path="/" element={<OrdersQueue />} />
            <Route path="/active" element={<div className="bg-white rounded-b-lg p-6 min-h-[500px]">Active orders coming soon</div>} />
            <Route path="/completed" element={<CompletedOrders />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default SupplierDashboard;
