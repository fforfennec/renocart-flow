import { useState, useEffect } from 'react';
import { Bot, ArrowDown, Clock, Mail, CheckCircle, XCircle, AlertTriangle, Play, Pause, Users, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Automations = () => {
  const [automationsPaused, setAutomationsPaused] = useState<boolean | null>(null);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    const { data } = await supabase
      .from('app_settings' as any)
      .select('value')
      .eq('key', 'automations_paused')
      .single();
    if (data) setAutomationsPaused((data as any).value === 'true');
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

  const isActive = automationsPaused === false;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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

      {/* Workflow Steps */}
      <div className="space-y-1">

        {/* Step 1: New Order */}
        <StepCard
          icon={<Mail className="h-5 w-5" />}
          title="Nouvelle commande"
          subtitle="Envoi automatique au fournisseur prioritaire"
          color="bg-secondary text-secondary-foreground"
        >
          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Email envoyé au <strong>contact principal</strong> du fournisseur prioritaire</li>
            <li>Contacts marqués <strong>Always CC</strong> inclus en copie</li>
            <li>Le fournisseur reçoit un lien de confirmation</li>
          </ul>
        </StepCard>

        <FlowArrow />

        {/* Step 2: 35 min delay */}
        <StepCard
          icon={<Clock className="h-5 w-5" />}
          title="Délai de 35 minutes"
          subtitle="Attente de la réponse du fournisseur prioritaire"
          color="bg-warning/10 text-warning"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <BranchCard
              icon={<CheckCircle className="h-4 w-4 text-green-600" />}
              title="✅ Le fournisseur accepte"
              variant="success"
            >
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>La commande passe à <strong>"Fulfilling"</strong></li>
                <li>Le timer s'arrête</li>
                <li>Notification admin envoyée</li>
              </ul>
            </BranchCard>

            <BranchCard
              icon={<XCircle className="h-4 w-4 text-destructive" />}
              title="❌ Pas de réponse"
              variant="destructive"
            >
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Attendre <strong>5 min</strong> supplémentaires</li>
                <li>Email envoyé à <strong>tous les autres fournisseurs</strong> (principal + CC)</li>
                <li>Email au fournisseur prioritaire pour l'informer du transfert</li>
              </ul>
            </BranchCard>
          </div>
        </StepCard>

        <FlowArrow />

        {/* Step 3: Broadcast to all */}
        <StepCard
          icon={<Users className="h-5 w-5" />}
          title="Envoi à tous les fournisseurs"
          subtitle="Premier arrivé, premier servi"
          color="bg-primary/10 text-primary"
        >
          <p className="text-sm text-muted-foreground">
            La commande est envoyée simultanément à tous les autres fournisseurs actifs. Le premier à accepter remporte la commande.
          </p>
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
            <BranchCard
              icon={<CheckCircle className="h-4 w-4 text-green-600" />}
              title="✅ Un fournisseur accepte"
              variant="success"
            >
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Automation arrêtée</li>
                <li>Email envoyé aux <strong>autres fournisseurs</strong> pour les informer</li>
                <li>La commande passe à <strong>"Fulfilling"</strong></li>
              </ul>
            </BranchCard>

            <BranchCard
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              title="⚠️ Personne ne répond"
              variant="destructive"
            >
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Automation arrêtée</li>
                <li>Email à tous les fournisseurs pour les informer que c'est géré</li>
                <li>Alerte admin — <strong>gestion manuelle requise</strong></li>
              </ul>
            </BranchCard>
          </div>
        </StepCard>

      </div>

      {/* Config Summary */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paramètres</CardTitle>
        </CardHeader>
        <CardContent>
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

function StepCard({ icon, title, subtitle, color, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${color} shrink-0`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mb-2">{subtitle}</p>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BranchCard({ icon, title, variant, children }: {
  icon: React.ReactNode;
  title: string;
  variant: 'success' | 'destructive';
  children: React.ReactNode;
}) {
  const borderColor = variant === 'success' ? 'border-green-200 bg-green-50/50' : 'border-destructive/20 bg-destructive/5';
  return (
    <div className={`rounded-lg border p-3 ${borderColor}`}>
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
