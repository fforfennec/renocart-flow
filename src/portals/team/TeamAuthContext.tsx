import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth as useSession } from '@/contexts/AuthContext';

type UserRole = Database['public']['Enums']['app_role'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface TeamAuthContextType {
  user: User | null;
  profile: Profile | null;
  userRole: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const TeamAuthContext = createContext<TeamAuthContextType | undefined>(undefined);

export const TeamAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: sessionLoading, signOut } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { setProfile(null); setUserRole(null); setLoadedFor(null); return; }
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
      ]);
      if (cancelled) return;
      const roles = (roleRows ?? []).map((r) => r.role);
      const priority: UserRole[] = ['admin', 'supplier', 'partner'];
      setProfile(p);
      setUserRole(priority.find((r) => roles.includes(r)) ?? null);
      setLoadedFor(user.id);
    })();
    return () => { cancelled = true; };
  }, [user, sessionLoading]);

  const teamSignOut = async () => { await signOut(); window.location.assign('/equipe'); };
  const loading = sessionLoading || (!!user && loadedFor !== user.id);
  return (
    <TeamAuthContext.Provider value={{ user, profile, userRole, loading, signOut: teamSignOut }}>
      {children}
    </TeamAuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(TeamAuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within TeamAuthProvider');
  return ctx;
};
