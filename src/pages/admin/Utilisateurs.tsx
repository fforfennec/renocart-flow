import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MoreHorizontal, Search } from 'lucide-react';

type Staff = { user_id: string; email: string; full_name: string | null; company_name: string | null; requested_role: string; status: string; supplier_company_id: string | null; created_at: string };
type Supplier = { id: string; name: string };

const ROLE: Record<string, string> = { admin: 'Admin', supplier: 'Fournisseur', partner: 'Partenaire' };
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Actif', cls: 'bg-success/15 text-success border-success/30' },
  pending: { label: 'En attente', cls: 'bg-rc-gold/20 text-rc-navy border-rc-gold/40' },
  suspended: { label: 'Suspendu', cls: 'bg-muted text-muted-foreground' },
  refused: { label: 'Refusé', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};
const TABS = [['all', 'Tous'], ['active', 'Actifs'], ['pending', 'En attente'], ['suspended', 'Suspendus'], ['refused', 'Refusés']] as const;

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('staff-access', { body });
  if (error) {
    const msg = error instanceof FunctionsHttpError ? (await error.context.json().catch(() => ({}))).error : error.message;
    throw new Error(msg || 'Erreur');
  }
  return data;
}

const Utilisateurs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Staff[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('all');
  const [q, setQ] = useState('');
  const [approve, setApprove] = useState<Staff | null>(null);
  const [role, setRole] = useState('supplier');
  const [company, setCompany] = useState<string>('none');
  const [confirmDelete, setConfirmDelete] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const d = await call({ action: 'list' });
      setUsers(d.users); setSuppliers(d.suppliers);
    } catch (e: any) { toast({ title: 'Chargement impossible', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const act = async (action: string, u: Staff, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await call({ action, user_id: u.user_id, ...extra });
      toast({ title: 'Mis à jour', description: u.full_name || u.email });
      await load();
    } catch (e: any) { toast({ title: 'Action impossible', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const counts = useMemo(() => Object.fromEntries(TABS.map(([k]) => [k, k === 'all' ? users.length : users.filter((u) => u.status === k).length])), [users]);
  const rows = users.filter((u) => (tab === 'all' || u.status === tab) &&
    (!q || `${u.full_name} ${u.email} ${u.company_name}`.toLowerCase().includes(q.toLowerCase())));
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-rc-navy mb-6">Utilisateurs</h1>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${tab === k ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}{counts[k] ? <span className="ml-1 text-xs opacity-60">{counts[k]}</span> : null}
            </button>
          ))}
          <div className="relative ml-auto w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="h-9 pl-8" />
          </div>
        </div>
        {loading ? <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Utilisateur</th><th className="px-4 py-2 font-medium">Statut</th><th className="px-4 py-2 font-medium">Rôle</th><th className="px-4 py-2 font-medium">Compagnie</th><th className="w-12" /></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Aucun utilisateur</td></tr>}
              {rows.map((u) => {
                const st = STATUS[u.status] ?? STATUS.pending;
                const self = u.user_id === user?.id;
                return (
                  <tr key={u.user_id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3"><p className="font-medium text-foreground">{u.full_name || '—'}{self && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                    <td className="px-4 py-3"><Badge variant="outline" className={st.cls}>{st.label}</Badge></td>
                    <td className="px-4 py-3">{ROLE[u.requested_role] ?? u.requested_role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{supplierName(u.supplier_company_id) || u.company_name || '—'}</td>
                    <td className="px-2 py-3">
                      {!self && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={busy} aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(u.status === 'pending' || u.status === 'refused') && (
                              <DropdownMenuItem onClick={() => { setApprove(u); setRole(u.requested_role); setCompany(u.supplier_company_id ?? 'none'); }}>Approuver</DropdownMenuItem>
                            )}
                            {u.status === 'pending' && <DropdownMenuItem onClick={() => act('refuse', u)}>Refuser</DropdownMenuItem>}
                            {u.status === 'active' && <DropdownMenuItem onClick={() => { setApprove(u); setRole(u.requested_role); setCompany(u.supplier_company_id ?? 'none'); }}>Modifier le rôle</DropdownMenuItem>}
                            {u.status === 'active' && <DropdownMenuItem onClick={() => act('suspend', u)}>Suspendre</DropdownMenuItem>}
                            {u.status === 'suspended' && <DropdownMenuItem onClick={() => act('reactivate', u)}>Réactiver</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(u)}>Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!approve} onOpenChange={(o) => !o && setApprove(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accès de {approve?.full_name || approve?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Rôle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ROLE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select></div>
            {role !== 'admin' && (
              <div className="space-y-2"><Label>Compagnie</Label>
                <Select value={company} onValueChange={setCompany}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {approve?.company_name && <p className="text-xs text-muted-foreground">Compagnie indiquée : {approve.company_name}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprove(null)}>Annuler</Button>
            <Button className="bg-rc-gold text-rc-navy hover:bg-rc-gold/90" disabled={busy}
              onClick={async () => { const u = approve!; setApprove(null); await act('approve', u, { role, supplier_company_id: role !== 'admin' && company !== 'none' ? company : null }); }}>
              Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {confirmDelete?.full_name || confirmDelete?.email} ?</AlertDialogTitle>
            <AlertDialogDescription>Le compte sera supprimé définitivement. La personne devra refaire une demande d'accès.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const u = confirmDelete!; setConfirmDelete(null); act('delete', u); }}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Utilisateurs;
