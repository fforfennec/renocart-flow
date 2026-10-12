import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowDown, Clock, Mail, CheckCircle, XCircle, AlertTriangle, Users, Pause } from 'lucide-react';

export default function AdminFAQ() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground mt-1">Frequently asked questions, guides & automation workflow</p>
      </div>

      {/* Automation Workflow Dropdown */}
      <Card>
        <CardContent className="pt-0 pb-0">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="workflow" className="border-none">
              <AccordionTrigger className="py-5 hover:no-underline">
                <span className="text-base font-semibold">Automation Workflow</span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Processus automatisé de dispatch des commandes vers les fournisseurs. Chaque nouvelle commande suit ce processus.
                </p>
                <div className="space-y-1">
                  <StepCard
                    icon={<Pause className="h-5 w-5" />}
                    title="Nouvelle commande — En attente"
                    subtitle="Délai de 5 minutes avant le premier envoi"
                    color="bg-warning/10 text-warning"
                  >
                    <p className="text-sm text-muted-foreground">
                      Chaque nouvelle commande est mise en attente pendant 5 minutes. Cela permet à un admin d'intervenir, de vérifier ou de mettre en pause l'automation avant qu'elle ne démarre.
                    </p>
                  </StepCard>

                  <FlowArrow />

                  <StepCard
                    icon={<Mail className="h-5 w-5" />}
                    title="Envoi au fournisseur prioritaire"
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

                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-3">Paramètres actuels</p>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Attente initiale</p>
                      <p className="font-semibold text-lg">5 min</p>
                    </div>
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>Common questions about managing orders and suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How do I assign a supplier to an order?</AccordionTrigger>
              <AccordionContent>
                Navigate to the order details page and use the "Assign Supplier" button to select material and delivery suppliers for the order.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>What does "Late" mean?</AccordionTrigger>
              <AccordionContent>
                An order is marked as "Late" when its delivery date has passed and the order status is not yet "Delivered".
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>How can I cancel or reassign an order?</AccordionTrigger>
              <AccordionContent>
                Open the order details page. You'll find options to cancel the order or reassign it to different suppliers in the order actions menu.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>What are the different order statuses?</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>New (Pending):</strong> Order created but not yet assigned</li>
                  <li><strong>Fulfilling (In Progress):</strong> Suppliers have been assigned and are working on it</li>
                  <li><strong>Done (Delivered):</strong> Order has been successfully delivered</li>
                  <li><strong>Cancelled:</strong> Order was cancelled</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>How do I view supplier performance?</AccordionTrigger>
              <AccordionContent>
                Navigate to the "Stats" tab to see detailed analytics including approval rates, response times, and performance metrics for each supplier.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>Features in development</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Favorite suppliers management</li>
            <li>• Advanced filtering and sorting options</li>
            <li>• Export reports to PDF/Excel</li>
            <li>• Real-time notifications for supplier responses</li>
            <li>• Bulk order management tools</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StepCard({ icon, title, subtitle, color, children }: {
  icon: React.ReactNode; title: string; subtitle: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${color} shrink-0`}>{icon}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
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
