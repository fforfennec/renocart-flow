import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Pencil, Loader2, Save, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasScrewWord, suggestionsRequest } from "@/lib/commanderSuggestions";
import { toast } from "sonner";

type Rule = { id?: string; trigger_kind: "product" | "product_type"; trigger_value: string; variant_id: string; suggested_units: number; trigger_units: number; reason: string; recommended: boolean; active: boolean };
type ListedRule = Rule & { id: string; productTitle: string; variantTitle: string; proposed: number; accepted: number };
type Product = { id: string; title: string; productType: string; variants: { nodes: { id: string; title: string; availableForSale: boolean }[] } };
const blank = (): Rule => ({ trigger_kind: "product_type", trigger_value: "", variant_id: "", suggested_units: 1, trigger_units: 1, reason: "Pour tes {n} unités", recommended: true, active: true });

export default function SuggestionRules() {
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");
  const [rules, setRules] = useState<ListedRule[]>([]);
  const [draft, setDraft] = useState<Rule | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestedProduct, setSuggestedProduct] = useState("");
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => { const data = await suggestionsRequest<{ rules: ListedRule[] }>({ action: "list" }); setRules(data.rules); }, []);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setAccess("denied"); return; }
        const result = await suggestionsRequest<{ rules: ListedRule[] }>({ action: "list" });
        if (!cancelled) { setRules(result.rules); setAccess("allowed"); }
      } catch { if (!cancelled) setAccess("denied"); }
    };
    check();
    return () => { cancelled = true; };
  }, []);
  const searchCatalog = async () => {
    setWorking(true); setError("");
    try { const data = await suggestionsRequest<{ products: Product[] }>({ action: "catalog", search }); setProducts(data.products); }
    catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  const save = async () => {
    if (!draft) return;
    const product = products.find((p) => p.id === suggestedProduct);
    const variant = product?.variants.nodes.find((v) => v.id === draft.variant_id);
    if (hasScrewWord(`${product?.title ?? ""} ${product?.productType ?? ""} ${variant?.title ?? ""} ${draft.reason}`)) { setError("Les vis ne sont jamais suggérées."); return; }
    if (!draft.trigger_value.trim() || !draft.variant_id || !draft.reason.trim() || !Number.isInteger(draft.suggested_units) || !Number.isInteger(draft.trigger_units) || draft.suggested_units < 1 || draft.trigger_units < 1) { setError("Complète le déclencheur, la variante et les quantités."); return; }
    setWorking(true); setError("");
    try { await suggestionsRequest({ action: "save", rule: draft }); await reload(); setDraft(null); toast.success("Règle enregistrée"); }
    catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  if (access === "loading") return <div className="p-8"><Loader2 className="animate-spin" aria-label="Chargement" /></div>;
  if (access === "denied") return <div className="p-6 md:p-8 space-y-4"><h1 className="text-2xl font-bold">Règles de suggestions</h1><p>Connecte-toi avec ton compte administrateur pour gérer les règles.</p><Button asChild><Link to="/auth">Se connecter</Link></Button></div>;
  return <div className="p-6 md:p-8 max-w-6xl">
    <div className="flex items-center justify-between gap-4 mb-6"><h1 className="text-2xl font-bold">Règles de suggestions</h1><Button onClick={() => { setDraft(blank()); setSuggestedProduct(""); setError(""); }}><Plus className="h-4 w-4 mr-2" />Nouvelle règle</Button></div>
    {draft && <form className="border-y py-6 mb-6 space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2 className="text-lg font-semibold">{draft.id ? "Modifier la règle" : "Nouvelle règle"}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Déclencheur</Label><Select value={draft.trigger_kind} onValueChange={(value: Rule["trigger_kind"]) => setDraft({ ...draft, trigger_kind: value, trigger_value: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="product_type">Type de produit Shopify</SelectItem><SelectItem value="product">Produit Shopify</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="trigger">{draft.trigger_kind === "product_type" ? "Type Shopify" : "Produit déclencheur"}</Label>
          {draft.trigger_kind === "product_type" ? <Input id="trigger" list="product-types" maxLength={255} value={draft.trigger_value} onChange={(e) => setDraft({ ...draft, trigger_value: e.target.value })} required />
            : <Select value={draft.trigger_value} onValueChange={(value) => setDraft({ ...draft, trigger_value: value })}><SelectTrigger id="trigger"><SelectValue placeholder="Choisir un produit" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select>}
          <datalist id="product-types">{Array.from(new Set(products.map((p) => p.productType).filter(Boolean))).map((v) => <option key={v} value={v} />)}</datalist>
        </div>
      </div>
      <div className="flex gap-2"><Input aria-label="Rechercher dans Shopify" placeholder="Rechercher dans Shopify" value={search} maxLength={150} onChange={(e) => setSearch(e.target.value)} /><Button type="button" variant="outline" disabled={working} onClick={searchCatalog}><Search className="h-4 w-4 mr-2" />Rechercher</Button></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Produit suggéré</Label><Select value={suggestedProduct} onValueChange={(value) => { setSuggestedProduct(value); setDraft({ ...draft, variant_id: "" }); }}><SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Variante précise</Label><Select value={draft.variant_id} onValueChange={(value) => setDraft({ ...draft, variant_id: value })}><SelectTrigger><SelectValue placeholder={draft.variant_id || "Choisir une variante"} /></SelectTrigger><SelectContent>{products.find((p) => p.id === suggestedProduct)?.variants.nodes.map((v) => <SelectItem key={v.id} value={v.id} disabled={!v.availableForSale}>{v.title === "Default Title" ? "Variante unique" : v.title}{!v.availableForSale ? " — indisponible" : ""}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2"><Label htmlFor="suggested-units">Quantité suggérée (X)</Label><Input id="suggested-units" type="number" min={1} max={10000} value={draft.suggested_units} onChange={(e) => setDraft({ ...draft, suggested_units: Number(e.target.value) })} required /></div>
        <div className="space-y-2"><Label htmlFor="trigger-units">Pour Y unités du déclencheur</Label><Input id="trigger-units" type="number" min={1} max={10000} value={draft.trigger_units} onChange={(e) => setDraft({ ...draft, trigger_units: Number(e.target.value) })} required /></div>
        <div className="space-y-2"><Label htmlFor="reason">Raison client · {"{n}"} = quantité</Label><Input id="reason" maxLength={250} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} required /></div>
      </div>
      <div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 min-h-11"><Checkbox checked={draft.recommended} onCheckedChange={(v) => setDraft({ ...draft, recommended: v === true })} />Recommandé (coché d’avance)</label><label className="flex items-center gap-2 min-h-11"><Checkbox checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v === true })} />Active</label></div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={working}><Save className="h-4 w-4 mr-2" />Enregistrer</Button><Button type="button" variant="outline" disabled={working} onClick={() => setDraft(null)}>Annuler</Button></div>
    </form>}
    {!rules.length ? <p className="text-muted-foreground py-8">Aucune règle de suggestion.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-3">Déclencheur</th><th>Suggestion</th><th>Ratio X / Y</th><th>État</th><th>Proposée</th><th>Acceptée</th><th>Taux</th><th /></tr></thead><tbody>{rules.map((r) => <tr key={r.id} className="border-b"><td className="py-4 pr-3">{r.trigger_value}</td><td className="pr-3"><b>{r.productTitle}</b><p className="text-muted-foreground">{r.variantTitle !== "Default Title" ? r.variantTitle : ""}</p></td><td>{r.suggested_units} / {r.trigger_units}</td><td>{r.active ? "Active" : "Inactive"}<p className="text-muted-foreground">{r.recommended ? "Recommandée" : "Optionnelle"}</p></td><td>{r.proposed}</td><td>{r.accepted}</td><td>{r.proposed ? Math.round(r.accepted / r.proposed * 100) : 0} %</td><td><div className="flex"><Button variant="ghost" size="icon" aria-label="Modifier la règle" onClick={() => { const { productTitle, variantTitle, proposed, accepted, ...rule } = r; setDraft(rule); setSuggestedProduct(""); setError(""); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Supprimer la règle" disabled={working} onClick={async () => { if (!window.confirm("Supprimer cette règle ?")) return; setWorking(true); try { await suggestionsRequest({ action: "delete", id: r.id }); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setWorking(false); } }}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table></div>}
  </div>;
}