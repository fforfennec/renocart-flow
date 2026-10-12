import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LayoutDashboard, Package, Users, BarChart3, HelpCircle, LogOut, Truck, Bot, MessageCircle, ShoppingCart, UserCog, PanelLeftClose, PanelLeftOpen, ChevronDown } from 'lucide-react';
import { useAuth } from '@/portals/team/TeamAuthContext';
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
import Messages from './Messages';
import ClientMessages from './ClientMessages';
import SuggestionRules from './SuggestionRules';
import Utilisateurs from './Utilisateurs';
import Clients from './Clients';
import Commander from '@/portals/client/pages/Commander';

const AdminDashboard = () => {
  const { signOut, profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('rc-admin-groups');
      if (saved) return JSON.parse(saved) as Record<string, boolean>;
    } catch {
      // ignore unreadable preference
    }
    return {};
  });
  const toggleGroup = (label: string) => setOpenGroups((prev) => {
    const next = { ...prev, [label]: !(prev[label] !== false) };
    try {
      localStorage.setItem('rc-admin-groups', JSON.stringify(next));
    } catch {
      // ignore write failure
    }
    return next;
  });
  const groups = [
    { label: 'Dispatch', items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/messages', label: 'Messages suppliers', icon: MessageCircle },
      { to: '/admin/historique', label: 'Historique', icon: Package },
      { to: '/admin/stats', label: 'Stats', icon: BarChart3 },
      { to: '/admin/suppliers', label: 'Fournisseurs & SP', icon: Truck },
      { to: '/admin/automations', label: 'Automations', icon: Bot },
    ] },
    { label: 'Gestion Clients', items: [
      { to: '/admin/commander', label: 'Page de commande', icon: ShoppingCart },
      { to: '/admin/clients', label: 'Profils clients', icon: Users },
      { to: '/admin/messages-clients', label: 'Messages clients', icon: MessageCircle },
    ] },
    { label: 'Base de données', items: [
      { to: '/admin/suggestions', label: 'Règles de suggestions', icon: Package },
    ] },
    { label: 'Paramètres', items: [
      { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: UserCog },
    ] },
  ];
  const linkClass = 'flex min-h-11 items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors';

  return (
    <div className="min-h-screen flex bg-rc-beige">
      <aside className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 transition-[width] duration-200 motion-reduce:transition-none`}>
        <div className={`flex items-center ${collapsed ? 'justify-center p-4' : 'gap-3 p-6'}`}>
          <div className="w-8 h-8 shrink-0 bg-sidebar-primary rounded flex items-center justify-center font-bold text-sidebar-primary-foreground">R</div>
          {!collapsed && <span className="text-xl font-bold">RenoCart</span>}
        </div>
        <nav aria-label="Menu administrateur" className={`${collapsed ? 'px-1' : 'px-4'} flex-1 overflow-y-auto pb-4 space-y-4`}>
          {groups.map((group) => {
            const open = openGroups[group.label] !== false;
            return <section key={group.label} aria-label={group.label}>
              {!collapsed && <button type="button" onClick={() => toggleGroup(group.label)} aria-expanded={open} title={open ? `Replier ${group.label}` : `Déplier ${group.label}`} className="flex min-h-8 w-full items-center gap-3 px-3 mb-1 rounded-md text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors">
                <ChevronDown size={14} className={`h-5 w-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
                <span>{group.label}</span>
              </button>}
              <div className={`space-y-0.5 ${open || collapsed ? '' : 'hidden'}`}>{group.items.map((item) => <NavLink key={item.to} to={item.to} end={'end' in item && item.end} title={item.label} aria-label={item.label} className={linkClass} activeClassName="bg-sidebar-accent !text-sidebar-accent-foreground">
                <item.icon size={20} className="shrink-0" />{!collapsed && <span className="leading-snug">{item.label}</span>}
              </NavLink>)}</div>
            </section>;
          })}
          <div className="border-t border-sidebar-border pt-3"><NavLink to="/admin/faq" title="FAQ" aria-label="FAQ" className={linkClass} activeClassName="bg-sidebar-accent !text-sidebar-accent-foreground"><HelpCircle size={20} className="shrink-0" />{!collapsed && <span>FAQ</span>}</NavLink></div>
        </nav>
        <div className={`${collapsed ? 'p-1' : 'p-4'} border-t border-sidebar-border`}>
          {!collapsed && <div className="mb-3 px-3"><p className="text-sm font-medium truncate">{profile?.full_name || 'Admin User'}</p><p className="text-xs text-sidebar-foreground/50">COO / Operations</p></div>}
          <Button variant="ghost" title="Sign Out" aria-label="Sign Out" className="w-full justify-start text-sidebar-foreground/75 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={signOut}><LogOut size={20} className="shrink-0" />{!collapsed && 'Sign Out'}</Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header className="bg-card border-b border-border h-16 flex items-center gap-3 px-6">
          <Button variant="ghost" size="icon" aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'} title={collapsed ? 'Déplier le menu' : 'Réduire le menu'} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
          <h2 className="text-lg font-medium text-muted-foreground">Admin Portal</h2>
        </header>
        
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/orders/:orderId" element={<AdminOrderDetail />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages-clients" element={<ClientMessages />} />
          <Route path="/historique" element={<AdminHistorique />} />
          <Route path="/suppliers" element={<AdminSuppliers />} />
          <Route path="/suppliers/:supplierId" element={<SupplierDetail />} />
          <Route path="/stats" element={<AdminStats />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/suggestions" element={<SuggestionRules />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/commander" element={<Commander />} />
          <Route path="/utilisateurs" element={<Utilisateurs />} />
          <Route path="/faq" element={<AdminFAQ />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
