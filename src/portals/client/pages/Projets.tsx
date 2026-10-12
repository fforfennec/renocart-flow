import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Download, FileText, FolderOpen, Loader2, LogOut, MapPin, Pencil, Phone, Plus, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClientAuthForm } from "@/portals/client/components/projects/ClientAuthForm";
import { ProjectForm } from "@/portals/client/components/projects/ProjectForm";
import { OrderTracking, StatusBadge } from "@/portals/client/components/projects/OrderTracking";
import { AccountTeam, ProjectMembers } from "@/portals/client/components/projects/AccountTeam";
import { canManageAccount, getClientContext, ROLE_LABEL, type ClientContext } from "@/lib/clientProjects";
import { assignOrder, downloadInvoice, downloadInvoicesZip, listInvoices, listProjects, money, projectAddress, totals, type ClientProject, type InvoiceOrder } from "@/lib/clientProjects";

const NONE = "__none__";

export interface ProjetsSource {
  title: string;
  subtitle?: string;
  extra?: string;
  load: () => Promise<{ projects: ClientProject[]; orders: InvoiceOrder[] }>;
  assign: (orderId: string, projectId: string | null) => Promise<unknown>;
  saveProject: NonNullable<React.ComponentProps<typeof ProjectForm>["save"]>;
}

export default function Projets({ source }: { source?: ProjetsSource }) {
  const { user, loading, signOut } = useAuth();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [orders, setOrders] = useState<InvoiceOrder[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState<string | null>(null); // project id or NONE
  const [form, setForm] = useState<{ project?: ClientProject } | null>(null);
  const [zipping, setZipping] = useState(false);
  const [tab, setTab] = useState<"projets" | "suivi">("projets");
  const [ctx, setCtx] = useState<ClientContext | null>(null);
  // Admin view (source) has full rights; otherwise permissions follow the account role.
  const role = source ? "owner" : ctx?.role;
  const manage = canManageAccount(role);

  useEffect(() => { document.title = "RenoCart — Gestion de projet"; }, []);
  const refresh = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (source) { const data = await source.load(); setProjects(data.projects); setOrders(data.orders); }
      else { const c = await getClientContext(); setCtx(c); const [p, o] = await Promise.all([listProjects(), listInvoices()]); setProjects(p); setOrders(o); }
    }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }, [user, source]);
  useEffect(() => { refresh(); }, [refresh]);

  const byProject = useMemo(() => {
    const m = new Map<string, InvoiceOrder[]>();
    for (const o of orders) { const k = o.project_id ?? NONE; m.set(k, [...(m.get(k) ?? []), o]); }
    return m;
  }, [orders]);

  const assign = async (orderId: string, projectId: string) => {
    try {
      if (source) await source.assign(orderId, projectId === NONE ? null : projectId);
      else await assignOrder(orderId, projectId === NONE ? null : projectId);
      toast.success("Commande déplacée."); refresh();
    }
    catch (e) { toast.error((e as Error).message); }
  };

  const header = (
    <header className="bg-card border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/commander" className="text-2xl font-black tracking-tight text-secondary">RENO<span className="text-primary">CART</span></Link>
        {user && <div className="flex items-center gap-1">
          <Button asChild variant="ghost" className="h-11"><Link to="/commander"><ShoppingCart className="h-4 w-4 mr-2" />Commander</Link></Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Se déconnecter" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>}
      </div>
    </header>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen bg-background">{header}
      <main className="max-w-md mx-auto px-4 py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Gestion de projet</p>
        <h1 className="text-3xl font-black tracking-tight mb-2">Crée ton profil pour voir tes projets</h1>
        <p className="text-muted-foreground mb-5">Sans profil, tes commandes restent anonymes : tu ne peux pas les retrouver, ni télécharger tes factures.</p>
        <ul className="space-y-2 mb-6">
          {["Toutes tes commandes classées par projet", "Tes factures en PDF, une à une ou en fichier ZIP", "Le suivi de tes livraisons : à venir, en cours, livrées"].map((p) => (
            <li key={p} className="flex gap-2 text-sm font-medium"><Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{p}</li>
          ))}
        </ul>
        <div className="bg-card rounded-2xl p-6 shadow-soft"><ClientAuthForm initialMode="signup" /></div>
        <p className="text-xs text-muted-foreground mt-4">Tu as déjà commandé sans profil ? Choisis « J'ai déjà un compte » et utilise le même courriel : tes factures s'y rattachent automatiquement.</p>
      </main>
    </div>
  );

  const current = open && open !== NONE ? projects.find((p) => p.id === open) : null;
  const list = open ? byProject.get(open) ?? [] : [];
  const stats = totals(list);

  return (
    <div className={source ? "bg-background" : "min-h-screen bg-background"}>{!source && header}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {!open ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight">{source ? source.title : "Gestion de projet"}</h1>
                <p className="text-muted-foreground">{source?.subtitle ?? user.email}</p>
                {source?.extra && <p className="text-sm text-muted-foreground">{source.extra}</p>}
                {!source && ctx && ctx.role !== "owner" && <p className="text-sm font-semibold mt-1">{ROLE_LABEL[ctx.role]}</p>}
              </div>
              {manage && <Button className="h-11 font-bold" onClick={() => setForm({})}><Plus className="h-4 w-4 mr-2" />Nouveau projet</Button>}
            </div>
            <div className="flex gap-2 mb-5" role="tablist">
              {(["projets", "suivi"] as const).map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant={tab === t ? "default" : "outline"} className="h-11 font-bold" onClick={() => setTab(t)}>{t === "projets" ? "Projets" : "Suivi"}</Button>)}
            </div>
            {busy ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-12" /> : tab === "suivi" ? <OrderTracking orders={orders} projects={projects} /> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => {
                  const t = totals(byProject.get(p.id) ?? []);
                  return (
                    <Button variant="outline" key={p.id} onClick={() => setOpen(p.id)} className="block h-auto whitespace-normal text-left bg-card rounded-lg p-5 shadow-soft border hover:border-primary transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-black text-lg leading-tight">{p.name}</h2>
                        <span className="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold">{p.code}</span>
                      </div>
                      {projectAddress(p) && <p className="mt-1 text-sm text-muted-foreground flex gap-1.5"><MapPin className="h-4 w-4 shrink-0 mt-0.5" />{projectAddress(p)}</p>}
                      <div className="mt-4 flex justify-between text-sm">
                        <span><b className="text-lg">{money(t.spent)}</b><br /><span className="text-muted-foreground">dépensé</span></span>
                        <span className="text-right"><b className="text-lg">{(byProject.get(p.id) ?? []).length}</b><br /><span className="text-muted-foreground">facture(s)</span></span>
                      </div>
                    </Button>
                  );
                })}
                <Button variant="outline" onClick={() => setOpen(NONE)} className="block h-auto whitespace-normal text-left bg-muted rounded-lg p-5 border border-dashed">
                  <h2 className="font-black text-lg flex items-center gap-2"><FolderOpen className="h-5 w-5" />Sans projet</h2>
                  <p className="text-sm text-muted-foreground mt-1">Commandes non assignées. Tu peux les déplacer dans un projet.</p>
                  <p className="mt-4 text-sm"><b className="text-lg">{(byProject.get(NONE) ?? []).length}</b> facture(s)</p>
                </Button>
                {!projects.length && <p className="sm:col-span-2 text-muted-foreground self-center">{manage ? "Aucun projet pour l'instant. Crée ton premier projet pour regrouper tes commandes." : "Aucun projet ne t'a encore été assigné."}</p>}
              </div>
            )}
            {tab === "projets" && !source && manage && ctx && <AccountTeam selfMemberId={ctx.memberId} />}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setOpen(null)} className="min-h-11 flex items-center gap-1 text-sm font-semibold text-secondary mb-2"><ArrowLeft className="h-4 w-4" />Tous les projets</Button>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">{current ? current.name : "Sans projet"}
                  {current && <span className="rounded-md bg-primary/15 px-2 py-0.5 text-sm font-bold">{current.code}</span>}</h1>
                {current && <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  {projectAddress(current) && <span className="flex gap-1.5"><MapPin className="h-4 w-4" />{projectAddress(current)}</span>}
                  {current.contact_name && <span className="flex gap-1.5"><User className="h-4 w-4" />{current.contact_name}</span>}
                  {current.contact_phone && <span className="flex gap-1.5"><Phone className="h-4 w-4" />{current.contact_phone}</span>}
                </div>}
              </div>
              <div className="flex gap-2">
                {current && manage && <Button variant="outline" className="h-11" onClick={() => setForm({ project: current })}><Pencil className="h-4 w-4 mr-2" />Modifier</Button>}
                <Button className="h-11 font-bold" disabled={!list.length || zipping}
                  onClick={async () => { setZipping(true); try { await downloadInvoicesZip(list, `Factures-${current?.code ?? "sans-projet"}`); } finally { setZipping(false); } }}>
                  {zipping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}Tout télécharger
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <Stat label="Total des dépenses" value={money(stats.spent)} sub={`${money(stats.subtotal)} avant taxes · ${money(stats.tax)} de taxes`} />
              <Stat label="Matériaux commandés" value={`${stats.units} unités`} sub={`${stats.materials.length} produits différents`} />
              <Stat label="Factures" value={String(list.length)} sub={stats.missingPrices ? "Certaines commandes plus anciennes n'ont pas de prix." : " "} />
            </div>

            <div className="grid lg:grid-cols-[1fr_360px] gap-6">
              <section className="bg-card rounded-2xl shadow-soft border">
                <h2 className="p-4 border-b font-bold">Factures</h2>
                {!list.length && <p className="p-6 text-sm text-muted-foreground">Aucune facture.</p>}
                <ul>{list.map((o) => (
                  <li key={o.id} className="p-4 border-b last:border-0 flex flex-wrap items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-semibold">#{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} · {o.order_items.length} article(s)</p>
                    </div>
                    <StatusBadge status={o.status} />
                    <span className="font-bold">{money(o.total_price, o.currency ?? "CAD")}</span>
                    <Select value={o.project_id ?? NONE} onValueChange={(v) => assign(o.id, v)} disabled={role === "employee"}>
                      <SelectTrigger className="w-44 h-11" aria-label="Projet"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sans projet</SelectItem>
                        {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Télécharger la facture" onClick={() => downloadInvoice(o)}><Download className="h-4 w-4" /></Button>
                  </li>
                ))}</ul>
              </section>
              <section className="bg-card rounded-2xl shadow-soft border self-start">
                <h2 className="p-4 border-b font-bold">Matériaux</h2>
                {!stats.materials.length && <p className="p-6 text-sm text-muted-foreground">Rien encore.</p>}
                <ul className="max-h-[60vh] overflow-y-auto">{stats.materials.map((m) => (
                  <li key={m.name} className="px-4 py-2.5 border-b last:border-0 flex justify-between gap-3 text-sm">
                    <span>{m.name}</span><b className="shrink-0">{m.quantity}</b>
                  </li>
                ))}</ul>
              </section>
            </div>
            {current && !source && ctx && ctx.role !== "employee" && <ProjectMembers key={current.id} projectId={current.id} role={ctx.role} selfMemberId={ctx.memberId} />}
          </>
        )}
      </main>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.project ? "Modifier le projet" : "Nouveau projet"}</DialogTitle></DialogHeader>
          {form && <ProjectForm project={form.project} save={source?.saveProject} onCancel={() => setForm(null)} onSaved={() => { setForm(null); toast.success("Projet enregistré."); refresh(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Stat = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="bg-card rounded-2xl p-5 shadow-soft border">
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="text-2xl font-black mt-1">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
  </div>
);
