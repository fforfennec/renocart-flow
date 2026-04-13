import { useState, useEffect, useCallback } from 'react';
import { Bot, ArrowDown, Clock, Mail, CheckCircle, XCircle, AlertTriangle, Play, Pause, Users, Star, Plus, X, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Supplier = {
  id: string;
  name: string;
  type: string;
  logo_url: string | null;
};

type PriorityEntry = {
  id: string;
  supplier_id: string | null;
  name: string;
  email: string;
  priority_order: number;
  is_active: boolean;
};

const Automations = () => {
  const [automationsPaused, setAutomationsPaused] = useState<boolean | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [priorityList, setPriorityList] = useState<PriorityEntry[]>([]);
  const [prioritizedSupplier, setPrioritizedSupplier] = useState<string | null>(null);
  const [broadcastSuppliers, setBroadcastSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [settingsRes, suppliersRes, priorityRes] = await Promise.all([
      supabase.from('app_settings' as any).select('value').eq('key', 'automations_paused').single(),
      supabase.from('suppliers').select('id, name, type, logo_url').order('name'),
      supabase.from('supplier_priority').select('*').order('priority_order'),
    ]);

    if (settingsRes.data) setAutomationsPaused((settingsRes.data as any).value === 'true');
    if (suppliersRes.data) setSuppliers(suppliersRes.data);
    if (priorityRes.data && priorityRes.data.length > 0) {
      setPriorityList(priorityRes.data);
      // First in priority = prioritized supplier
      const first = priorityRes.data[0];
      if (first.supplier_id) setPrioritizedSupplier(first.supplier_id);
      // Rest = broadcast pool
      setBroadcastSuppliers(
        priorityRes.data.slice(1).filter((p: PriorityEntry) => p.supplier_id).map((p: PriorityEntry) => p.supplier_id!)
      );
    }
    setLoading(false);
  };

  const toggleAutomations = async () => {
    const newValue = !automationsPaused;
    const { error } = await supabase
      .from('app_settings' as any)
      .update({ value: String(newValue), updated_at: new Date().toISOString() } as any)
      .eq('key', 'automations_paused');
    if (error) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }
    setAutomationsPaused(newValue);
    toast.success(newValue ? 'Automations en pause' : 'Automations activées');
  };

  const getSupplier = (id: string) => suppliers.find(s => s.id === id);

  const availableForBroadcast = suppliers.filter(
    s => s.id !== prioritizedSupplier && !broadcastSuppliers.includes(s.id)
  );

  const handleSetPrioritized = async (supplierId: string) => {
    setPrioritizedSupplier(supplierId);
    // Update supplier_priority table: set this as priority_order 1
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    // Get primary contact email
    const { data: contacts } = await supabase
      .from('supplier_contacts')
      .select('email')
      .eq('supplier_id', supplierId)
      .eq('is_primary', true)
      .limit(1);

    const email = contacts?.[0]?.email || '';

    // Check if entry exists
    const existing = priorityList.find(p => p.supplier_id === supplierId);
    if (existing) {
      await supabase.from('supplier_priority').update({ priority_order: 1 } as any).eq('id', existing.id);
    } else {
      await supabase.from('supplier_priority').insert({
        supplier_id: supplierId,
        name: supplier.name,
        email,
        priority_order: 1,
        is_active: true,
      } as any);
    }
    toast.success(`${supplier.name} défini comme fournisseur prioritaire`);
    loadAll();
  };

  const handleAddBroadcast = async (supplierId: string) => {
    setBroadcastSuppliers(prev => [...prev, supplierId]);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const { data: contacts } = await supabase
      .from('supplier_contacts')
      .select('email')
      .eq('supplier_id', supplierId)
      .eq('is_primary', true)
      .limit(1);

    const email = contacts?.[0]?.email || '';
    const nextOrder = broadcastSuppliers.length + 2; // +2 because prioritized is 1

    await supabase.from('supplier_priority').insert({
      supplier_id: supplierId,
      name: supplier.name,
      email,
      priority_order: nextOrder,
      is_active: true,
    } as any);

    toast.success(`${supplier.name} ajouté au broadcast`);
    loadAll();
  };

  const handleRemoveBroadcast = async (supplierId: string) => {
    setBroadcastSuppliers(prev => prev.filter(id => id !== supplierId));
    const entry = priorityList.find(p => p.supplier_id === supplierId);
    if (entry) {
      await supabase.from('supplier_priority').delete().eq('id', entry.id);
    }
    toast.success('Fournisseur retiré du broadcast');
    loadAll();
  };

  const isActive = automationsPaused === false;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-7 w-7 text-secondary" />
          <h1 className="text-2xl font-bold text-secondary">Automations</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            {isActive ? 'Actif' : 'En pause'}
          </span>
          <Switch
            checked={isActive}
            onCheckedChange={toggleAutomations}
            disabled={automationsPaused === null}
          />
          <Badge variant={isActive ? 'default' : 'secondary'} className="gap-1">
            {isActive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isActive ? 'ON' : 'OFF'}
          </Badge>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Workflow automatisé de dispatch des commandes vers les fournisseurs. Chaque nouvelle commande suit ce processus.
      </p>

      {/* Visual Workflow Diagram */}
      <div className="space-y-1">

        {/* Step 1: New Order → Prioritized Supplier */}
        <StepCard
          icon={<Mail className="h-5 w-5" />}
          title="Nouvelle commande"
          subtitle="Envoi automatique au fournisseur prioritaire"
          color="bg-secondary text-secondary-foreground"
        >
          <div className="mt-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Fournisseur prioritaire
            </p>
            {prioritizedSupplier ? (
              <div className="flex items-center gap-3">
                <SupplierBubble supplier={getSupplier(prioritizedSupplier)} large />
                <div className="ml-2">
                  <Select onValueChange={handleSetPrioritized} value={prioritizedSupplier}>
                    <SelectTrigger className="w-[220px] h-8 text-sm">
                      <SelectValue placeholder="Changer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <Select onValueChange={handleSetPrioritized}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Choisir le fournisseur prioritaire..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc mt-3">
              <li>Email envoyé au <strong>contact principal</strong> + contacts <strong>Always CC</strong></li>
              <li>Le fournisseur reçoit un lien de confirmation</li>
            </ul>
          </div>
        </StepCard>

        <FlowArrow />

        {/* Step 2: 35 min wait */}
        <StepCard
          icon={<Clock className="h-5 w-5" />}
          title="Délai de 35 minutes"
          subtitle="Attente de la réponse du fournisseur prioritaire"
          color="bg-warning/10 text-warning"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <BranchCard icon={<CheckCircle className="h-4 w-4" />} title="✅ Accepte" variant="success">
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Commande → <strong>"Fulfilling"</strong></li>
                <li>Timer arrêté</li>
              </ul>
            </BranchCard>
            <BranchCard icon={<XCircle className="h-4 w-4" />} title="❌ Pas de réponse" variant="destructive">
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>+5 min puis envoi à tous les autres</li>
                <li>Email d'info au fournisseur prioritaire</li>
              </ul>
            </BranchCard>
          </div>
        </StepCard>

        <FlowArrow />

        {/* Step 3: Broadcast — with supplier bubbles */}
        <StepCard
          icon={<Users className="h-5 w-5" />}
          title="Envoi à tous les autres fournisseurs"
          subtitle="Premier arrivé, premier servi"
          color="bg-primary/10 text-primary"
        >
          <div className="mt-3">
            <p className="text-sm font-medium mb-3">Fournisseurs dans le broadcast :</p>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {broadcastSuppliers.map(id => {
                const s = getSupplier(id);
                return (
                  <div key={id} className="relative group">
                    <SupplierBubble supplier={s} />
                    <button
                      onClick={() => handleRemoveBroadcast(id)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}

              {/* Add button */}
              {availableForBroadcast.length > 0 && (
                <Select onValueChange={handleAddBroadcast}>
                  <SelectTrigger className="w-10 h-10 rounded-full border-dashed border-2 p-0 flex items-center justify-center [&>svg:last-child]:hidden">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableForBroadcast.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          {s.logo_url && (
                            <img src={s.logo_url} className="h-5 w-5 rounded-full object-cover" />
                          )}
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {broadcastSuppliers.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Aucun fournisseur dans le broadcast. Ajoutez-en avec le bouton +.
              </p>
            )}
          </div>
        </StepCard>

        <FlowArrow />

        {/* Step 4: 30 min delay */}
        <StepCard
          icon={<Clock className="h-5 w-5" />}
          title="Délai de 30 minutes"
          subtitle="Attente de réponse de l'un des fournisseurs"
          color="bg-warning/10 text-warning"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <BranchCard icon={<CheckCircle className="h-4 w-4" />} title="✅ Un fournisseur accepte" variant="success">
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Automation arrêtée</li>
                <li>Email aux autres pour les informer</li>
                <li>Commande → <strong>"Fulfilling"</strong></li>
              </ul>
            </BranchCard>
            <BranchCard icon={<AlertTriangle className="h-4 w-4" />} title="⚠️ Personne ne répond" variant="destructive">
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Automation arrêtée</li>
                <li>Email à tous — c'est géré</li>
                <li>Alerte admin — <strong>gestion manuelle</strong></li>
              </ul>
            </BranchCard>
          </div>
        </StepCard>
      </div>

      {/* Config Summary */}
      <Card className="border-dashed">
        <CardContent className="pt-5">
          <p className="text-sm font-medium mb-3">Paramètres actuels</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Délai prioritaire</p>
              <p className="font-semibold text-lg">35 min</p>
            </div>
            <div>
              <p className="text-muted-foreground">Délai avant broadcast</p>
              <p className="font-semibold text-lg">5 min</p>
            </div>
            <div>
              <p className="text-muted-foreground">Délai broadcast</p>
              <p className="font-semibold text-lg">30 min</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function SupplierBubble({ supplier, large }: { supplier?: Supplier; large?: boolean }) {
  const size = large ? 'h-12 w-12' : 'h-10 w-10';
  const textSize = large ? 'text-sm' : 'text-xs';
  if (!supplier) return null;
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <Avatar className={size}>
        {supplier.logo_url ? (
          <AvatarImage src={supplier.logo_url} alt={supplier.name} className="object-cover" />
        ) : null}
        <AvatarFallback className={`bg-secondary text-secondary-foreground ${textSize} font-semibold`}>
          {supplier.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground text-center leading-tight max-w-[70px] truncate">
        {supplier.name}
      </span>
    </div>
  );
}

function StepCard({ icon, title, subtitle, color, children }: {
  icon: React.ReactNode; title: string; subtitle: string; color: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${color} shrink-0`}>{icon}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mb-1">{subtitle}</p>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BranchCard({ icon, title, variant, children }: {
  icon: React.ReactNode; title: string; variant: 'success' | 'destructive'; children: React.ReactNode;
}) {
  const cls = variant === 'success'
    ? 'border-green-200 bg-green-50/50'
    : 'border-destructive/20 bg-destructive/5';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center py-1">
      <ArrowDown className="h-5 w-5 text-muted-foreground/40" />
    </div>
  );
}

export default Automations;
