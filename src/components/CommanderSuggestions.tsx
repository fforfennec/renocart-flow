import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Suggestion } from "@/lib/commanderSuggestions";

export function CommanderSuggestions({ suggestions, lang, shortName, onAdd, onDecline }: {
  suggestions: Suggestion[]; lang: "fr" | "en"; shortName: (s: string) => string;
  onAdd: (selected: Suggestion[]) => Promise<void>; onDecline: () => void;
}) {
  const [rows, setRows] = useState(() => suggestions.map((s) => ({ ...s, checked: s.recommended })));
  const [working, setWorking] = useState(false);
  const selected = rows.filter((r) => r.checked);
  const fr = lang === "fr";
  return <div className="rounded-lg bg-card text-card-foreground p-4 md:p-5 motion-safe:animate-in motion-safe:fade-in duration-200">
    <h3 className="text-xl font-bold">{fr ? "Pour finir le travail" : "To finish the job"}</h3>
    <p className="text-sm text-muted-foreground mt-1 mb-3">{fr ? "Évite un 2e voyage : voici ce qui va avec ton panier." : "Avoid a second trip: here’s what goes with your cart."}</p>
    <div className="divide-y">
      {rows.map((row) => <div key={row.variantId} className="flex items-center gap-2 py-3">
        <label className="flex h-11 w-11 shrink-0 items-center justify-center cursor-pointer">
          <Checkbox aria-label={`${fr ? "Sélectionner" : "Select"} ${shortName(row.productTitle)}`} checked={row.checked} disabled={working}
            onCheckedChange={(checked) => setRows((prev) => prev.map((r) => r.variantId === row.variantId ? { ...r, checked: checked === true } : r))} />
        </label>
        <div className="min-w-0 flex-1"><p className="font-bold text-sm break-words">{shortName(row.productTitle)}</p><p className="text-xs text-muted-foreground break-words">{row.reason}</p></div>
        <div className="flex items-center shrink-0">
          <Button size="icon" variant="outline" className="h-11 w-11" aria-label={`${fr ? "Réduire" : "Decrease"} ${shortName(row.productTitle)}`} disabled={working || row.quantity <= 1}
            onClick={() => setRows((prev) => prev.map((r) => r.variantId === row.variantId ? { ...r, quantity: Math.max(1, r.quantity - 1) } : r))}><Minus className="h-4 w-4" /></Button>
          <span className="w-8 text-center font-bold text-sm" aria-live="polite">{row.quantity}</span>
          <Button size="icon" variant="outline" className="h-11 w-11" aria-label={`${fr ? "Augmenter" : "Increase"} ${shortName(row.productTitle)}`} disabled={working || row.quantity >= 10000}
            onClick={() => setRows((prev) => prev.map((r) => r.variantId === row.variantId ? { ...r, quantity: r.quantity + 1 } : r))}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>)}
    </div>
    <Button className="w-full h-12 mt-3 font-bold" disabled={working || !selected.length} onClick={async () => { setWorking(true); try { await onAdd(selected); } finally { setWorking(false); } }}>
      {fr ? `Ajouter la sélection (${selected.length})` : `Add selection (${selected.length})`}
    </Button>
    <Button variant="ghost" className="w-full h-11 mt-1" disabled={working} onClick={onDecline}>{fr ? "Non merci" : "No thanks"}</Button>
  </div>;
}

export function CommanderSuggestionReminder({ suggestions, lang, shortName, onAdd, onHide }: {
  suggestions: Suggestion[]; lang: "fr" | "en"; shortName: (s: string) => string;
  onAdd: (selected: Suggestion[]) => Promise<void>; onHide: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!suggestions.length) return null;
  return <div className="border border-dashed rounded-lg p-3 mt-4">
    <p className="font-semibold text-sm">{lang === "fr" ? "Souvent oublié avec ton panier" : "Often forgotten with your cart"}</p>
    <div className="flex flex-wrap gap-2 mt-2">{suggestions.map((s) => <Button key={s.variantId} variant="outline" className="min-h-11 h-auto rounded-full text-xs whitespace-normal" disabled={busy}
      onClick={async () => { setBusy(true); try { await onAdd([s]); } finally { setBusy(false); } }}>+ {shortName(s.productTitle)} ({s.quantity})</Button>)}</div>
    <Button variant="ghost" className="h-11 text-xs text-muted-foreground" onClick={onHide}>{lang === "fr" ? "Masquer" : "Hide"}</Button>
  </div>;
}