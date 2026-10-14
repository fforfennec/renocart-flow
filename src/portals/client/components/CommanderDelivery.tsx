import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DeliveryFormValues = {
  delivery_date: string; time_window: string; truck_type: string; note: string;
  address1: string; city: string; province: string; postal_code: string;
  contact_name: string; contact_phone: string;
};

export function CommanderDelivery({ initial, lang, busy, onBack, onSubmit }: {
  initial: DeliveryFormValues; lang: "fr" | "en"; busy: boolean;
  onBack: (values: DeliveryFormValues) => void; onSubmit: (values: DeliveryFormValues) => void;
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
        min={type === "date" ? minDate : undefined} className="h-12 min-w-0 bg-card" disabled={busy}
        onChange={(e) => set(key, e.target.value)} />
    </label>
  );
  const select = (key: "time_window" | "truck_type", label: string, options: Record<string, string>) => (
    <label className="grid min-w-0 gap-2 text-sm font-medium">{label}
      <select name={key} required value={values[key]} disabled={busy} onChange={(e) => set(key, e.target.value)}
        className="h-12 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring">
        <option value="">{fr ? "Choisir…" : "Choose…"}</option>
        {Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
  );
  return <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
    <div className="mx-auto w-full max-w-2xl">
      <Button variant="ghost" onClick={() => onBack(values)} disabled={busy} className="mb-4 -ml-3 min-h-11 whitespace-normal text-left"><ArrowLeft />{fr ? "Retour à ta liste d'achat" : "Back to your shopping list"}</Button>
      <h1 className="text-2xl font-bold">{fr ? "Compléter la commande" : "Complete order"}</h1>
      <form className="mt-6 space-y-6" onSubmit={(e) => { e.preventDefault(); onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])) as DeliveryFormValues); }}>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-4 text-lg font-semibold">{fr ? "Livraison" : "Delivery"}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("delivery_date", fr ? "Journée de livraison" : "Delivery day", true, undefined, "date")}
            {select("time_window", fr ? "Moment de la journée" : "Time of day", fr ? { Early: "Tôt (avant 10 h)", AM: "Avant-midi", PM: "Après-midi", Day: "N'importe quand" } : { Early: "Early (before 10am)", AM: "Morning", PM: "Afternoon", Day: "Anytime" })}
          </div>
          {field("address1", fr ? "Adresse de livraison" : "Delivery address", true, "shipping street-address")}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("city", fr ? "Ville" : "City", true, "shipping address-level2")}
            {field("postal_code", fr ? "Code postal" : "Postal code", true, "shipping postal-code")}
          </div>
          {field("province", fr ? "Province" : "Province", true, "shipping address-level1")}
          {select("truck_type", fr ? "As-tu besoin d'un camion particulier ?" : "Do you need a particular truck?", fr ? { none: "Non, livraison standard", Boom: "Camion girafe (Boom)", "Boom 90ft": "Girafe 90 pi", "Van/Cube": "Camion cube", Hiab: "Grue (Hiab)", unknown: "Je ne sais pas" } : { none: "No, standard delivery", Boom: "Boom truck", "Boom 90ft": "Boom 90 ft", "Van/Cube": "Cube van", Hiab: "Crane (Hiab)", unknown: "I don't know" })}
        </fieldset>
        <fieldset disabled={busy} className="space-y-4 border-t pt-6">
          <legend className="pt-6 text-lg font-semibold">{fr ? "Contact et précisions" : "Contact and details"}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("contact_name", fr ? "Nom du contact (facultatif)" : "Contact name (optional)", false, "shipping name")}
            {field("contact_phone", fr ? "Téléphone (facultatif)" : "Phone (optional)", false, "shipping tel", "tel")}
          </div>
          <label className="grid gap-2 text-sm font-medium">{fr ? "Précisions pour la livraison (facultatif)" : "Delivery notes (optional)"}
            <textarea name="note" value={values.note} onChange={(e) => set("note", e.target.value)} rows={3}
              className="w-full resize-y rounded-md border border-input bg-card p-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
        </fieldset>
        <Button type="submit" size="lg" disabled={busy} className="h-auto min-h-14 w-full whitespace-normal py-3 text-base font-bold">
          {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}{fr ? "Continuer vers le paiement" : "Continue to payment"}
        </Button>
      </form>
    </div>
  </main>;
}