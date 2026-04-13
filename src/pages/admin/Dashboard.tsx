import { Routes, Route } from 'react-router-dom';
import { LayoutDashboard, Package, Users, BarChart3, HelpCircle, LogOut, Truck, Bot } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';
import AdminOverview from './Overview';
import AdminHistorique from './Historique';
import AdminStats from './Stats';
import AdminFAQ from './FAQ';
import AdminOrderDetail from './OrderDetail';
import AdminSuppliers from './Suppliers';
import SupplierDetail from './SupplierDetail';
import Automations from './Automations';

const AdminDashboard = () => {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex bg-rc-beige">
      {/* Sidebar */}
      <aside className="w-64 bg-rc-navy text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-rc-gold rounded flex items-center justify-center font-bold text-rc-navy">R</div>
          <span className="text-xl font-bold">RenoCart</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavLink 
            to="/admin" 
            end
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <LayoutDashboard size={20} />
            <span>Overview</span>
          </NavLink>
          <NavLink 
            to="/admin/historique"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <Package size={20} />
            <span>Historique</span>
          </NavLink>
          <NavLink 
            to="/admin/stats"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <BarChart3 size={20} />
            <span>Stats</span>
          </NavLink>
          <NavLink 
            to="/admin/suppliers"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <Truck size={20} />
            <span>Fournisseurs & DSP</span>
          </NavLink>
          <NavLink 
            to="/admin/automations"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <Bot size={20} />
            <span>Automations</span>
          </NavLink>
          <NavLink 
            to="/admin/faq"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <HelpCircle size={20} />
            <span>FAQ</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium">{profile?.full_name || 'Admin User'}</p>
            <p className="text-xs text-white/50">COO / Operations</p>
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
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-border h-16 flex items-center px-6">
          <h2 className="text-lg font-medium text-muted-foreground">Admin Portal</h2>
        </header>
        
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/orders/:orderId" element={<AdminOrderDetail />} />
          <Route path="/historique" element={<AdminHistorique />} />
          <Route path="/suppliers" element={<AdminSuppliers />} />
          <Route path="/suppliers/:supplierId" element={<SupplierDetail />} />
          <Route path="/stats" element={<AdminStats />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/faq" element={<AdminFAQ />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
