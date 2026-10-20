import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Commande Mobile" — shows the real /commander page inside a phone-sized frame.
 * Rendered in an iframe so the responsive breakpoints evaluate against the
 * phone viewport instead of the browser window.
 */
export const CommanderMobilePreview = () => {
  const [previewKey, setPreviewKey] = useState(0);
  const clearCurrentOrder = () => {
    localStorage.removeItem("renocart-commander-v2");
    setPreviewKey((key) => key + 1);
  };
  return (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-rc-navy p-4 lg:p-8">
    <p className="text-center text-sm font-semibold uppercase tracking-wide text-rc-gold">
      Commande Mobile — aperçu
    </p>
    <Button variant="outline" onClick={clearCurrentOrder}>
      <Trash2 className="mr-2 size-4" />
      Vider la commande de l’aperçu
    </Button>
    <div className="relative overflow-hidden rounded-[2.2rem] border-4 border-black/60 shadow-2xl shadow-black/50">
      <iframe
        key={previewKey}
        src="/commander"
        title="Aperçu mobile de la page de commande"
        className="block h-[844px] w-[390px] border-0 bg-background"
      />
    </div>
    <p className="text-center text-xs text-white/60">
      Vue exacte sur un téléphone (390 × 844). La page de commande réelle reste sur /commander.
    </p>
  </div>
  );
};

export default CommanderMobilePreview;
