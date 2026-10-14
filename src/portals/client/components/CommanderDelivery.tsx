import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, LockKeyhole, Package, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DeliveryFormValues = {
  delivery_date: string; time_window: string; truck_type: string; note: string;
  address1: string; city: string; province: string; postal_code: string;
  contact_name: string; contact_phone: string;
};

export function CommanderDelivery({ initial, lang, busy, onBack, onSubmit, items = [], projectName }: {
  initial: DeliveryFormValues; lang: "fr" | "en"; busy: boolean;
  onBack: (values: DeliveryFormValues) => void; onSubmit: (values: DeliveryFormValues) => void;
  items?: { variantId: string; productTitle: string; variantTitle: string; image: string | null; quantity: number }[];
  projectName?: string;
}) {
  const [values, setValues] = useState(initial);
  const fr = lang === "fr";
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const set = (key: keyof DeliveryFormValues, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const field = (key: keyof DeliveryFormValues, label: string, required = false, autoComplete?: string, type = "text") => (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      {label}
      <Input name={key} type={type} value={values[key]} required={required} autoComplete={autoComplete}
        min={type === "date" ? minDate : undefined} className="h-11 min-w-0 bg-card" disabled={busy}
        onChange={(e) => set(key, e.target.value)} />
    </label>
  );
  const select = (key: "time_window" | "truck_type", label: string, options: Record<string, string>) => (
    <label className="grid min-w-0 gap-2 text-sm font-medium">{label}
      <select name={key} required value={values[key]} disabled={busy} onChange={(e) => set(key, e.target.value)}
        className="h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
        <option value="">{fr ? "Choisir…" : "Choose…"}</option>
        {Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
  );
  const units = items.reduce((total, item) => total + item.quantity, 0);
  const ready = [values.address1, values.city, values.province, values.postal_code, values.delivery_date, values.time_window, values.truck_type].every((value) => value.trim());
  const sectionTitle = (number: number, label: string) => <div className="mb-5 flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{number}</span><h2 className="text-lg font-bold">{label}</h2></div>;
  return <main className="flex-1 min-h-0 overflow-y-auto bg-card px-4 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div><Button variant="ghost" onClick={() => onBack(values)} disabled={busy} className="mb-2 -ml-3 min-h-11 whitespace-normal text-left text-muted-foreground"><ArrowLeft />{fr ? "Retour à ta liste d'achat" : "Back to your shopping list"}</Button>
          <h1 className="text-2xl font-bold sm:text-3xl">{fr ? "Compléter la commande" : "Complete order"}</h1></div>
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />{fr ? "Paiement sécurisé" : "Secure checkout"}</span>
      </div>
      <form className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={(e) => { e.preventDefault(); onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])) as DeliveryFormValues); }}>
        <div className="min-w-0">
        <section className="border-b pb-7">
          {sectionTitle(1, fr ? "Adresse de livraison" : "Delivery address")}
          {projectName && <div className="mb-5 flex items-center justify-between gap-3 border-l-2 border-primary bg-muted/30 px-4 py-2"><div className="min-w-0"><p className="text-xs text-muted-foreground">{fr ? "Projet" : "Project"}</p><p className="break-words font-semibold">{projectName}</p></div><Button variant="ghost" disabled={busy} onClick={() => onBack(values)}><Pencil />{fr ? "Modifier" : "Edit"}</Button></div>}
          <fieldset disabled={busy} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("contact_name", fr ? "Nom du contact (facultatif)" : "Contact name (optional)", false, "shipping name")}
            {field("contact_phone", fr ? "Téléphone (facultatif)" : "Phone (optional)", false, "shipping tel", "tel")}
          </div>
          {field("address1", fr ? "Adresse de livraison" : "Delivery address", true, "shipping street-address")}
          <div className="grid gap-4 sm:grid-cols-3">
            {field("city", fr ? "Ville" : "City", true, "shipping address-level2")}
            {field("province", fr ? "Province" : "Province", true, "shipping address-level1")}
            {field("postal_code", fr ? "Code postal" : "Postal code", true, "shipping postal-code")}
          </div>
          </fieldset>
        </section>
        <section className="border-b py-7">
          {sectionTitle(2, fr ? "Options de livraison" : "Delivery options")}
          <fieldset disabled={busy} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("delivery_date", fr ? "Journée de livraison" : "Delivery day", true, undefined, "date")}
            {select("time_window", fr ? "Moment de la journée" : "Time of day", fr ? { Early: "Tôt (avant 10 h)", AM: "Avant-midi", PM: "Après-midi", Day: "N'importe quand" } : { Early: "Early (before 10am)", AM: "Morning", PM: "Afternoon", Day: "Anytime" })}
          </div>
          {select("truck_type", fr ? "As-tu besoin d'un camion particulier ?" : "Do you need a particular truck?", fr ? { none: "Non, livraison standard", Boom: "Camion girafe (Boom)", "Boom 90ft": "Girafe 90 pi", "Van/Cube": "Camion cube", Hiab: "Grue (Hiab)", unknown: "Je ne sais pas" } : { none: "No, standard delivery", Boom: "Boom truck", "Boom 90ft": "Boom 90 ft", "Van/Cube": "Cube van", Hiab: "Crane (Hiab)", unknown: "I don't know" })}
          <label className="grid gap-2 text-sm font-medium">{fr ? "Précisions pour la livraison (facultatif)" : "Delivery notes (optional)"}
            <textarea name="note" value={values.note} onChange={(e) => set("note", e.target.value)} rows={3}
              className="w-full resize-y rounded-md border border-input bg-card p-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          </fieldset>
        </section>
        <section className="py-7">
          <div className="flex flex-wrap items-start justify-between gap-2">{sectionTitle(3, fr ? "Vérifier les articles" : "Review items")}<Button variant="ghost" onClick={() => onBack(values)} disabled={busy}><Pencil />{fr ? "Modifier la liste" : "Edit list"}</Button></div>
          <ul className="divide-y">{items.map((item) => <li key={item.variantId} className="flex min-w-0 gap-4 py-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-card">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain p-2" /> : <Package className="h-8 w-8 text-muted-foreground" />}</div>
            <div className="min-w-0"><p className="break-words text-sm font-semibold leading-6">{item.productTitle}</p>{item.variantTitle !== "Default Title" && <p className="break-words text-sm text-muted-foreground">{item.variantTitle}</p>}<p className="mt-2 text-sm">{fr ? "Quantité" : "Quantity"} : <strong>{item.quantity}</strong></p></div>
          </li>)}</ul>
        </section>
        </div>
        <aside aria-label={fr ? "Résumé de la commande" : "Order summary"} className="min-w-0 rounded-lg border bg-card p-5 lg:sticky lg:top-0">
          <h2 className="mb-5 text-lg font-bold">{fr ? "Résumé de la commande" : "Order summary"}</h2>
          <dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>{fr ? "Articles différents" : "Different items"}</dt><dd className="font-semibold">{items.length}</dd></div><div className="flex justify-between gap-3"><dt>{fr ? "Quantité totale" : "Total quantity"}</dt><dd className="font-semibold">{units}</dd></div></dl>
          <div className="my-5 border-y py-4"><p className="text-sm leading-6 text-muted-foreground">{fr ? "Les prix et les taxes s'affichent au paiement." : "Prices and taxes are shown at checkout."}</p></div>
          <Button type="submit" size="lg" disabled={busy} className="h-auto min-h-12 w-full whitespace-normal px-3 py-3 text-sm font-bold">
          {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}{fr ? "Continuer vers le paiement" : "Continue to payment"}
          </Button>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">{ready ? <Check className="h-4 w-4 shrink-0 text-success" /> : <LockKeyhole className="h-4 w-4 shrink-0" />}<span>{ready ? (fr ? "Renseignements de livraison complétés" : "Delivery details completed") : (fr ? "Aucun paiement à cette étape" : "No payment at this step")}</span></div>
        </aside>
      </form>
    </div>
  </main>;
}