import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, User, Plus,
  Trash2, Star, Loader2, Package, Truck, ImagePlus
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

export default function SupplierDetail() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Edit supplier
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editType, setEditType] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const typeLabel = (t: string) => t === 'material' ? 'Matériaux' : t === 'delivery' ? 'DSP' : t === 'both' ? 'Fournisseur + DSP' : 'Autre';

  // Add Branch
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchIsHQ, setBranchIsHQ] = useState(false);

  // Add/Edit Contact
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactBranch, setContactBranch] = useState<string>('none');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  const loadData = useCallback(async () => {
    if (!supplierId) return;
    try {
      const [supRes, brRes, coRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('id', supplierId).single(),
        supabase.from('supplier_branches').select('*').eq('supplier_id', supplierId).order('is_headquarters', { ascending: false }),
        supabase.from('supplier_contacts').select('*').eq('supplier_id', supplierId).order('is_primary', { ascending: false }),
      ]);
      if (supRes.error) throw supRes.error;
      setSupplier(supRes.data);
      setEditName(supRes.data.name);
      setEditType(supRes.data.type);
      setEditNotes(supRes.data.notes || '');
      setBranches(brRes.data || []);
      setContacts(coRes.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveSupplier = async () => {
    if (!supplierId || !editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('suppliers').update({ name: editName.trim(), type: editType, notes: editNotes || null }).eq('id', supplierId);
      if (error) throw error;
      toast.success('Fournisseur mis à jour');
      setIsEditing(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supplierId) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `supplier-logos/${supplierId}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('order-photos').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(path);
      const logoUrl = urlData.publicUrl + '?t=' + Date.now();
      const { error: updateErr } = await supabase.from('suppliers').update({ logo_url: logoUrl }).eq('id', supplierId);
      if (updateErr) throw updateErr;
      toast.success('Logo mis à jour');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Erreur upload');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAddBranch = async () => {
    if (!supplierId || !branchName.trim()) return;
    setSaving(true);
    try {
      if (branchIsHQ) {
        await supabase.from('supplier_branches').update({ is_headquarters: false }).eq('supplier_id', supplierId);
      }
      const { error } = await supabase.from('supplier_branches').insert({
        supplier_id: supplierId, name: branchName.trim(),
        address: branchAddress || null, phone: branchPhone || null, is_headquarters: branchIsHQ,
      });
      if (error) throw error;
      toast.success('Succursale ajoutée');
      setBranchDialogOpen(false);
      setBranchName(''); setBranchAddress(''); setBranchPhone(''); setBranchIsHQ(false);
      loadData();
    } catch (e: any) { toast.error(e.message || 'Erreur'); } finally { setSaving(false); }
  };

  const handleDeleteBranch = async (id: string) => {
    const { error } = await supabase.from('supplier_branches').delete().eq('id', id);
    if (error) { toast.error('Erreur'); return; }
    toast.success('Succursale supprimée');
    loadData();
  };

  const resetContactForm = () => {
    setEditingContactId(null);
    setContactName(''); setContactEmail(''); setContactPhone(''); setContactRole(''); setContactBranch('none'); setContactIsPrimary(false);
  };

  const openEditContact = (c: Contact) => {
    setEditingContactId(c.id);
    setContactName(c.full_name);
    setContactEmail(c.email || '');
    setContactPhone(c.phone || '');
    setContactRole(c.role || '');
    setContactBranch(c.branch_id || 'none');
    setContactIsPrimary(c.is_primary);
    setContactDialogOpen(true);
  };

  const handleSaveContact = async () => {
    if (!supplierId || !contactName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        supplier_id: supplierId, full_name: contactName.trim(),
        email: contactEmail || null, phone: contactPhone || null, role: contactRole || null,
        branch_id: contactBranch === 'none' ? null : contactBranch, is_primary: contactIsPrimary,
      };
      if (editingContactId) {
        const { error } = await supabase.from('supplier_contacts').update(payload).eq('id', editingContactId);
        if (error) throw error;
        toast.success('Contact mis à jour');
      } else {
        const { error } = await supabase.from('supplier_contacts').insert(payload);
        if (error) throw error;
        toast.success('Contact ajouté');
      }
      setContactDialogOpen(false);
      resetContactForm();
      loadData();
    } catch (e: any) { toast.error(e.message || 'Erreur'); } finally { setSaving(false); }
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from('supplier_contacts').delete().eq('id', id);
    if (error) { toast.error('Erreur'); return; }
    toast.success('Contact supprimé');
    loadData();
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">Chargement...</div>;
  if (!supplier) return <div className="p-6 text-center text-muted-foreground">Fournisseur introuvable</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/suppliers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative group">
          {supplier.logo_url ? (
            <img src={supplier.logo_url} alt={supplier.name} className="w-14 h-14 rounded-xl object-contain border bg-background p-1" />
          ) : (
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              supplier.type === 'material' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
            }`}>
              {supplier.type === 'material' ? <Package className="h-7 w-7" /> : <Truck className="h-7 w-7" />}
            </div>
          )}
          <label className="absolute inset-0 flex items-center justify-center bg-foreground/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            {uploadingLogo ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <ImagePlus className="h-5 w-5 text-white" />}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
          </label>
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="text-xl font-bold max-w-xs" />
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Matériaux</SelectItem>
                    <SelectItem value="delivery">DSP</SelectItem>
                    <SelectItem value="both">Fournisseur + DSP</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes..." className="max-w-md" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveSupplier} disabled={saving}>Sauvegarder</Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditName(supplier.name); setEditType(supplier.type); }}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-rc-navy cursor-pointer hover:underline" onClick={() => setIsEditing(true)}>{supplier.name}</h1>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => setIsEditing(true)}>{typeLabel(supplier.type)}</Badge>
              </div>
              {supplier.notes && <p className="text-sm text-muted-foreground mt-1">{supplier.notes}</p>}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Branches */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />Succursales ({branches.length})</h2>
          <Dialog open={branchDialogOpen} onOpenChange={open => {
            setBranchDialogOpen(open);
            if (!open) { setBranchName(''); setBranchAddress(''); setBranchPhone(''); setBranchIsHQ(false); }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" />Succursale</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter une succursale</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5"><Label>Nom</Label><Input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="Ex: Montréal Nord" /></div>
                <div className="space-y-1.5"><Label>Adresse</Label><Input value={branchAddress} onChange={e => setBranchAddress(e.target.value)} placeholder="123 rue..." /></div>
                <div className="space-y-1.5"><Label>Téléphone</Label><Input value={branchPhone} onChange={e => setBranchPhone(e.target.value)} placeholder="514-..." /></div>
                <div className="flex items-center gap-2"><Switch checked={branchIsHQ} onCheckedChange={setBranchIsHQ} /><Label>Siège social</Label></div>
                <Button onClick={handleAddBranch} disabled={saving || !branchName.trim()} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Ajouter
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardContent className="p-5">
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">Aucune succursale</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {branches.map(b => (
                <div key={b.id} className="border rounded-lg p-4 bg-muted/10 space-y-1.5 group relative">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.name}</span>
                    {b.is_headquarters && <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5"><Star className="h-2.5 w-2.5" />Siège</Badge>}
                  </div>
                  {b.address && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" />{b.address}</p>}
                  {b.phone && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{b.phone}</p>}
                  <button onClick={() => handleDeleteBranch(b.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" />Contacts ({contacts.length})</h2>
          <Dialog open={contactDialogOpen} onOpenChange={open => {
            setContactDialogOpen(open);
            if (!open) resetContactForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => resetContactForm()}><Plus className="h-3.5 w-3.5" />Contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingContactId ? 'Modifier le contact' : 'Ajouter un contact'}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5"><Label>Nom complet</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Prénom Nom" /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@..." type="email" /></div>
                <div className="space-y-1.5"><Label>Téléphone</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="514-..." /></div>
                <div className="space-y-1.5"><Label>Poste / Rôle</Label><Input value={contactRole} onChange={e => setContactRole(e.target.value)} placeholder="Ex: Directeur..." /></div>
                {branches.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Succursale</Label>
                    <Select value={contactBranch} onValueChange={setContactBranch}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}{b.is_headquarters ? ' (Siège)' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-2"><Switch checked={contactIsPrimary} onCheckedChange={setContactIsPrimary} /><Label>Contact principal</Label></div>
                <Button onClick={handleSaveContact} disabled={saving || !contactName.trim()} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingContactId ? 'Sauvegarder' : 'Ajouter'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardContent className="p-5">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">Aucun contact</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contacts.map(c => {
                const branch = branches.find(b => b.id === c.branch_id);
                return (
                  <div key={c.id} onClick={() => openEditContact(c)} className="border rounded-lg p-4 bg-muted/10 space-y-1.5 group relative cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.full_name}</span>
                      {c.is_primary && <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5"><Star className="h-2.5 w-2.5" />Principal</Badge>}
                    </div>
                    {c.role && <p className="text-sm text-muted-foreground">{c.role}</p>}
                    {c.email && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" />{c.email}</p>}
                    {c.phone && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{c.phone}</p>}
                    {branch && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0" />{branch.name}</p>}
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.id); }} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
