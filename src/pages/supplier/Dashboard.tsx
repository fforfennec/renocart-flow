import { Routes, Route } from 'react-router-dom';
import { LayoutDashboard, Package, BarChart3, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';
import SupplierOverview from './Overview';

const SupplierDashboard = () => {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex bg-rc-beige">
      {/* Sidebar - Same as admin */}
      <aside className="w-64 bg-rc-navy text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-rc-gold rounded flex items-center justify-center font-bold text-rc-navy">R</div>
          <span className="text-xl font-bold">RenoCart</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavLink 
            to="/supplier" 
            end
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <LayoutDashboard size={20} />
            <span>Overview</span>
          </NavLink>
          <NavLink 
            to="/supplier/historique"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <Package size={20} />
            <span>Historique</span>
          </NavLink>
          <NavLink 
            to="/supplier/stats"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <BarChart3 size={20} />
            <span>Stats</span>
          </NavLink>
          <NavLink 
            to="/supplier/faq"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            activeClassName="bg-white/10 !text-white"
          >
            <HelpCircle size={20} />
            <span>FAQ</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium">{profile?.full_name || 'Supplier'}</p>
            <p className="text-xs text-white/50">{profile?.company_name || 'Partner'}</p>
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
          <h2 className="text-lg font-medium text-muted-foreground">Supplier Portal</h2>
        </header>
        
        <Routes>
          <Route path="/" element={<SupplierOverview />} />
          <Route path="/historique" element={<div className="p-6"><h1 className="text-2xl font-bold text-rc-navy">Historique</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div>} />
          <Route path="/stats" element={<div className="p-6"><h1 className="text-2xl font-bold text-rc-navy">Stats</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div>} />
          <Route path="/faq" element={<div className="p-6"><h1 className="text-2xl font-bold text-rc-navy">FAQ</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div>} />
        </Routes>
      </main>
    </div>
  );
};

export default SupplierDashboard;
