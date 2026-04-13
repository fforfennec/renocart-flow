import { useState, useEffect, useCallback } from 'react';
import { Bot, ArrowDown, Clock, Mail, CheckCircle, XCircle, AlertTriangle, Play, Pause, Users, Star, Plus, X, Info, HandMetal, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Supplier = { id: string; name: string; type: string; logo_url: string | null };
type PriorityEntry = { id: string; supplier_id: string | null; name: string; email: string; priority_order: number; is_active: boolean };

const Automations = () => {
  const [automationsPaused, setAutomationsPaused] = useState<boolean | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [priorityList, setPriorityList] = useState<PriorityEntry[]>([]);
  const [prioritizedSupplier, setPrioritizedSupplier] = useState<string | null>(null);
  const [broadcastSuppliers, setBroadcastSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [settingsRes, suppliersRes, priorityRes] = await Promise.all([
      supabase.from('app_settings' as any).select('value').eq('key', 'automations_paused').single(),
      supabase.from('suppliers').select('id, name, type, logo_url').order('name'),
      supabase.from('supplier_priority').select('*').order('priority_order'),
    ]);
    if (settingsRes.data) setAutomationsPaused((settingsRes.data as any).value === 'true');
    if (suppliersRes.data) setSuppliers(suppliersRes.data);
    if (priorityRes.data) {
      setPriorityList(priorityRes.data);
      const first = priorityRes.data.find((p: PriorityEntry) => p.priority_order === 1);
      if (first?.supplier_id) {
        setPrioritizedSupplier(first.supplier_id);
      } else {
        setPrioritizedSupplier(null);
      }
      setBroadcastSuppliers(
        priorityRes.data
          .filter((p: PriorityEntry) => p.supplier_id && p.priority_order !== 1)
          .map((p: PriorityEntry) => p.supplier_id!)
      );
    } else {
      setPriorityList([]);
      setPrioritizedSupplier(null);
      setBroadcastSuppliers([]);
    }
    setLoading(false);
  };

  const toggleAutomations = async () => {
    const newValue = !automationsPaused;
    const { error } = await supabase
      .from('app_settings' as any)
      .update({ value: String(newValue), updated_at: new Date().toISOString() } as any)
      .eq('key', 'automations_paused');
    if (error) { toast.error('Erreur'); return; }
    setAutomationsPaused(newValue);
    toast.success(newValue ? 'Automations en pause' : 'Automations activées');
  };

  const getSupplier = (id: string) => suppliers.find(s => s.id === id);
  const availableForBroadcast = suppliers.filter(s => s.id !== prioritizedSupplier && !broadcastSuppliers.includes(s.id));

  const handleSetPrioritized = async (supplierId: string) => {
    setPrioritizedSupplier(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    const { data: contacts } = await supabase.from('supplier_contacts').select('email').eq('supplier_id', supplierId).eq('is_primary', true).limit(1);
    const email = contacts?.[0]?.email || 'no-email@placeholder.com';
    const existing = priorityList.find(p => p.supplier_id === supplierId);
    if (existing) {
      await supabase.from('supplier_priority').update({ priority_order: 1 } as any).eq('id', existing.id);
    } else {
      const { error } = await supabase.from('supplier_priority').insert({ supplier_id: supplierId, name: supplier.name, email, priority_order: 1, is_active: true } as any);
      if (error) { console.error('Insert error:', error); toast.error('Erreur'); return; }
    }
    toast.success(`${supplier.name} → prioritaire`);
    await loadAll();
  };

  const handleAddBroadcast = async (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    const { data: contacts } = await supabase.from('supplier_contacts').select('email').eq('supplier_id', supplierId).eq('is_primary', true).limit(1);
    const email = contacts?.[0]?.email || 'no-email@placeholder.com';
    const { error } = await supabase.from('supplier_priority').insert({ supplier_id: supplierId, name: supplier.name, email, priority_order: broadcastSuppliers.length + 2, is_active: true } as any);
    if (error) {
      console.error('Insert error:', error);
      toast.error('Erreur lors de l\'ajout');
      return;
    }
    toast.success(`${supplier.name} ajouté`);
    await loadAll();
  };

  const handleRemoveBroadcast = async (supplierId: string) => {
    setBroadcastSuppliers(prev => prev.filter(id => id !== supplierId));
    const entry = priorityList.find(p => p.supplier_id === supplierId);
    if (entry) await supabase.from('supplier_priority').delete().eq('id', entry.id);
    toast.success('Retiré');
    loadAll();
  };

  const isActive = automationsPaused === false;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-7 w-7 text-secondary" />
            <h1 className="text-2xl font-bold text-secondary">Automations</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{isActive ? 'Actif' : 'En pause'}</span>
            <Switch checked={isActive} onCheckedChange={toggleAutomations} disabled={automationsPaused === null} />
            <Badge variant={isActive ? 'default' : 'secondary'} className="gap-1">
              {isActive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {isActive ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Important notice */}
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong>Seuls les fournisseurs ajoutés sur cette page</strong> recevront des emails automatiques. Les fournisseurs du CRM non listés ici ne seront jamais contactés par l'automation.
          </p>
        </div>

        {/* Compact Workflow */}
        <div className="space-y-0">

          {/* Step 1 */}
          <CompactStep
            icon={<Mail className="h-4 w-4" />}
            title="Nouvelle commande"
            color="bg-secondary text-secondary-foreground"
            tooltip="Email envoyé au contact principal + CC du fournisseur prioritaire avec un lien de confirmation."
          >
            {/* Prioritized supplier picker */}
            <div className="flex items-center gap-2 mt-2">
              <Star className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">Prioritaire :</span>
              {prioritizedSupplier && <SupplierBubble supplier={getSupplier(prioritizedSupplier)} />}
              <Select onValueChange={handleSetPrioritized} value={prioritizedSupplier || undefined}>
                <SelectTrigger className="h-7 w-[160px] text-xs">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {s.logo_url && <img src={s.logo_url} className="h-4 w-4 rounded-full object-cover" />}
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CompactStep>

          <FlowArrow label="35 min" />

          {/* Step 2: Branch */}
          <div className="grid grid-cols-2 gap-3">
            <CompactBranch variant="success" title="Accepte" tooltip="La commande passe à Fulfilling et le timer s'arrête. Notification admin envoyée." />
            <CompactBranch variant="destructive" title="Pas de réponse" tooltip="Attendre 5 min supplémentaires puis envoi à tous les autres fournisseurs. Le fournisseur prioritaire est informé du transfert." />
          </div>

          <FlowArrow label="5 min" />

          {/* Step 3: Broadcast */}
          <CompactStep
            icon={<Users className="h-4 w-4" />}
            title="Broadcast"
            color="bg-primary/10 text-primary"
            tooltip="La commande est envoyée simultanément à tous les fournisseurs ci-dessous. Premier arrivé, premier servi."
          >
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {broadcastSuppliers.map(id => {
                const s = getSupplier(id);
                return (
                  <DropdownMenu key={id}>
                    <DropdownMenuTrigger asChild>
                      <div className="cursor-pointer">
                        <SupplierBubble supplier={s} />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-36">
                      <DropdownMenuItem
                        onClick={() => handleRemoveBroadcast(id)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Retirer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
              {availableForBroadcast.length > 0 && (
                <Select onValueChange={handleAddBroadcast}>
                  <SelectTrigger className="w-8 h-8 rounded-full border-dashed border-2 p-0 flex items-center justify-center [&>svg:last-child]:hidden">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableForBroadcast.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          {s.logo_url && <img src={s.logo_url} className="h-4 w-4 rounded-full object-cover" />}
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CompactStep>

          <FlowArrow label="30 min" />

          {/* Step 4: Final branch */}
          <div className="grid grid-cols-2 gap-3">
            <CompactBranch variant="success" title="Un fournisseur accepte" tooltip="Automation arrêtée. Email envoyé aux autres fournisseurs pour les informer. Commande → Fulfilling." />
            <CompactBranch variant="destructive" title="Personne ne répond" tooltip="Automation arrêtée. Email à tous les fournisseurs. Alerte admin — gestion manuelle requise." />
          </div>

          <FlowArrow label="" />

          {/* Step 5: Manual assignment */}
          <CompactStep
            icon={<HandMetal className="h-4 w-4" />}
            title="Assignation manuelle"
            color="bg-destructive/10 text-destructive"
            tooltip="L'automation est terminée. Un admin doit prendre le relais et assigner manuellement la commande à un fournisseur depuis la page de détail."
          />

        </div>
      </div>
    </TooltipProvider>
  );
};

function HelpDot({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground cursor-help ml-1 shrink-0">
          <span className="text-[10px] font-bold">?</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function CompactStep({ icon, title, color, tooltip, children }: {
  icon: React.ReactNode; title: string; color: string; tooltip: string; children?: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 ${color} shrink-0`}>{icon}</div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <HelpDot text={tooltip} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function CompactBranch({ variant, title, tooltip }: {
  variant: 'success' | 'destructive'; title: string; tooltip: string;
}) {
  const cls = variant === 'success'
    ? 'border-green-200 bg-green-50/50'
    : 'border-destructive/20 bg-destructive/5';
  const icon = variant === 'success'
    ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
    : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  return (
    <div className={`rounded-lg border p-3 ${cls} flex items-center gap-2`}>
      {icon}
      <span className="text-xs font-medium">{title}</span>
      <HelpDot text={tooltip} />
    </div>
  );
}

function SupplierBubble({ supplier }: { supplier?: Supplier }) {
  if (!supplier) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="shrink-0">
          <Avatar className="h-8 w-8">
            {supplier.logo_url ? <AvatarImage src={supplier.logo_url} alt={supplier.name} className="object-cover" /> : null}
            <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-semibold">
              {supplier.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{supplier.name}</TooltipContent>
    </Tooltip>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full -mt-0.5">{label}</span>
    </div>
  );
}

export default Automations;
