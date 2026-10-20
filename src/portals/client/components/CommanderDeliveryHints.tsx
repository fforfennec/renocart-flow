import { useState, type ReactNode } from "react";
import { Check, MapPin, Pencil } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { fr as frLocale, enCA } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ClientProject } from "@/lib/clientProjects";
import type { ProjectChoice } from "@/portals/client/components/CommanderProjectPicker";

type Lang = "fr" | "en";
type Dict = Record<string, string>;
export type DeliveryFormValues = {
  delivery_date: string; time_window: string; truck_type: string; note: string;
  address1: string; city: string; province: string; postal_code: string;
  contact_name: string; contact_phone: string;
};
export type DeliveryHintValues = Pick<DeliveryFormValues, "delivery_date" | "time_window" | "truck_type" | "address1" | "city" | "province" | "postal_code">;
export type SavedAddress = { label: string; values: Pick<DeliveryHintValues, "address1" | "city" | "province" | "postal_code"> };

type Shape = {
  title: string; toAdd: (n: number) => string; done: string;
  project: string; noProject: string; newProject: string;
  date: string; window: string; truck: string; address: string;
  tomorrow: string; after: string; pick: string; truckNone: string; other: string; change: string;
  windows: Dict; trucks: Dict;
  street: string; city: string; province: string; postal: string;
};

const T: Record<Lang, Shape> = {
  fr: {
    title: "Livraison", toAdd: (n) => `${n} info${n > 1 ? "s" : ""} à ajouter`, done: "Tout est prêt pour la livraison",
    project: "Projet", noProject: "Aucun projet", newProject: "Nouveau projet",
    date: "Journée de livraison", window: "Moment de la journée", truck: "Camion", address: "Adresse de livraison",
    tomorrow: "Demain", after: "Après-demain", pick: "Autre date", truckNone: "Non, standard", other: "Autre adresse", change: "Changer",
    windows: { Early: "Tôt (avant 10 h)", AM: "Avant-midi", PM: "Après-midi", Day: "N'importe quand" },
    trucks: { Boom: "Camion girafe", "Boom 90ft": "Girafe 90 pi", "Van/Cube": "Camion cube", Hiab: "Grue (Hiab)", unknown: "Je ne sais pas" },
    street: "Adresse", city: "Ville", province: "Province", postal: "Code postal",
  },
  en: {
    title: "Delivery", toAdd: (n) => `${n} more to add`, done: "Delivery details are ready",
    project: "Project", noProject: "No project", newProject: "New project",
    date: "Delivery day", window: "Time of day", truck: "Truck", address: "Delivery address",
    tomorrow: "Tomorrow", after: "Day after", pick: "Other date", truckNone: "No, standard", other: "Another address", change: "Change",
    windows: { Early: "Early (before 10am)", AM: "Morning", PM: "Afternoon", Day: "Anytime" },
    trucks: { Boom: "Boom truck", "Boom 90ft": "Boom 90 ft", "Van/Cube": "Cube van", Hiab: "Crane (Hiab)", unknown: "I don't know" },
    street: "Address", city: "City", province: "Province", postal: "Postal code",
  },
};

const BAND = "flex flex-wrap gap-2 pb-1";
const CHIP = "min-h-9 rounded-full border px-3.5 text-sm font-medium transition-colors";
const IDLE = "border-border bg-card hover:border-primary";
const ACTIVE = "border-primary bg-primary/15 text-foreground";
const FIELD = "h-9 min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Editable delivery shortcuts, independent of the voice pipeline. */
export function CommanderDeliveryHints({ values, lang, onPatch, savedAddress, projects = [], project, onProject, onNewProject }: {
  values: DeliveryHintValues; lang: Lang; onPatch: (p: Partial<DeliveryHintValues>) => void; savedAddress?: SavedAddress | null;
  projects?: ClientProject[]; project?: ProjectChoice; onProject?: (p: ProjectChoice) => void; onNewProject?: () => void;
}) {
  const t = T[lang];
  const [cal, setCal] = useState(false);
  const [manualAddr, setManualAddr] = useState(false);
  const [editing, setEditing] = useState<"date" | "window" | "truck" | null>(null);
  const patch = (p: Partial<DeliveryHintValues>) => { onPatch(p); setEditing(null); };

  const shift = (n: number) => { const day = new Date(); day.setDate(day.getDate() + n); return ymd(day); };
  const dayLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { weekday: "short", day: "numeric", month: "short" });
  const hasDate = !!values.delivery_date;
  const hasWindow = !!values.time_window;
  const hasTruck = !!values.truck_type;
  const hasAddr = [values.address1, values.city, values.province, values.postal_code].every((v) => v.trim());
  const missing = [hasDate, hasWindow, hasTruck, hasAddr].filter((ok) => !ok).length;

  const band = (label: string, body: ReactNode) => (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {body}
    </div>
  );

  const showProject = projects.length > 0 || !!onNewProject;
  const projectBand = showProject && onProject ? band(t.project, (
    <div className={BAND}>
      {projects.map((p) => (
        <button key={p.id} type="button" onClick={() => onProject(p)} className={cn(CHIP, project && project !== "none" && project.id === p.id ? ACTIVE : IDLE)}>
          {p.name}<span className="ml-1.5 opacity-60">{p.code}</span>
        </button>
      ))}
      <button type="button" onClick={() => onProject("none")} className={cn(CHIP, project === "none" ? ACTIVE : IDLE)}>{t.noProject}</button>
      {onNewProject && <button type="button" onClick={onNewProject} className={cn(CHIP, "border-dashed border-border bg-card text-muted-foreground hover:border-primary")}>{t.newProject}</button>}
    </div>
  )) : null;

  const tag = (key: "date" | "window" | "truck", label: string, children: ReactNode) => (
    <Button key={key} type="button" variant="ghost" size="sm" aria-label={`${t.change} : ${label}`} aria-expanded={editing === key}
      onClick={() => setEditing((current) => current === key ? null : key)}
      className="h-auto min-h-9 max-w-full whitespace-normal rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      <Check className="h-3 w-3 shrink-0 text-primary" /><span className="min-w-0 break-words">{children}</span><Pencil className="h-3 w-3 shrink-0" />
    </Button>
  );

  return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide lg:hidden">{t.title}</p>
        <p className="text-[11px] text-muted-foreground">{missing ? t.toAdd(missing) : t.done}</p>
      </div>
      <div className="space-y-3">
        {projectBand}
        {(!hasDate || editing === "date") && band(t.date, <>
          <div className={BAND}>
            <Button variant="outline" type="button" onClick={() => patch({ delivery_date: shift(1) })} className={cn(CHIP, values.delivery_date === shift(1) ? ACTIVE : IDLE)}>{t.tomorrow}</Button>
            <Button variant="outline" type="button" onClick={() => patch({ delivery_date: shift(2) })} className={cn(CHIP, values.delivery_date === shift(2) ? ACTIVE : IDLE)}>{t.after}</Button>
            <button type="button" aria-expanded={cal} onClick={() => setCal((c) => !c)} className={cn(CHIP, cal ? ACTIVE : IDLE)}>{t.pick}</button>
          </div>
          {cal && (
            <div className="mt-2 w-fit max-w-full overflow-x-auto rounded-xl border bg-card p-1">
              <Calendar mode="single" locale={lang === "fr" ? frLocale : enCA}
                selected={values.delivery_date ? new Date(`${values.delivery_date}T12:00:00`) : undefined}
                disabled={{ before: new Date(Date.now() + 864e5) }}
                onSelect={(day) => { if (day) { patch({ delivery_date: ymd(day) }); setCal(false); } }} />
            </div>
          )}
        </>)}
        {(!hasWindow || editing === "window") && band(t.window, (
          <div className={BAND}>
            {Object.entries(t.windows).map(([key, label]) => (
              <Button variant="outline" key={key} type="button" onClick={() => patch({ time_window: key })} className={cn(CHIP, values.time_window === key ? ACTIVE : IDLE)}>{label}</Button>
            ))}
          </div>
        ))}
        {(!hasTruck || editing === "truck") && band(t.truck, (
          <div className={BAND}>
            <Button variant="outline" type="button" onClick={() => patch({ truck_type: "none" })} className={cn(CHIP, values.truck_type === "none" ? ACTIVE : IDLE)}>{t.truckNone}</Button>
            {Object.entries(t.trucks).map(([key, label]) => (
              <Button variant="outline" key={key} type="button" onClick={() => patch({ truck_type: key })} className={cn(CHIP, values.truck_type === key ? ACTIVE : IDLE)}>{label}</Button>
            ))}
          </div>
        ))}
        {!hasAddr && band(t.address, savedAddress && !manualAddr ? (
          <div className={BAND}>
            <button type="button" onClick={() => onPatch(savedAddress.values)} className={cn(CHIP, "flex items-center gap-1.5", IDLE)}>
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />{savedAddress.label}
            </button>
            <button type="button" onClick={() => setManualAddr(true)} className={cn(CHIP, "border-dashed border-border bg-card text-muted-foreground hover:border-primary")}>{t.other}</button>
          </div>
        ) : (
          <div className="grid gap-2">
            <input className={FIELD} placeholder={t.street} value={values.address1} onChange={(e) => onPatch({ address1: e.target.value })} />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2">
              <input className={FIELD} placeholder={t.city} value={values.city} onChange={(e) => onPatch({ city: e.target.value })} />
              <input className={FIELD} placeholder={t.province} value={values.province} onChange={(e) => onPatch({ province: e.target.value })} />
              <input className={FIELD} placeholder={t.postal} value={values.postal_code} onChange={(e) => onPatch({ postal_code: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      {(hasDate || hasWindow || hasTruck || hasAddr) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
          {hasDate && tag("date", t.date, dayLabel(values.delivery_date))}
          {hasWindow && tag("window", t.window, t.windows[values.time_window] ?? values.time_window)}
          {hasTruck && tag("truck", t.truck, values.truck_type === "none" ? t.truckNone : t.trucks[values.truck_type] ?? values.truck_type)}
          {hasAddr && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3 shrink-0 text-primary" />
              <span className="min-w-0 break-words">{[values.address1, values.city].filter(Boolean).join(", ")}</span>
              <button type="button" onClick={() => { setManualAddr(true); onPatch({ address1: "", city: "", postal_code: "" }); }}
                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold hover:bg-background">
                <Pencil className="h-3 w-3" />{t.change}
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
