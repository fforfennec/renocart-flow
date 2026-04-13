import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Package, Truck, Loader2, ChevronRight } from 'lucide-react';

type Supplier = {
  id: string; name: string; type: string; notes: string | null; logo_url: string | null;
  created_at: string; updated_at: string;
};

export default function AdminSuppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState('material');
  const [addNotes, setAddNotes] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleAddSupplier = async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('suppliers').insert({ name: addName.trim(), type: addType, notes: addNotes || null }).select('id').single();
      if (error) throw error;
      toast.success('Fournisseur ajouté');
      setAddOpen(false);
      setAddName(''); setAddType('material'); setAddNotes('');
      navigate(`/admin/suppliers/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
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
            <Button className="gap-2"><Plus className="h-4 w-4" />Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau fournisseur</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2"><Label>Nom</Label><Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Nom du fournisseur" /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={addType} onValueChange={setAddType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Matériaux</SelectItem>
                    <SelectItem value="delivery">DSP</SelectItem>
                    <SelectItem value="both">Fournisseur + DSP</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Notes internes..." rows={3} /></div>
              <Button onClick={handleAddSupplier} disabled={saving || !addName.trim()} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Ajouter
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
        <div className="flex gap-1 flex-wrap">
          {(['all', 'material', 'delivery', 'both', 'other'] as const).map(t => (
            <Button key={t} variant={filterType === t ? 'default' : 'outline'} size="sm" onClick={() => setFilterType(t)}
              className={filterType === t ? 'bg-rc-gold text-rc-navy hover:bg-rc-gold/90' : ''}>
              {t === 'all' ? 'Tous' : t === 'material' ? 'Matériaux' : t === 'delivery' ? 'DSP' : t === 'both' ? 'Fourn. + DSP' : 'Autre'}
            </Button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Aucun fournisseur trouvé</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(supplier => (
            <Card
              key={supplier.id}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/admin/suppliers/${supplier.id}`)}
            >
              {supplier.logo_url ? (
                <img src={supplier.logo_url} alt={supplier.name} className="w-10 h-10 rounded-lg object-contain border bg-background p-0.5" />
              ) : (
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  supplier.type === 'delivery' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
                }`}>
                  {supplier.type === 'delivery' ? <Truck className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{supplier.name}</h3>
                  <Badge variant="outline" className="text-xs">{supplier.type === 'material' ? 'Matériaux' : supplier.type === 'delivery' ? 'DSP' : supplier.type === 'both' ? 'Fourn. + DSP' : 'Autre'}</Badge>
                </div>
                {supplier.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{supplier.notes}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
