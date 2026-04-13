import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Plus, Building2, MapPin, Phone, Mail, User, ChevronDown, ChevronRight,
  Pencil, Trash2, Star, Loader2, Search, Package, Truck
} from 'lucide-react';

type Supplier = {
  id: string; name: string; type: string; notes: string | null; logo_url: string | null;
  created_at: string; updated_at: string;
};
type Branch = {
  id: string; supplier_id: string; name: string; address: string | null; phone: string | null;
  is_headquarters: boolean; created_at: string; updated_at: string;
};
type Contact = {
  id: string; supplier_id: string; branch_id: string | null; full_name: string;
  email: string | null; phone: string | null; role: string | null; is_primary: boolean;
  created_at: string; updated_at: string;
};

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Record<string, Branch[]>>({});
  const [contacts, setContacts] = useState<Record<string, Contact[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'material' | 'delivery'>('all');

  // Add Supplier dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState('material');
  const [addNotes, setAddNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Add Branch dialog
  const [branchDialogFor, setBranchDialogFor] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchIsHQ, setBranchIsHQ] = useState(false);

  // Add Contact dialog
  const [contactDialogFor, setContactDialogFor] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactBranch, setContactBranch] = useState<string>('none');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (e) {
      console.error(e);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const loadDetails = async (supplierId: string) => {
    const [branchRes, contactRes] = await Promise.all([
      supabase.from('supplier_branches').select('*').eq('supplier_id', supplierId).order('is_headquarters', { ascending: false }),
      supabase.from('supplier_contacts').select('*').eq('supplier_id', supplierId).order('is_primary', { ascending: false }),
    ]);
    setBranches(prev => ({ ...prev, [supplierId]: branchRes.data || [] }));
    setContacts(prev => ({ ...prev, [supplierId]: contactRes.data || [] }));
  };

  const toggleExpand = (id: string) => {
    if (expandedSupplier === id) {
      setExpandedSupplier(null);
    } else {
      setExpandedSupplier(id);
      if (!branches[id]) loadDetails(id);
    }
  };

  const handleAddSupplier = async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('suppliers').insert({ name: addName.trim(), type: addType, notes: addNotes || null });
      if (error) throw error;
      toast.success('Fournisseur ajouté');
      setAddOpen(false);
      setAddName(''); setAddType('material'); setAddNotes('');
      loadSuppliers();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Supprimer ce fournisseur et toutes ses données?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) { toast.error('Erreur'); return; }
    toast.success('Fournisseur supprimé');
    loadSuppliers();
  };

  const handleAddBranch = async () => {
    if (!branchDialogFor || !branchName.trim()) return;
    setSaving(true);
    try {
      // If setting as HQ, unset others
      if (branchIsHQ) {
        await supabase.from('supplier_branches').update({ is_headquarters: false }).eq('supplier_id', branchDialogFor);
      }
      const { error } = await supabase.from('supplier_branches').insert({
        supplier_id: branchDialogFor, name: branchName.trim(),
        address: branchAddress || null, phone: branchPhone || null, is_headquarters: branchIsHQ,
      });
      if (error) throw error;
      toast.success('Succursale ajoutée');
      setBranchDialogFor(null);
      setBranchName(''); setBranchAddress(''); setBranchPhone(''); setBranchIsHQ(false);
      loadDetails(branchDialogFor);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async (branchId: string, supplierId: string) => {
    const { error } = await supabase.from('supplier_branches').delete().eq('id', branchId);
    if (error) { toast.error('Erreur'); return; }
    toast.success('Succursale supprimée');
    loadDetails(supplierId);
  };

  const handleAddContact = async () => {
    if (!contactDialogFor || !contactName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('supplier_contacts').insert({
        supplier_id: contactDialogFor, full_name: contactName.trim(),
        email: contactEmail || null, phone: contactPhone || null, role: contactRole || null,
        branch_id: contactBranch === 'none' ? null : contactBranch,
        is_primary: contactIsPrimary,
      });
      if (error) throw error;
      toast.success('Contact ajouté');
      setContactDialogFor(null);
      setContactName(''); setContactEmail(''); setContactPhone(''); setContactRole(''); setContactBranch('none'); setContactIsPrimary(false);
      loadDetails(contactDialogFor);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contactId: string, supplierId: string) => {
    const { error } = await supabase.from('supplier_contacts').delete().eq('id', contactId);
    if (error) { toast.error('Erreur'); return; }
    toast.success('Contact supprimé');
    loadDetails(supplierId);
  };

  const filtered = suppliers.filter(s => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.notes || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rc-navy">Fournisseurs & DSP</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez vos contacts fournisseurs et livreurs</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un fournisseur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau fournisseur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Nom du fournisseur" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={addType} onValueChange={setAddType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Fournisseur Matériaux</SelectItem>
                    <SelectItem value="delivery">DSP – Livraison</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Notes internes..." rows={3} />
              </div>
              <Button onClick={handleAddSupplier} disabled={saving || !addName.trim()} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ajouter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(['all', 'material', 'delivery'] as const).map(t => (
            <Button key={t} variant={filterType === t ? 'default' : 'outline'} size="sm" onClick={() => setFilterType(t)}
              className={filterType === t ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}>
              {t === 'all' ? 'Tous' : t === 'material' ? 'Matériaux' : 'DSP'}
            </Button>
          ))}
        </div>
      </div>

      {/* Supplier Cards */}
      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Aucun fournisseur trouvé</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(supplier => {
            const isExpanded = expandedSupplier === supplier.id;
            const supplierBranches = branches[supplier.id] || [];
            const supplierContacts = contacts[supplier.id] || [];

            return (
              <Card key={supplier.id} className="overflow-hidden">
                {/* Supplier header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(supplier.id)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    supplier.type === 'material' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                  }`}>
                    {supplier.type === 'material' ? <Package className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{supplier.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {supplier.type === 'material' ? 'Matériaux' : 'DSP'}
                      </Badge>
                    </div>
                    {supplier.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{supplier.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={e => { e.stopPropagation(); handleDeleteSupplier(supplier.id); }}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t px-5 py-4 space-y-5 bg-muted/10">
                    {/* Branches */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Building2 className="h-4 w-4" />
                          Succursales ({supplierBranches.length})
                        </h4>
                        <Dialog open={branchDialogFor === supplier.id} onOpenChange={open => {
                          if (!open) { setBranchDialogFor(null); setBranchName(''); setBranchAddress(''); setBranchPhone(''); setBranchIsHQ(false); }
                          else setBranchDialogFor(supplier.id);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" />Succursale</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Ajouter une succursale</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                              <div className="space-y-1.5"><Label>Nom</Label><Input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="Ex: Montréal Nord" /></div>
                              <div className="space-y-1.5"><Label>Adresse</Label><Input value={branchAddress} onChange={e => setBranchAddress(e.target.value)} placeholder="123 rue..." /></div>
                              <div className="space-y-1.5"><Label>Téléphone</Label><Input value={branchPhone} onChange={e => setBranchPhone(e.target.value)} placeholder="514-..." /></div>
                              <div className="flex items-center gap-2">
                                <Switch checked={branchIsHQ} onCheckedChange={setBranchIsHQ} />
                                <Label>Siège social</Label>
                              </div>
                              <Button onClick={handleAddBranch} disabled={saving || !branchName.trim()} className="w-full">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Ajouter
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {supplierBranches.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucune succursale</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {supplierBranches.map(b => (
                            <div key={b.id} className="border rounded-lg p-3 bg-background space-y-1 group relative">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm">{b.name}</span>
                                {b.is_headquarters && (
                                  <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5"><Star className="h-2.5 w-2.5" />Siège</Badge>
                                )}
                              </div>
                              {b.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{b.address}</p>}
                              {b.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{b.phone}</p>}
                              <button onClick={() => handleDeleteBranch(b.id, supplier.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Contacts */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          Contacts ({supplierContacts.length})
                        </h4>
                        <Dialog open={contactDialogFor === supplier.id} onOpenChange={open => {
                          if (!open) { setContactDialogFor(null); setContactName(''); setContactEmail(''); setContactPhone(''); setContactRole(''); setContactBranch('none'); setContactIsPrimary(false); }
                          else setContactDialogFor(supplier.id);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" />Contact</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Ajouter un contact</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                              <div className="space-y-1.5"><Label>Nom complet</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Prénom Nom" /></div>
                              <div className="space-y-1.5"><Label>Email</Label><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@..." type="email" /></div>
                              <div className="space-y-1.5"><Label>Téléphone</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="514-..." /></div>
                              <div className="space-y-1.5"><Label>Poste / Rôle</Label><Input value={contactRole} onChange={e => setContactRole(e.target.value)} placeholder="Ex: Directeur, Vendeur..." /></div>
                              {supplierBranches.length > 0 && (
                                <div className="space-y-1.5">
                                  <Label>Succursale</Label>
                                  <Select value={contactBranch} onValueChange={setContactBranch}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Aucune</SelectItem>
                                      {supplierBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}{b.is_headquarters ? ' (Siège)' : ''}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Switch checked={contactIsPrimary} onCheckedChange={setContactIsPrimary} />
                                <Label>Contact principal</Label>
                              </div>
                              <Button onClick={handleAddContact} disabled={saving || !contactName.trim()} className="w-full">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Ajouter
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {supplierContacts.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun contact</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {supplierContacts.map(c => {
                            const branch = supplierBranches.find(b => b.id === c.branch_id);
                            return (
                              <div key={c.id} className="border rounded-lg p-3 bg-background space-y-1 group relative">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-sm">{c.full_name}</span>
                                  {c.is_primary && <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5"><Star className="h-2.5 w-2.5" />Principal</Badge>}
                                </div>
                                {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                                {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{c.email}</p>}
                                {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{c.phone}</p>}
                                {branch && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{branch.name}</p>}
                                <button onClick={() => handleDeleteContact(c.id, supplier.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
