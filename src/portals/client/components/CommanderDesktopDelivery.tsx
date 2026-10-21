import { useState, type ReactNode } from "react";
import { MapPin, Pencil } from "lucide-react";
import { fr, enCA } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { ClientProject } from "@/lib/clientProjects";
import type { ProjectChoice } from "./CommanderProjectPicker";
import type { DeliveryHintValues, SavedAddress } from "./CommanderDeliveryHints";

const labels = {

  fr: { project: "Projet", chooseProject: "Choisir un projet", noProject: "Aucun projet", newProject: "Nouveau projet", date: "Journée de livraison", window: "Moment de la journée", truck: "Camion", address: "Adresse de livraison", tomorrow: "Demain", after: "Après-demain", pick: "Autre date", standard: "Non, standard", other: "Autre adresse", change: "Changer", street: "Adresse", city: "Ville", province: "Province", postal: "Code postal", windows: { Early: "Tôt (avant 10 h)", AM: "Avant-midi", PM: "Après-midi", Day: "N'importe quand" }, trucks: { Boom: "Camion girafe", "Boom 90ft": "Girafe 90 pi", "Van/Cube": "Camion cube", Hiab: "Grue (Hiab)", unknown: "Je ne sais pas" } },
  en: { project: "Project", chooseProject: "Choose a project", noProject: "No project", newProject: "New project", date: "Delivery day", window: "Time of day", truck: "Truck", address: "Delivery address", tomorrow: "Tomorrow", after: "Day after", pick: "Other date", standard: "No, standard", other: "Another address", change: "Change", street: "Address", city: "City", province: "Province", postal: "Postal code", windows: { Early: "Early (before 10am)", AM: "Morning", PM: "Afternoon", Day: "Anytime" }, trucks: { Boom: "Boom truck", "Boom 90ft": "Boom 90 ft", "Van/Cube": "Cube van", Hiab: "Crane (Hiab)", unknown: "I don't know" } },
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const field = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Desktop-only delivery presentation; shares values, not mobile expansion state. */
export function CommanderDesktopDelivery({ values, lang, onPatch, savedAddress, projects, project, onProject, onNewProject }: {
  values: DeliveryHintValues; lang: "fr" | "en"; onPatch: (p: Partial<DeliveryHintValues>) => void;
  savedAddress?: SavedAddress | null; projects: ClientProject[]; project: ProjectChoice;
  onProject: (p: ProjectChoice) => void; onNewProject?: () => void;
}) {
  const t = labels[lang];
  const [editing, setEditing] = useState<string[]>([]);
  const [calendar, setCalendar] = useState(false);
  const [manual, setManual] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const patch = (key: string, p: Partial<DeliveryHintValues>) => { onPatch(p); setEditing((keys) => keys.filter((k) => k !== key)); };
  const chip = (label: string, action: () => void, active = false) => <Button type="button" variant="outline" onClick={action} className={cn("h-auto min-h-9 max-w-full rounded-full px-3 py-1.5 whitespace-normal text-left text-sm", active && "border-primary bg-primary/15")}>{label}</Button>;
  const section = (key: string, title: string, selected: string, body: ReactNode) => (
    <section className="min-w-0 space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
      <h2 className="text-xs font-bold uppercase text-muted-foreground">{title}</h2>
      {selected && !editing.includes(key) ? <Button type="button" variant="outline" aria-label={`${t.change} : ${title}`} onClick={() => setEditing((keys) => [...keys, key])} className="h-auto min-h-10 max-w-full whitespace-normal rounded-full border-primary/40 bg-primary/10 px-3 py-2 text-left"><span className="min-w-0 break-words">{selected}</span><Pencil className="shrink-0" /></Button> : <div className="flex min-w-0 flex-wrap gap-2">{body}</div>}
    </section>
  );
  const windows: Record<string, string> = t.windows;
  const trucks: Record<string, string> = t.trucks;
  const addressReady = [values.address1, values.city, values.province, values.postal_code].every((v) => v.trim());
  return <div className="min-w-0 space-y-4 p-4">
    {(projects.length > 0 || onNewProject) && <section className="min-w-0 space-y-2 border-b pb-4">
      <h2 className="text-xs font-bold uppercase text-muted-foreground">{t.project}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {projects.map((p) => <Button type="button" variant="outline" key={p.id} onClick={() => onProject(p)} className={cn("shrink-0 rounded-full", project && project !== "none" && project.id === p.id && "border-primary bg-primary/15")}>{p.name}</Button>)}
        <Button type="button" variant="outline" className={cn("shrink-0 rounded-full", project === "none" && "border-primary bg-primary/15")} onClick={() => onProject("none")}>{t.noProject}</Button>
        {onNewProject && <Button type="button" variant="outline" className="shrink-0 rounded-full border-dashed" onClick={onNewProject}>{t.newProject}</Button>}
      </div>
    </section>}
    {section("date", t.date, values.delivery_date ? new Date(`${values.delivery_date}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { weekday: "short", day: "numeric", month: "short" }) : "", <>
      {chip(t.tomorrow, () => patch("date", { delivery_date: shift(1) }), values.delivery_date === shift(1))}
      {chip(t.after, () => patch("date", { delivery_date: shift(2) }), values.delivery_date === shift(2))}
      {chip(t.pick, () => setCalendar((v) => !v), calendar)}
      {calendar && <div className="max-w-full overflow-x-auto"><Calendar mode="single" locale={lang === "fr" ? fr : enCA} selected={values.delivery_date ? new Date(`${values.delivery_date}T12:00:00`) : undefined} disabled={{ before: new Date(Date.now() + 864e5) }} onSelect={(day) => { if (day) { patch("date", { delivery_date: ymd(day) }); setCalendar(false); } }} /></div>}
    </>)}
    {section("window", t.window, windows[values.time_window] ?? values.time_window, Object.entries(windows).map(([key, label]) => <span key={key}>{chip(label, () => patch("window", { time_window: key }), values.time_window === key)}</span>))}
    {section("truck", t.truck, values.truck_type === "none" ? t.standard : trucks[values.truck_type] ?? values.truck_type, <>{chip(t.standard, () => patch("truck", { truck_type: "none" }), values.truck_type === "none")}{Object.entries(trucks).map(([key, label]) => <span key={key}>{chip(label, () => patch("truck", { truck_type: key }), values.truck_type === key)}</span>)}</>)}
    {section("address", t.address, addressReady ? [values.address1, values.city, values.province, values.postal_code].join(", ") : "", savedAddress && !manual ? <>{<Button type="button" variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal" onClick={() => patch("address", savedAddress.values)}><MapPin />{savedAddress.label}</Button>}{chip(t.other, () => setManual(true))}</> : <div className="grid w-full gap-2">
      <input aria-label={t.street} placeholder={t.street} className={field} value={values.address1} onChange={(e) => onPatch({ address1: e.target.value })} />
      <input aria-label={t.city} placeholder={t.city} className={field} value={values.city} onChange={(e) => onPatch({ city: e.target.value })} />
      <div className="grid grid-cols-2 gap-2"><input aria-label={t.province} placeholder={t.province} className={field} value={values.province} onChange={(e) => onPatch({ province: e.target.value })} /><input aria-label={t.postal} placeholder={t.postal} className={field} value={values.postal_code} onChange={(e) => onPatch({ postal_code: e.target.value })} /></div>
      {addressReady && <Button type="button" size="sm" className="justify-self-end" onClick={() => setEditing((keys) => keys.filter((k) => k !== "address"))}>OK</Button>}
    </div>)}
  </div>;
}