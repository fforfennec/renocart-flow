import { useState, type ReactNode } from "react";
import { ArrowDown, ChevronRight, ChevronUp, Loader2, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { CommanderMobileScroll } from "./CommanderMobileScroll";

type Props = {
  lang: "fr" | "en"; started: boolean; busy: boolean; recording: boolean; checkingOut: boolean;
  mayOrder: boolean; hasItems: boolean; cartLabel: string; typed: string;
  onTyped: (value: string) => void; onSend: () => void; onPayment: () => void;
  welcomeMic: ReactNode; composerMic: ReactNode; items: ReactNode; history: ReactNode;
  delivery: ReactNode; paymentFallback: ReactNode; removalNotice: ReactNode;
};

/** Mobile presentation only; ordering, recording and checkout remain in Commander. */
export function CommanderMobileExperience(p: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const fr = p.lang === "fr";
  const close = fr ? "Fermer" : "Close";
  const composer = (welcome: boolean) => (
    <form className="flex w-full items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (p.typed.trim() && !p.busy && !p.recording) p.onSend(); }}>
      {!welcome && p.composerMic}
      <input aria-label={fr ? "Écrire un message" : "Write a message"} value={p.typed} onChange={(e) => p.onTyped(e.target.value)}
        placeholder={fr ? "Écrivez ici…" : "Type here…"} disabled={p.busy || p.recording}
        className="h-12 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-base text-card-foreground outline-none focus:ring-2 focus:ring-primary" />
      <Button type="submit" size="icon" variant={welcome ? "secondary" : "default"} aria-label={fr ? "Envoyer" : "Send"}
        disabled={p.busy || p.recording || !p.typed.trim()} className="h-12 w-12 shrink-0 rounded-full">
        {p.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
      </Button>
    </form>
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!p.started ? (
        <section className="relative flex min-h-0 flex-1 flex-col bg-secondary px-5 text-secondary-foreground">
          <div className="flex min-h-0 flex-1 flex-col justify-center pt-5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">RenoCart</p>
            <p className="mx-auto mt-3 max-w-[20rem] text-2xl font-bold leading-snug text-secondary-foreground">
              {fr
                ? "Commandez et recevez vos matériaux sur votre chantier le jour même !"
                : "Order your materials and get them on your jobsite the same day!"}
            </p>
            <p className="mx-auto mt-4 max-w-[20rem] text-base leading-relaxed text-secondary-foreground/70">
              {fr
                ? "Utilisé par plus de 200 entrepreneurs canadiens"
                : "Used by more than 200 Canadian entrepreneurs"}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
            <h1 className="text-center text-2xl font-black leading-tight">{fr ? "Dites-nous ce qu’il vous faut, et nous nous occuperons du reste." : "Tell us what you need, and we’ll handle the rest."}</h1>
            <ArrowDown aria-hidden="true" className="mt-4 h-14 w-9 shrink-0 text-primary" strokeWidth={1.5} />
            <div className="mt-2 flex shrink-0 justify-center">{p.welcomeMic}</div>
          </div>

          <div className="mx-auto w-full max-w-sm shrink-0 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p className="mb-2 text-center text-xs text-secondary-foreground/70">{fr ? "Ou écrivez-nous" : "Or write to us"}</p>
            {composer(true)}
          </div>
        </section>

      ) : (
        <>
          <div className="shrink-0 border-b bg-card px-4 py-4">
            <h1 className="text-2xl font-black">{fr ? "Votre liste d’achat" : "Your shopping list"}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{fr ? "Les prix et les taxes s’affichent au paiement." : "Prices and taxes are shown at checkout."}</p>
            {p.cartLabel && <p className="mt-2 text-xs text-muted-foreground">{p.cartLabel}</p>}
          </div>
          <CommanderMobileScroll enabled className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
            <div className="space-y-3">{p.items}</div>
            {p.busy && (
              <div role="status" className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-5">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
                  <p className="text-lg font-bold leading-snug text-primary">{fr ? "Je regarde ça…" : "Looking into it…"}</p>
                </div>
                <div aria-hidden="true" className="mt-4 flex items-end justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-9 w-11 rounded-lg border border-primary/40 bg-primary/15 motion-safe:animate-item-appear" style={{ animationDelay: `${-i * 300}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </CommanderMobileScroll>
          {p.removalNotice}
          <div className="shrink-0 space-y-3 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={() => setHistoryOpen(true)} aria-expanded={historyOpen}
              className="h-12 w-full justify-between rounded-lg px-3 text-left">
              <span className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />{fr ? "Historique de clavardage" : "Conversation history"}</span><ChevronUp className="h-4 w-4" />
            </Button>
            {composer(false)}
            <Button className="h-14 w-full whitespace-normal text-base font-bold" onClick={() => setDeliveryOpen(true)} disabled={!p.hasItems || !p.mayOrder || p.busy || p.recording}>
              {fr ? "Compléter ma commande" : "Complete my order"}<ChevronRight className="h-5 w-5" />
            </Button>
            {!p.mayOrder && <p className="text-center text-xs text-muted-foreground">{fr ? "Votre accès Employé ne permet pas de commander." : "Your Employee access can't place orders."}</p>}
          </div>
        </>
      )}
      <Drawer open={historyOpen} onOpenChange={setHistoryOpen}>
        <DrawerContent aria-describedby={undefined} className="flex h-[75dvh] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b px-4 pb-3 pt-2">
            <DrawerTitle className="text-lg font-bold">{fr ? "Historique de clavardage" : "Conversation history"}</DrawerTitle>
            <Button variant="ghost" size="icon" aria-label={close} onClick={() => setHistoryOpen(false)}><X /></Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-secondary text-secondary-foreground">
            <CommanderMobileScroll enabled className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4"><div className="space-y-3">{p.history}</div></CommanderMobileScroll>
            <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{composer(false)}</div>
          </div>
        </DrawerContent>
      </Drawer>
      <Drawer open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DrawerContent aria-describedby={undefined} className="flex h-[94dvh] max-h-[94dvh] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b px-4 pb-3 pt-2">
            <DrawerTitle className="text-xl font-black uppercase">{fr ? "Livraison" : "Delivery"}</DrawerTitle>
            <Button variant="ghost" size="icon" aria-label={close} onClick={() => setDeliveryOpen(false)}><X /></Button>
          </div>
          <CommanderMobileScroll enabled className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">{p.delivery}</CommanderMobileScroll>
          <div className="shrink-0 space-y-3 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {p.paymentFallback}
            <Button className="min-h-14 w-full whitespace-normal py-3 text-base font-bold" onClick={p.onPayment} disabled={!p.hasItems || !p.mayOrder || p.busy || p.recording || p.checkingOut}>
              {p.checkingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{fr ? "Accéder au paiement" : "Go to payment"}<ChevronRight /></>}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
}