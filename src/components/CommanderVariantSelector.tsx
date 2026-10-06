import { useEffect, useId, useState } from "react";
import { ArrowLeftRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVariantProduct, matchesOptions, type CatalogVariant, type VariantProduct } from "@/lib/shopifyVariants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CommanderVariantSelector({ variantId, lang, disabled, onConfirm }: {
  variantId: string; lang: "fr" | "en"; disabled: boolean;
  onConfirm: (product: VariantProduct, variant: CatalogVariant, previous: CatalogVariant) => void;
}) {
  const id = useId();
  const [product, setProduct] = useState<VariantProduct | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const fr = lang === "fr";
  const label = fr ? "Changer de format" : "Change size";
  const errorText = fr ? "Impossible de charger les formats. Réessaie." : "Unable to load options. Try again.";

  useEffect(() => {
    let active = true;
    getVariantProduct(variantId).then((data) => { if (active) { setProduct(data); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [variantId]);

  const expand = async () => {
    if (open) { setOpen(false); return; }
    setLoading(true);
    try {
      const data = await getVariantProduct(variantId, true);
      setProduct(data); setFailed(false);
      const current = data?.variants.find((v) => v.id === variantId);
      if (!current || !data || data.variants.length < 2) return;
      setSelected(Object.fromEntries(current.selectedOptions.map((o) => [o.name, o.value])));
      setOpen(true);
    } catch { setFailed(true); toast.error(errorText); }
    finally { setLoading(false); }
  };

  const confirm = async () => {
    setSaving(true);
    try {
      const latest = await getVariantProduct(variantId, true);
      const variant = latest?.variants.find((v) => matchesOptions(v, selected));
      const previous = latest?.variants.find((v) => v.id === variantId);
      if (latest) setProduct(latest);
      if (!latest || !variant?.availableForSale || !previous) {
        toast.error(fr ? "Ce format n'est plus disponible. Choisis une autre option." : "This option is no longer available. Choose another one.");
        return;
      }
      if (variant.id !== variantId) onConfirm(latest, variant, previous);
      setOpen(false);
    } catch { toast.error(errorText); }
    finally { setSaving(false); }
  };

  if (!product || product.variants.length < 2) return failed ? (
    <Button variant="ghost" className="h-11 text-xs text-muted-foreground" onClick={expand} disabled={disabled || loading}>
      {loading ? <Loader2 className="animate-spin" /> : <RotateCcw />} {fr ? "Réessayer les formats" : "Retry options"}
    </Button>
  ) : null;
  const target = product.variants.find((v) => matchesOptions(v, selected));
  return (
    <div className="min-w-0">
      <Button variant="ghost" onClick={expand} disabled={disabled || loading || saving} aria-expanded={open} aria-controls={id}
        className="min-h-11 h-auto px-0 justify-start text-left text-sm font-semibold text-secondary hover:bg-transparent hover:underline">
        {loading ? <Loader2 className="text-primary animate-spin" /> : <ArrowLeftRight className="text-primary" />}{label}
      </Button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden min-h-0" ref={(element) => { element?.toggleAttribute("inert", !open); }}>
          <div id={id} role="region" aria-label={label} className="py-2 space-y-3">
            {product.options.map((option) => (
              <fieldset key={option.name} disabled={disabled || saving}>
                <legend className="text-sm font-semibold mb-2">{option.name}</legend>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const possible = product.variants.some((v) => v.availableForSale && matchesOptions(v, { ...selected, [option.name]: value }));
                    const active = selected[option.name] === value;
                    return <Button key={value} variant={active ? "default" : "outline"} disabled={!possible}
                      aria-pressed={active} onClick={() => setSelected((s) => ({ ...s, [option.name]: value }))}
                      className={cn("min-h-11 h-auto rounded-full px-4 py-2 whitespace-normal text-left", !possible && "bg-muted text-muted-foreground border-muted disabled:opacity-60")}>
                      {value}
                    </Button>;
                  })}
                </div>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={confirm} disabled={disabled || saving || !target?.availableForSale}>
                {saving && <Loader2 className="animate-spin" />}{fr ? "Confirmer" : "Confirm"}
              </Button>
              <Button variant="outline" className="min-h-11" disabled={saving} onClick={() => setOpen(false)}>{fr ? "Annuler" : "Cancel"}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}