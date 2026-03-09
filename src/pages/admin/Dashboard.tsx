import { Routes, Route } from 'react-router-dom';
import { LayoutDashboard, Package, Users, BarChart3, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';
import AdminOverview from './Overview';
import AdminHistorique from './Historique';
import AdminStats from './Stats';
import AdminFAQ from './FAQ';

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
          <NavLink to="/admin" icon={LayoutDashboard}>
            Overview
          </NavLink>
          <NavLink to="/admin/historique" icon={Package}>
            Historique
          </NavLink>
          <NavLink to="/admin/stats" icon={BarChart3}>
            Stats
          </NavLink>
          <NavLink to="/admin/faq" icon={HelpCircle}>
            FAQ
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
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/orders" element={<OrdersList />} />
          <Route path="/suppliers" element={<SuppliersList />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
