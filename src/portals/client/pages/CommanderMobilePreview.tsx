import { Commander } from "./Commander";

/**
 * "Commande Mobile" — shows the real /commander page inside a phone-sized frame.
 * Rendered in an iframe so the responsive breakpoints evaluate against the
 * phone viewport instead of the browser window.
 */
export const CommanderMobilePreview = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-rc-navy p-4 lg:p-8">
    <p className="text-center text-sm font-semibold uppercase tracking-wide text-rc-gold">
      Commande Mobile — aperçu
    </p>
    <div className="relative overflow-hidden rounded-[2.2rem] border-4 border-black/60 shadow-2xl shadow-black/50">
      <iframe
        src="/commander"
        title="Aperçu mobile de la page de commande"
        className="block h-[844px] w-[390px] border-0 bg-background"
      />
      {/* status-bar-free frame: small notch pill to make the phone feel real */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-2 h-1.5 w-24 -translate-x-1/2 rounded-full bg-black/40" />
    </div>
    <p className="text-center text-xs text-white/60">
      Vue exacte sur un téléphone (390 × 844). La page de commande réelle reste sur /commander.
    </p>
  </div>
);

export default CommanderMobilePreview;
