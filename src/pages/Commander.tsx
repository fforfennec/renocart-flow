import { useEffect, useState } from "react";
import { Mic, Square, Loader2, Minus, Plus, Trash2, PackageX, Truck, CalendarDays, Clock, ArrowRight, ArrowLeft, Send, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { createCheckout } from "@/lib/shopifyStorefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Lang = "fr" | "en";
type Item = {
  variantId: string; productTitle: string; variantTitle: string; image: string | null;
  price: string; currency: string; available: boolean; quantity: number;
};
type Missing = { name: string; quantity: number };
type Details = { delivery_date: string | null; time_window: string | null; truck_type: string | null; note: string | null };

const T = {
  fr: {
    bar: "Livraison de matériaux de construction partout dans le Grand Montréal",
    title: "Dis-nous ce dont tu as besoin",
    sub: "Appuie sur le micro et nomme tes matériaux et les quantités. On monte ton panier pour toi.",
    example: "Ex. : « 20 feuilles de gypse 1/2 pouce, 10 deux par quatre de 8 pieds et 3 chaudières de composé »",
    tap: "Appuie pour parler", stop: "Appuie pour terminer", working: "On prépare ton panier…",
    type: "Ou écris ta liste ici", add: "Ajouter",
    cart: "Ton panier", empty: "Ton panier est vide. Parle ou écris ta liste pour commencer.",
    missing: "Pas disponible chez nous", missingSub: "On n'a pas trouvé ces articles dans notre catalogue.",
    total: "Sous-total", next: "Continuer vers la livraison",
    heard: "On a compris :",
    dQ: "Quand veux-tu être livré ?", tQ: "À quel moment de la journée ?", kQ: "Quel type de camion est nécessaire ?", nQ: "Autre chose à savoir ?",
    sayIt: "Ou dis-le", back: "Retour", cont: "Continuer", skip: "Passer",
    windows: { Early: "Tôt (avant 10 h)", AM: "Avant-midi", PM: "Après-midi", Day: "N'importe quand" },
    trucks: { Boom: "Camion girafe (Boom)", "Boom 90ft": "Girafe 90 pi", "Van/Cube": "Camion cube", Hiab: "Grue (Hiab)", unknown: "Je ne sais pas" },
    notePh: "Ex. : livrer au 2e étage, entrée par la ruelle…",
    summary: "Récapitulatif", checkout: "Passer au paiement", items: "articles",
    noDate: "Choisis une date", missingNote: "Articles non disponibles demandés",
  },
  en: {
    bar: "Construction materials delivered across Greater Montréal",
    title: "Tell us what you need",
    sub: "Tap the mic and list your materials and quantities. We'll build your cart for you.",
    example: "E.g. “20 sheets of 1/2 inch drywall, ten 2x4 8 feet and 3 buckets of joint compound”",
    tap: "Tap to speak", stop: "Tap to finish", working: "Building your cart…",
    type: "Or type your list here", add: "Add",
    cart: "Your cart", empty: "Your cart is empty. Speak or type your list to start.",
    missing: "Not available from us", missingSub: "We couldn't find these items in our catalogue.",
    total: "Subtotal", next: "Continue to delivery",
    heard: "We heard:",
    dQ: "When do you want your delivery?", tQ: "What time of day?", kQ: "What kind of truck is needed?", nQ: "Anything else we should know?",
    sayIt: "Or say it", back: "Back", cont: "Continue", skip: "Skip",
    windows: { Early: "Early (before 10am)", AM: "Morning", PM: "Afternoon", Day: "Anytime" },
    trucks: { Boom: "Boom truck", "Boom 90ft": "Boom 90 ft", "Van/Cube": "Cube van", Hiab: "Crane (Hiab)", unknown: "I don't know" },
    notePh: "E.g. deliver to the 2nd floor, back-alley entrance…",
    summary: "Summary", checkout: "Go to checkout", items: "items",
    noDate: "Pick a date", missingNote: "Unavailable items requested",
  },
};

async function callVoice(fd: FormData) {
  const { data, error } = await supabase.functions.invoke("voice-order", { body: fd });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* noop */ }
    throw new Error(msg);
  }
  return data;
}

function MicButton({ onAudio, busy, label, stopLabel, size = "lg" }: {
  onAudio: (b: Blob) => void; busy: boolean; label: string; stopLabel: string; size?: "lg" | "sm";
}) {
  const { recording, start, stop } = useVoiceRecorder();
  const click = async () => {
    if (busy) return;
    if (recording) onAudio(await stop());
    else start().catch(() => toast.error("Micro non autorisé / Microphone blocked"));
  };
  const big = size === "lg";
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={click}
        disabled={busy}
        aria-label={recording ? stopLabel : label}
        className={cn(
          "relative rounded-full flex items-center justify-center transition-all shadow-gold",
          big ? "h-28 w-28" : "h-14 w-14",
          recording ? "bg-destructive text-destructive-foreground scale-105" : "bg-primary text-primary-foreground hover:scale-105",
          busy && "opacity-70",
        )}
      >
        {recording && <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />}
        {busy ? <Loader2 className={cn("animate-spin", big ? "h-10 w-10" : "h-6 w-6")} />
          : recording ? <Square className={big ? "h-10 w-10" : "h-5 w-5"} />
          : <Mic className={big ? "h-12 w-12" : "h-6 w-6"} />}
      </button>
      {big && <span className="text-sm font-medium">{busy ? "" : recording ? stopLabel : label}</span>}
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border-2 px-4 py-3 text-left font-medium transition-colors",
        active ? "border-primary bg-primary/15" : "border-border bg-card hover:border-primary/60",
      )}
    >{children}</button>
  );
}

export default function Commander() {
  const [lang, setLang] = useState<Lang>("fr");
  const t = T[lang];
  const [items, setItems] = useState<Item[]>([]);
  const [missing, setMissing] = useState<Missing[]>([]);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [step, setStep] = useState(0); // 0 list, 1 date, 2 window, 3 truck, 4 note, 5 summary
  const [d, setD] = useState<Details>({ delivery_date: null, time_window: null, truck_type: null, note: null });
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => { document.title = lang === "fr" ? "RenoCart — Dis-nous ce dont tu as besoin" : "RenoCart — Tell us what you need"; }, [lang]);

  const mergeCart = (newItems: Item[], newMissing: Missing[]) => {
    setItems((prev) => {
      const next = [...prev];
      for (const it of newItems) {
        const ex = next.find((x) => x.variantId === it.variantId);
        if (ex) ex.quantity += it.quantity; else next.push({ ...it });
      }
      return next;
    });
    setMissing((prev) => [...prev, ...newMissing]);
  };

  const sendCart = async (payload: { audio?: Blob; text?: string }) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("mode", "cart"); fd.append("lang", lang);
      if (payload.audio) fd.append("audio", payload.audio, "voice.webm");
      if (payload.text) fd.append("text", payload.text);
      const r = await callVoice(fd);
      setHeard(r.transcript);
      mergeCart(r.items || [], r.unavailable || []);
      setTyped("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const sendDetails = async (audio: Blob) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("mode", "details"); fd.append("lang", lang); fd.append("audio", audio, "voice.webm");
      const r = await callVoice(fd);
      setHeard(r.transcript);
      const x: Details = r.details;
      setD((p) => ({
        delivery_date: x.delivery_date ?? p.delivery_date,
        time_window: x.time_window ?? p.time_window,
        truck_type: x.truck_type ?? p.truck_type,
        note: x.note ? [p.note, x.note].filter(Boolean).join(" — ") : p.note,
      }));
      // jump to the first unanswered question
      const merged = { ...d, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v)) };
      if (!merged.delivery_date) setStep(1);
      else if (!merged.time_window) setStep(2);
      else if (!merged.truck_type) setStep(3);
      else setStep(Math.max(step, 4));
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const setQty = (id: string, q: number) =>
    setItems((p) => (q <= 0 ? p.filter((x) => x.variantId !== id) : p.map((x) => (x.variantId === id ? { ...x, quantity: q } : x))));

  const subtotal = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const today = new Date().toISOString().slice(0, 10);

  const checkout = async () => {
    setCheckingOut(true);
    try {
      const attributes = [
        d.delivery_date && { key: "delivery_date", value: d.delivery_date },
        d.time_window && { key: "delivery_time_window", value: d.time_window },
        d.truck_type && d.truck_type !== "unknown" && { key: "truck_type", value: d.truck_type },
      ].filter(Boolean) as { key: string; value: string }[];
      const noteParts = [d.note, missing.length ? `${t.missingNote}: ${missing.map((m) => `${m.quantity} × ${m.name}`).join(", ")}` : ""].filter(Boolean);
      const url = await createCheckout(items.map((i) => ({ merchandiseId: i.variantId, quantity: i.quantity })), attributes, noteParts.join("\n"));
      window.open(url, "_blank");
    } catch (e) { toast.error((e as Error).message); }
    finally { setCheckingOut(false); }
  };

  const windowLabel = d.time_window ? t.windows[d.time_window as keyof typeof t.windows] : "—";
  const truckLabel = d.truck_type ? t.trucks[d.truck_type as keyof typeof t.trucks] ?? d.truck_type : "—";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="bg-secondary text-secondary-foreground text-xs text-center py-2 px-4">{t.bar}</div>
      <header className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tight text-secondary">
            RENO<span className="text-primary">CART</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-semibold">
            {(["fr", "en"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={cn("px-2 py-1 rounded", lang === l ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_380px] gap-8">
        <section className="gradient-navy text-secondary-foreground rounded-2xl p-8 md:p-12 flex flex-col items-center text-center min-h-[460px] justify-center">
          {step === 0 && (
            <>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">{t.title}</h1>
              <p className="mt-4 max-w-xl opacity-90">{t.sub}</p>
              <div className="my-10">
                <MicButton busy={busy} onAudio={(b) => sendCart({ audio: b })} label={busy ? t.working : t.tap} stopLabel={t.stop} />
                {busy && <p className="mt-3 text-sm">{t.working}</p>}
              </div>
              <p className="text-sm opacity-75 italic max-w-lg">{t.example}</p>
              <form className="mt-6 flex w-full max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) sendCart({ text: typed }); }}>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.type} className="bg-card text-card-foreground" disabled={busy} />
                <Button type="submit" disabled={busy || !typed.trim()}><Send className="h-4 w-4" /></Button>
              </form>
            </>
          )}

          {step >= 1 && step <= 4 && (
            <div className="w-full max-w-lg text-left">
              <div className="flex gap-1 mb-6">{[1, 2, 3, 4].map((s) => <div key={s} className={cn("h-1.5 flex-1 rounded", s <= step ? "bg-primary" : "bg-secondary-foreground/20")} />)}</div>
              <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
                {step === 1 && <><CalendarDays className="text-primary" />{t.dQ}</>}
                {step === 2 && <><Clock className="text-primary" />{t.tQ}</>}
                {step === 3 && <><Truck className="text-primary" />{t.kQ}</>}
                {step === 4 && t.nQ}
              </h2>
              <div className="text-card-foreground">
                {step === 1 && <Input type="date" min={today} value={d.delivery_date ?? ""} onChange={(e) => setD({ ...d, delivery_date: e.target.value || null })} className="bg-card h-14 text-lg" />}
                {step === 2 && <div className="grid grid-cols-2 gap-3">{Object.entries(t.windows).map(([k, v]) => <Choice key={k} active={d.time_window === k} onClick={() => { setD({ ...d, time_window: k }); setStep(3); }}>{v}</Choice>)}</div>}
                {step === 3 && <div className="grid grid-cols-2 gap-3">{Object.entries(t.trucks).map(([k, v]) => <Choice key={k} active={d.truck_type === k} onClick={() => { setD({ ...d, truck_type: k }); setStep(4); }}>{v}</Choice>)}</div>}
                {step === 4 && <Textarea rows={4} value={d.note ?? ""} onChange={(e) => setD({ ...d, note: e.target.value || null })} placeholder={t.notePh} className="bg-card" />}
              </div>
              <div className="mt-6 flex items-center gap-4">
                <MicButton size="sm" busy={busy} onAudio={sendDetails} label={t.sayIt} stopLabel={t.stop} />
                <span className="text-sm opacity-80">{t.sayIt}</span>
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" className="text-secondary-foreground" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-1" />{t.back}</Button>
                <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !d.delivery_date}>
                  {step === 4 && !d.note ? t.skip : t.cont}<ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="w-full max-w-lg text-left">
              <h2 className="text-3xl font-black mb-6">{t.summary}</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 bg-card text-card-foreground rounded-xl p-5">
                <dt className="text-muted-foreground">{t.dQ}</dt><dd className="font-semibold">{d.delivery_date ?? "—"}</dd>
                <dt className="text-muted-foreground">{t.tQ}</dt><dd className="font-semibold">{windowLabel}</dd>
                <dt className="text-muted-foreground">{t.kQ}</dt><dd className="font-semibold">{truckLabel}</dd>
                {d.note && <><dt className="text-muted-foreground">Note</dt><dd>{d.note}</dd></>}
              </dl>
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" className="text-secondary-foreground" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" />{t.back}</Button>
                <Button size="lg" onClick={checkout} disabled={checkingOut || !items.length}>
                  {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4 mr-2" />{t.checkout}</>}
                </Button>
              </div>
            </div>
          )}

          {heard && <p className="mt-8 text-xs opacity-70 max-w-lg"><span className="font-semibold">{t.heard}</span> « {heard} »</p>}
        </section>

        <aside className="bg-card rounded-2xl border shadow-soft flex flex-col max-h-[calc(100vh-8rem)] lg:sticky lg:top-6">
          <div className="p-5 border-b flex items-baseline justify-between">
            <h2 className="text-lg font-bold">{t.cart}</h2>
            <span className="text-sm text-muted-foreground">{count} {t.items}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!items.length && !missing.length && <p className="text-sm text-muted-foreground text-center py-10">{t.empty}</p>}
            {items.map((i) => (
              <div key={i.variantId} className="flex gap-3">
                <div className="h-14 w-14 rounded-md bg-muted overflow-hidden shrink-0">
                  {i.image && <img src={i.image} alt={i.productTitle} className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight line-clamp-2">{i.productTitle}</p>
                  {i.variantTitle !== "Default Title" && <p className="text-xs text-muted-foreground">{i.variantTitle}</p>}
                  <p className="text-sm font-semibold mt-0.5">{parseFloat(i.price).toFixed(2)} $</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button onClick={() => setQty(i.variantId, 0)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setQty(i.variantId, i.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-7 text-center text-sm">{i.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setQty(i.variantId, i.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
            {missing.length > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-3">
                <p className="text-sm font-semibold flex items-center gap-2 text-destructive"><PackageX className="h-4 w-4" />{t.missing}</p>
                <p className="text-xs text-muted-foreground mb-2">{t.missingSub}</p>
                <ul className="space-y-1">
                  {missing.map((m, idx) => (
                    <li key={idx} className="text-sm flex justify-between gap-2">
                      <span>{m.quantity} × {m.name}</span>
                      <button onClick={() => setMissing((p) => p.filter((_, j) => j !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="p-5 border-t space-y-3">
            <div className="flex justify-between font-semibold"><span>{t.total}</span><span>{subtotal.toFixed(2)} $</span></div>
            {step === 0 && (
              <Button className="w-full" size="lg" disabled={!items.length || busy} onClick={() => { setHeard(""); setStep(1); }}>
                {t.next}<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
