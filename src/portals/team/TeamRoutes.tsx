import { Routes, Route, useLocation } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import NotFound from '@/pages/NotFound';
import { TeamAuthProvider, useAuth } from './TeamAuthContext';
import TeamLogin from './pages/TeamLogin';
import TeamResetPassword from './pages/TeamResetPassword';
import AdminDashboard from './pages/admin/Dashboard';
import SupplierDashboard from './pages/supplier/Dashboard';
import SupplierRespond from './pages/supplier/SupplierRespond';

type UserRole = Database['public']['Enums']['app_role'];

// Anyone without a team role sees the exact same page as an unknown address.
const TeamGuard = ({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) => {
  const { user, userRole, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user || !userRole || !roles.includes(userRole)) return <NotFound />;
  return <>{children}</>;
};

const TeamRoutes = () => {
  const location = useLocation();
  return (
  <TeamAuthProvider>
    <Routes location={{ ...location, pathname: location.pathname }}>
      <Route path="/equipe" element={<TeamLogin />} />
      <Route path="/equipe/reset-password" element={<TeamResetPassword />} />
      <Route path="/admin/*" element={<TeamGuard roles={['admin']}><AdminDashboard /></TeamGuard>} />
      <Route path="/supplier/respond" element={<SupplierRespond />} />
      <Route path="/supplier/*" element={<TeamGuard roles={['supplier', 'partner', 'admin']}><SupplierDashboard /></TeamGuard>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TeamAuthProvider>
  );
};

export default TeamRoutes;
