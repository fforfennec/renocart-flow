import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Pencil, Loader2, Save, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasScrewWord, suggestionsRequest } from "@/lib/commanderSuggestions";
import { toast } from "sonner";

type Kind = "product" | "product_type" | "variant";
type Rule = { id?: string; trigger_kind: Kind; trigger_values: string[]; variant_id: string; suggested_qty: number; trigger_qty: number; priority: number; note: string | null; reason: string; recommended: boolean; active: boolean };
type ListedRule = Rule & { id: string; productTitle: string; variantTitle: string; proposed: number; accepted: number };
type Product = { id: string; title: string; productType: string; variants: { nodes: { id: string; title: string; availableForSale: boolean }[] } };
const blank = (): Rule => ({ trigger_kind: "product_type", trigger_values: [], variant_id: "", suggested_qty: 1, trigger_qty: 1, priority: 10, note: "", reason: "Pour tes {n} unités", recommended: true, active: true });
const parseQty = (v: string) => Number(v.replace(",", "."));
const fmt = (n: number) => String(n).replace(".", ",");
const vName = (t: string) => t === "Default Title" ? "Variante unique" : t;

export default function SuggestionRules() {
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");
  const [rules, setRules] = useState<ListedRule[]>([]);
  const [draft, setDraft] = useState<Rule | null>(null);
  const [qtyText, setQtyText] = useState({ s: "1", t: "1" });
  const [typesText, setTypesText] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestedProduct, setSuggestedProduct] = useState("");
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => { const data = await suggestionsRequest<{ rules: ListedRule[] }>({ action: "list" }); setRules(data.rules); }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setAccess("denied"); return; }
        const result = await suggestionsRequest<{ rules: ListedRule[] }>({ action: "list" });
        if (!cancelled) { setRules(result.rules); setAccess("allowed"); }
      } catch { if (!cancelled) setAccess("denied"); }
    })();
    return () => { cancelled = true; };
  }, []);
  const open = (rule: Rule) => {
    setDraft(rule); setQtyText({ s: fmt(rule.suggested_qty), t: fmt(rule.trigger_qty) });
    setTypesText(rule.trigger_kind === "product_type" ? rule.trigger_values.join(", ") : "");
    setSuggestedProduct(""); setError("");
  };
  const searchCatalog = async () => {
    setWorking(true); setError("");
    try {
      const data = await suggestionsRequest<{ products: Product[] }>({ action: "catalog", search }); setProducts(data.products);
      const next: Record<string, string> = {};
      for (const p of data.products) { next[p.id] = p.title; for (const v of p.variants.nodes) next[v.id] = `${p.title} — ${vName(v.title)}`; }
      setLabels((l) => ({ ...l, ...next }));
    } catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  const toggleTrigger = (id: string) => draft && setDraft({ ...draft, trigger_values: draft.trigger_values.includes(id) ? draft.trigger_values.filter((v) => v !== id) : [...draft.trigger_values, id] });
  const save = async () => {
    if (!draft) return;
    const rule: Rule = { ...draft, suggested_qty: parseQty(qtyText.s), trigger_qty: parseQty(qtyText.t), note: draft.note?.trim() || null,
      trigger_values: draft.trigger_kind === "product_type" ? typesText.split(",").map((s) => s.trim()).filter(Boolean) : draft.trigger_values };
    const product = products.find((p) => p.id === suggestedProduct);
    const variant = product?.variants.nodes.find((v) => v.id === rule.variant_id);
    if (hasScrewWord(`${product?.title ?? ""} ${product?.productType ?? ""} ${variant?.title ?? ""} ${rule.reason}`)) { setError("Les vis et les clous ne sont jamais suggérés."); return; }
    const okQty = (n: number) => Number.isFinite(n) && n > 0 && n <= 10000;
    if (!rule.trigger_values.length || !rule.variant_id || !rule.reason.trim() || !okQty(rule.suggested_qty) || !okQty(rule.trigger_qty) || !Number.isInteger(rule.priority) || rule.priority < 1) { setError("Complète le déclencheur, la variante, les quantités et la priorité."); return; }
    setWorking(true); setError("");
    try { await suggestionsRequest({ action: "save", rule }); await reload(); setDraft(null); toast.success("Règle enregistrée"); }
    catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  if (access === "loading") return <div className="p-8"><Loader2 className="animate-spin" aria-label="Chargement" /></div>;
  if (access === "denied") return <div className="p-6 md:p-8 space-y-4"><h1 className="text-2xl font-bold">Règles de suggestions</h1><p>Connecte-toi avec ton compte administrateur pour gérer les règles.</p><Button asChild><Link to="/auth">Se connecter</Link></Button></div>;
  const triggerLabel = (r: Rule) => r.trigger_kind === "product_type" ? r.trigger_values.join(", ") : r.trigger_values.map((v) => labels[v] ?? v.split("/").pop()).join(", ");
  return <div className="p-6 md:p-8 max-w-6xl">
    <div className="flex items-center justify-between gap-4 mb-6"><h1 className="text-2xl font-bold">Règles de suggestions</h1><Button onClick={() => open(blank())}><Plus className="h-4 w-4 mr-2" />Nouvelle règle</Button></div>
    <p className="text-sm text-muted-foreground mb-4">Les vis et les clous ne sont jamais suggérés, même si une règle le demande.</p>
    {draft && <form className="border-y py-6 mb-6 space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2 className="text-lg font-semibold">{draft.id ? "Modifier la règle" : "Nouvelle règle"}</h2>
      <div className="flex gap-2"><Input aria-label="Rechercher dans Shopify" placeholder="Rechercher dans Shopify" value={search} maxLength={150} onChange={(e) => setSearch(e.target.value)} /><Button type="button" variant="outline" disabled={working} onClick={searchCatalog}><Search className="h-4 w-4 mr-2" />Rechercher</Button></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Déclencheur</Label><Select value={draft.trigger_kind} onValueChange={(value: Kind) => setDraft({ ...draft, trigger_kind: value, trigger_values: [] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="product_type">Type(s) de produit Shopify</SelectItem><SelectItem value="product">Un ou plusieurs produits</SelectItem><SelectItem value="variant">Une ou plusieurs variantes précises</SelectItem></SelectContent></Select></div>
        {draft.trigger_kind === "product_type" ? <div className="space-y-2"><Label htmlFor="types">Types Shopify (séparés par des virgules)</Label><Input id="types" list="product-types" maxLength={2000} value={typesText} onChange={(e) => setTypesText(e.target.value)} />
          <datalist id="product-types">{Array.from(new Set(products.map((p) => p.productType).filter(Boolean))).map((v) => <option key={v} value={v} />)}</datalist></div>
          : <div className="space-y-2"><Label>Déclencheurs choisis</Label><div className="flex flex-wrap gap-2 min-h-10">{draft.trigger_values.length ? draft.trigger_values.map((v) => <span key={v} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{labels[v] ?? v.split("/").pop()}<button type="button" aria-label="Retirer" onClick={() => toggleTrigger(v)}><X className="h-3 w-3" /></button></span>) : <span className="text-sm text-muted-foreground">Recherche puis coche ci-dessous.</span>}</div></div>}
      </div>
      {draft.trigger_kind !== "product_type" && products.length > 0 && <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-1">
        {products.map((p) => draft.trigger_kind === "product"
          ? <label key={p.id} className="flex items-center gap-2 min-h-9 text-sm"><Checkbox checked={draft.trigger_values.includes(p.id)} onCheckedChange={() => toggleTrigger(p.id)} />{p.title}</label>
          : <div key={p.id}><p className="text-xs font-semibold mt-2">{p.title}</p>{p.variants.nodes.map((v) => <label key={v.id} className="flex items-center gap-2 min-h-9 text-sm pl-3"><Checkbox checked={draft.trigger_values.includes(v.id)} onCheckedChange={() => toggleTrigger(v.id)} />{vName(v.title)}</label>)}</div>)}
      </div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Produit suggéré</Label><Select value={suggestedProduct} onValueChange={(value) => { setSuggestedProduct(value); setDraft({ ...draft, variant_id: "" }); }}><SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Variante précise</Label><Select value={draft.variant_id} onValueChange={(value) => setDraft({ ...draft, variant_id: value })}><SelectTrigger><SelectValue placeholder={draft.variant_id ? (labels[draft.variant_id] ?? draft.variant_id) : "Choisir une variante"} /></SelectTrigger><SelectContent>{products.find((p) => p.id === suggestedProduct)?.variants.nodes.map((v) => <SelectItem key={v.id} value={v.id} disabled={!v.availableForSale}>{vName(v.title)}{!v.availableForSale ? " — indisponible" : ""}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <div className="space-y-2"><Label htmlFor="suggested-units">Quantité suggérée (X)</Label><Input id="suggested-units" inputMode="decimal" value={qtyText.s} onChange={(e) => setQtyText({ ...qtyText, s: e.target.value })} required /></div>
        <div className="space-y-2"><Label htmlFor="trigger-units">Pour Y unités du déclencheur</Label><Input id="trigger-units" inputMode="decimal" value={qtyText.t} onChange={(e) => setQtyText({ ...qtyText, t: e.target.value })} required /></div>
        <div className="space-y-2"><Label htmlFor="priority">Priorité (1 = la plus importante)</Label><Input id="priority" type="number" min={1} max={1000} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} required /></div>
        <div className="space-y-2"><Label htmlFor="reason">Raison client · {"{n}"} = quantité</Label><Input id="reason" maxLength={250} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} required /></div>
      </div>
      <p className="text-xs text-muted-foreground">Décimales acceptées (ex. 1 pour 3,7). La quantité suggérée est toujours arrondie vers le haut.</p>
      <div className="space-y-2"><Label htmlFor="note">Note (visible seulement ici)</Label><Textarea id="note" maxLength={1000} value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></div>
      <div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 min-h-11"><Checkbox checked={draft.recommended} onCheckedChange={(v) => setDraft({ ...draft, recommended: v === true })} />Recommandé (coché d’avance)</label><label className="flex items-center gap-2 min-h-11"><Checkbox checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v === true })} />Active</label></div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={working}><Save className="h-4 w-4 mr-2" />Enregistrer</Button><Button type="button" variant="outline" disabled={working} onClick={() => setDraft(null)}>Annuler</Button></div>
    </form>}
    {!rules.length ? <p className="text-muted-foreground py-8">Aucune règle de suggestion.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-3">Priorité</th><th>Déclencheur</th><th>Suggestion</th><th>Ratio X / Y</th><th>État</th><th>Proposée</th><th>Acceptée</th><th>Taux</th><th /></tr></thead><tbody>{rules.map((r) => <tr key={r.id} className="border-b align-top"><td className="py-4 pr-3 font-bold">{r.priority}</td><td className="py-4 pr-3">{triggerLabel(r)}<p className="text-xs text-muted-foreground">{r.trigger_kind === "variant" ? "Variantes" : r.trigger_kind === "product" ? "Produits" : "Types"}</p>{r.note && <p className="text-xs text-muted-foreground italic mt-1">Note : {r.note}</p>}</td><td className="pr-3 py-4"><b>{r.productTitle}</b><p className="text-muted-foreground">{r.variantTitle !== "Default Title" ? r.variantTitle : ""}</p></td><td className="py-4">{fmt(r.suggested_qty)} / {fmt(r.trigger_qty)}</td><td className="py-4">{r.active ? "Active" : "Inactive"}<p className="text-muted-foreground">{r.recommended ? "Recommandée" : "Optionnelle"}</p></td><td className="py-4">{r.proposed}</td><td className="py-4">{r.accepted}</td><td className="py-4">{r.proposed ? Math.round(r.accepted / r.proposed * 100) : 0} %</td><td className="py-2"><div className="flex"><Button variant="ghost" size="icon" aria-label="Modifier la règle" onClick={() => { const { productTitle, variantTitle, proposed, accepted, ...rule } = r; open(rule); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Supprimer la règle" disabled={working} onClick={async () => { if (!window.confirm("Supprimer cette règle ?")) return; setWorking(true); try { await suggestionsRequest({ action: "delete", id: r.id }); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setWorking(false); } }}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table></div>}
  </div>;
}
