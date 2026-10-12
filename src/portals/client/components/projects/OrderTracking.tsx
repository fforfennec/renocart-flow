import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Truck, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDay, STAGE_LABEL, trackStage, type ClientProject, type InvoiceOrder, type TrackStage } from "@/lib/clientProjects";

const ICON = { delivered: CheckCircle2, en_route: Truck, upcoming: Clock, cancelled: XCircle };
const TONE: Record<TrackStage, string> = {
  delivered: "bg-primary/15 text-foreground",
  en_route: "bg-secondary text-secondary-foreground",
  upcoming: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const s = trackStage(status); const I = ICON[s];
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${TONE[s]}`}><I className="h-3.5 w-3.5" />{STAGE_LABEL[s]}</span>;
}

const ALL = "__all__"; const NONE = "__none__";
const ORDER: TrackStage[] = ["en_route", "upcoming", "delivered", "cancelled"];

export function OrderTracking({ orders, projects }: { orders: InvoiceOrder[]; projects: ClientProject[] }) {
  const [project, setProject] = useState(ALL);
  const [stage, setStage] = useState<string>(ALL);
  const [day, setDay] = useState("");
  const pName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "Sans projet";

  const filtered = useMemo(() => orders.filter((o) =>
    (project === ALL || (project === NONE ? !o.project_id : o.project_id === project)) &&
    (stage === ALL || trackStage(o.status) === stage) &&
    (!day || o.delivery_date === day)), [orders, project, stage, day]);

  const counts = useMemo(() => {
    const c: Record<TrackStage, number> = { delivered: 0, en_route: 0, upcoming: 0, cancelled: 0 };
    for (const o of filtered) c[trackStage(o.status)]++;
    return c;
  }, [filtered]);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {ORDER.map((s) => { const I = ICON[s]; return (
          <Button key={s} variant="outline" onClick={() => setStage(stage === s ? ALL : s)}
            className={`h-auto block text-left bg-card rounded-2xl p-4 border ${stage === s ? "border-primary" : ""}`}>
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><I className="h-4 w-4" />{STAGE_LABEL[s]}</span>
            <span className="block text-2xl font-black mt-1">{counts[s]}</span>
          </Button>); })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="w-52 h-11" aria-label="Projet"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les projets</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
            <SelectItem value={NONE}>Sans projet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-56 h-11" aria-label="Statut"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les statuts</SelectItem>
            {ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44 h-11" aria-label="Journée de livraison" />
        {(project !== ALL || stage !== ALL || day) && <Button variant="ghost" className="h-11" onClick={() => { setProject(ALL); setStage(ALL); setDay(""); }}>Effacer les filtres</Button>}
      </div>

      <section className="bg-card rounded-2xl shadow-soft border">
        {!filtered.length && <p className="p-6 text-sm text-muted-foreground">Aucune commande.</p>}
        <ul>{filtered.map((o) => {
          const s = trackStage(o.status);
          const when = s === "delivered" ? `Livrée le ${fmtDay(o.delivery_date ?? o.updated_at)}`
            : s === "en_route" ? `Arrivée estimée : ${fmtDay(o.delivery_date)}${o.delivery_time_window ? ` · ${o.delivery_time_window}` : ""}`
            : s === "upcoming" ? `Livraison prévue : ${fmtDay(o.delivery_date)}${o.delivery_time_window ? ` · ${o.delivery_time_window}` : ""}` : "";
          return (
            <li key={o.id} className="p-4 border-b last:border-0 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold">#{o.order_number} <span className="text-muted-foreground font-normal">· {pName(o.project_id)}</span></p>
                <p className="text-xs text-muted-foreground">{when || "—"} · {o.order_items.length} article(s)</p>
              </div>
              <StatusBadge status={o.status} />
            </li>);
        })}</ul>
      </section>
    </div>
  );
}
