import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Loader2, Minus, Plus, Trash2, PackageX, Send, ChevronUp, ChevronRight, ShoppingCart, Pencil, RotateCcw, X, Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { CommanderMobileScroll } from "@/components/CommanderMobileScroll";
import { CommanderVariantSelector } from "@/components/CommanderVariantSelector";
import type { CatalogVariant, VariantProduct } from "@/lib/shopifyVariants";
import { fr as frLocale, enCA } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { createCheckout } from "@/lib/shopifyStorefront";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Lang = "fr" | "en";
type Item = {
  variantId: string; productTitle: string; variantTitle: string; image: string | null;
  price: string; currency: string; available: boolean; quantity: number;
};
type Missing = { name: string; quantity: number };
type Field = "date" | "window" | "truck" | "note";
type Question = "list" | "more" | Field | "summary";
type Details = { delivery_date: string | null; time_window: string | null; truck_type: string | null; note: string | null };
type Change = { q: number; title: string; from?: number };
type Msg =
  | { id: string; from: "user"; text: string }
  | { id: string; from: "user"; voice: number; transcript?: string }
  | { id: string; from: "user"; answer: Field; value: string | null }
  | { id: string; from: "user"; done: true }
  | { id: string; from: "bot"; formatChange: { title: string; before: string; after: string } }
  | { id: string; from: "bot"; added: Change[]; removed: Change[]; missing: Missing[] }
  | { id: string; from: "bot"; nothing: true; dismissed?: boolean };

const T = {
  fr: {
    bar: "Livraison de matériaux de construction partout dans le Grand Montréal",
    title: "Dis-nous ce dont tu as besoin",
    sub: "Appuie sur le micro et nomme tes matériaux et les quantités. On monte ton panier pour toi.",
    example: "Ex. : « 20 feuilles de gypse 1/2 pouce, 10 deux par quatre de 8 pieds et 3 chaudières de composé »",
    tap: "Appuie pour parler", listening: "Je t'écoute… touche pour arrêter", working: "Je regarde ça…",
    type: "Écris ici…", cart: "Ton panier", empty: "Ton panier est vide. Parle ou écris ta liste pour commencer.",
    missing: "Pas disponible chez nous", missingSub: "On n'a pas trouvé ces articles dans notre catalogue.",
    priceNote: "Les prix et les taxes s'affichent au paiement.",
    products: (n: number) => `${n} produit${n > 1 ? "s" : ""}`, units: (n: number) => `${n} unité${n > 1 ? "s" : ""}`,
    added: "J'ai ajouté", removed: "J'ai enlevé", and: "et", notFound: "Je n'ai pas trouvé", nothing: "Je n'ai pas compris un des articles. Tu peux le répéter ?", repeat: "Répéter", ignore: "Ignorer", voice: "Message vocal",
    confirmRestart: "Effacer ton panier et la conversation ?", yesRestart: "Oui, recommencer", cancel: "Annuler",
    qList: "Qu'est-ce qu'il te faut ?", qMore: "Autre chose à ajouter ?", done: "C'est tout", addMore: "Ajouter autre chose", addMoreHint: "Vas-y, dis-moi ce que tu veux ajouter.",
    qDate: "Pour quand ?", tomorrow: "Demain", after: "Après-demain", pick: "Choisir une date",
    qWindow: "À quel moment de la journée ?", qTruck: "Quel camion ?",
    qNote: "Autre chose à savoir pour la livraison ? (étage, ruelle…)", noNote: "Non, c'est tout",
    windows: { Early: "Tôt (avant 10 h)", AM: "Avant-midi", PM: "Après-midi", Day: "N'importe quand" },
    trucks: { Boom: "Camion girafe (Boom)", "Boom 90ft": "Girafe 90 pi", "Van/Cube": "Camion cube", Hiab: "Grue (Hiab)", unknown: "Je ne sais pas" },
    summary: "Voici ta commande", materials: "Matériaux", date: "Date", when: "Moment", truck: "Camion", notes: "Notes", none: "Aucune",
    edit: "Modifier", checkout: "Placer ma commande", missingNote: "Articles non disponibles demandés", restart: "Recommencer", inCart: "C'est dans ton panier :", seeCart: "Voir le panier", close: "Fermer", changeFormat: "Changer de format", backChat: "Retour à la conversation", totalNote: "Tu verras le total et les taxes avant de payer.", delivery: "Livraison", add: "Ajouter",
  },
  en: {
    bar: "Construction materials delivered across Greater Montréal",
    title: "Tell us what you need",
    sub: "Tap the mic and list your materials and quantities. We'll build your cart for you.",
    example: "E.g. “20 sheets of 1/2 inch drywall, ten 2x4 8 feet and 3 buckets of joint compound”",
    tap: "Tap to speak", listening: "Listening… tap to stop", working: "Looking into it…",
    type: "Type here…", cart: "Your cart", empty: "Your cart is empty. Speak or type your list to start.",
    missing: "Not available from us", missingSub: "We couldn't find these items in our catalogue.",
    priceNote: "Prices and taxes are shown at checkout.",
    products: (n: number) => `${n} product${n > 1 ? "s" : ""}`, units: (n: number) => `${n} unit${n > 1 ? "s" : ""}`,
    added: "I added", removed: "I removed", and: "and", notFound: "I couldn't find", nothing: "I didn't understand one of the items. Can you repeat it?", repeat: "Repeat", ignore: "Ignore", voice: "Voice message",
    confirmRestart: "Clear your cart and the conversation?", yesRestart: "Yes, start over", cancel: "Cancel",
    qList: "What do you need?", qMore: "Anything else to add?", done: "That's all", addMore: "Add something else", addMoreHint: "Go ahead, tell me what to add.",
    qDate: "When?", tomorrow: "Tomorrow", after: "Day after tomorrow", pick: "Pick a date",
    qWindow: "What time of day?", qTruck: "Which truck?",
    qNote: "Anything else to know for delivery? (floor, alley…)", noNote: "No, that's all",
    windows: { Early: "Early (before 10am)", AM: "Morning", PM: "Afternoon", Day: "Anytime" },
    trucks: { Boom: "Boom truck", "Boom 90ft": "Boom 90 ft", "Van/Cube": "Cube van", Hiab: "Crane (Hiab)", unknown: "I don't know" },
    summary: "Here's your order", materials: "Materials", date: "Date", when: "Time", truck: "Truck", notes: "Notes", none: "None",
    edit: "Edit", checkout: "Place my order", missingNote: "Unavailable items requested", restart: "Start over", inCart: "It's in your cart:", seeCart: "See cart", close: "Close", changeFormat: "Change size", backChat: "Back to the conversation", totalNote: "You'll see the total and taxes before paying.", delivery: "Delivery", add: "Add",
  },
};

const STORE = "renocart-commander-v2";
const uid = () => Math.random().toString(36).slice(2, 10);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Display-only short name: drop brand prefix / codes, keep type + format.
const shortName = (title: string) => {
  let s = title.replace(/\s*[-–—|].*$/, "").replace(/\b1\/2\b/g, "½").replace(/\b1\/4\b/g, "¼").replace(/\b3\/4\b/g, "¾").replace(/\b5\/8\b/g, "⅝");
  s = s.replace(/\b(CGC|Sheetrock|USG|Certainteed|CertainTeed|Georgia[- ]Pacific|Lafarge|Owens Corning|ROXUL|Rockwool|Dap|DAP)\b/gi, "").replace(/\(.*?\)/g, "");
  s = s.replace(/\s+/g, " ").trim();
  const w = s.split(" "); if (w.length > 6) s = w.slice(0, 6).join(" ");
  s = s.replace(/[.,;:!?]+$/, "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : title;
};
const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

type Saved = { items: Item[]; missing: Missing[]; msgs: Msg[]; d: Details; listDone: boolean; answered: Field[]; lang: Lang };
function load(): Saved | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; }
}

async function callVoice(fd: FormData) {
  const { data, error } = await supabase.functions.invoke("voice-order", { body: fd });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* noop */ }
    throw new Error(msg);
  }
  return data;
}

function MicButton({ onAudio, busy, big, mobile, t, recording, start, stop }: {
  onAudio: (b: Blob) => void; busy: boolean; big?: boolean; mobile?: boolean; t: typeof T.fr;
  recording: boolean; start: () => Promise<void>; stop: () => Promise<Blob>;
}) {
  const click = async () => {
    if (busy) return;
    if (recording) {
      const b = await stop();
      if (b.size < 2000) { toast.error(t.tap); return; }
      onAudio(b);
    }
    else start().catch(() => toast.error("Micro non autorisé / Microphone blocked"));
  };
  const label = busy ? t.working : recording ? t.listening : t.tap;
  return (
    <div className={cn("flex items-center gap-3", big && "flex-col")}>
      <button type="button" onClick={click} disabled={busy} aria-label={label}
        className={cn("relative shrink-0 rounded-full flex items-center justify-center transition-all shadow-gold",
          big ? "h-28 w-28" : mobile ? "h-14 w-14 ring-4 ring-primary/25" : "h-12 w-12",
          recording ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:scale-105",
          busy && "opacity-70")}>
        {recording && <span className="absolute inset-0 rounded-full bg-destructive/40 motion-safe:animate-ping" />}
        {busy ? <Loader2 className={cn("animate-spin", big ? "h-10 w-10" : "h-5 w-5")} />
          : recording ? <Square className={big ? "h-10 w-10" : "h-5 w-5"} /> : <Mic className={big ? "h-12 w-12" : "h-5 w-5"} />}
      </button>
      {(big || (recording && !mobile)) && <span className={cn("font-medium", big ? "text-sm" : "text-xs")}>{label}</span>}
    </div>
  );
}

const Pill = ({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) => (
  <button onClick={onClick}
    className={cn("min-h-11 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-secondary-foreground/70 hover:bg-primary hover:border-primary hover:text-primary-foreground active:bg-primary")}>
    {children}
  </button>
);

const BotBubble = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-start motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-300">
    <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary-foreground/10 px-4 py-3 text-secondary-foreground">{children}</div>
  </div>
);
const UserBubble = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <div className="flex justify-end motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-300">
    <button disabled={!onClick} onClick={onClick}
      className={cn("max-w-[85%] text-left rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground font-medium", onClick && "hover:opacity-90")}>
      {children}
    </button>
  </div>
);

export default function Commander() {
  const saved = useMemo(load, []);
  const [lang, setLang] = useState<Lang>(saved?.lang ?? "fr");
  const t = T[lang];
  const [items, setItems] = useState<Item[]>(saved?.items ?? []);
  const [missing, setMissing] = useState<Missing[]>(saved?.missing ?? []);
  const [msgs, setMsgs] = useState<Msg[]>(saved?.msgs ?? []);
  const [d, setD] = useState<Details>(saved?.d ?? { delivery_date: null, time_window: null, truck_type: null, note: null });
  const [listDone, setListDone] = useState(saved?.listDone ?? false);
  const [answered, setAnswered] = useState<Field[]>(saved?.answered ?? []);
  const [editing, setEditing] = useState<Question | null>(null);
  const [showCal, setShowCal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { recording: micOn, start: micStart, stop: micStop } = useVoiceRecorder();
  const recStart = useRef(0);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const isMobile = useIsMobile();
  const [bump, setBump] = useState(0);
  const [removedProduct, setRemovedProduct] = useState<{ item: Item; index: number; key: string } | null>(null);
  useEffect(() => {
    if (!removedProduct) return;
    const timer = window.setTimeout(() => setRemovedProduct(null), 5000);
    return () => window.clearTimeout(timer);
  }, [removedProduct]);
  const sig = items.map((i) => `${i.variantId}:${i.quantity}`).join("|");
  const firstSig = useRef(true);
  useEffect(() => { if (firstSig.current) { firstSig.current = false; return; } setBump((b) => b + 1); }, [sig]);
  const startRec = () => { recStart.current = Date.now(); return micStart(); };
  const micHandler = (b: Blob) => send({ audio: b, dur: Math.max(1, Math.round((Date.now() - recStart.current) / 1000)) });
  const openMic = () => { if (!busy && !micOn) startRec().catch(() => toast.error("Micro non autorisé / Microphone blocked")); };

  useEffect(() => { document.title = lang === "fr" ? "RenoCart — Dis-nous ce dont tu as besoin" : "RenoCart — Tell us what you need"; }, [lang]);
  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify({ items, missing, msgs, d, listDone, answered, lang }));
  }, [items, missing, msgs, d, listDone, answered, lang]);

  const started = msgs.length > 0;
  const question: Question = editing ?? (!started ? "list" : !listDone ? "more"
    : (["date", "window", "truck", "note"] as Field[]).find((f) => !answered.includes(f)) ?? "summary");

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, question, busy, showCal, confirmRestart, isMobile]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const answer = (f: Field, value: string | null) => {
    const key = { date: "delivery_date", window: "time_window", truck: "truck_type", note: "note" }[f] as keyof Details;
    setD((p) => ({ ...p, [key]: value }));
    setAnswered((p) => (p.includes(f) ? p : [...p, f]));
    push({ id: uid(), from: "user", answer: f, value });
    setShowCal(false);
    setEditing(null);
  };

  const finishList = () => { push({ id: uid(), from: "user", done: true }); setListDone(true); setEditing(null); };

  const send = async (payload: { audio?: Blob; text?: string; dur?: number }) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("mode", "turn"); fd.append("lang", lang); fd.append("question", question);
      fd.append("cart", JSON.stringify(items.map((i) => ({ title: `${i.productTitle}${i.variantTitle !== "Default Title" ? ` — ${i.variantTitle}` : ""}`, quantity: i.quantity }))));
      if (payload.audio) fd.append("audio", payload.audio, "voice.webm");
      if (payload.text) fd.append("text", payload.text);
      const r = await callVoice(fd);
      setTyped("");
      if (payload.audio) console.info("[commander] transcript:", r.transcript);
      const out: Msg[] = [payload.audio
        ? { id: uid(), from: "user", voice: payload.dur ?? 1, transcript: r.transcript }
        : { id: uid(), from: "user", text: payload.text ?? r.transcript }];

      // cart ops
      const next = items.map((i) => ({ ...i }));
      const removed: Change[] = [];
      for (const op of r.remove ?? []) {
        const it = items[op.index]; if (!it) continue;
        const cur = next.find((x) => x.variantId === it.variantId)!;
        const q = op.quantity > 0 ? Math.min(op.quantity, cur.quantity) : cur.quantity;
        const before = cur.quantity; cur.quantity -= q; removed.push({ q, title: it.productTitle, from: before });
      }
      const added: Change[] = [];
      for (const it of (r.add ?? []) as Item[]) {
        const ex = next.find((x) => x.variantId === it.variantId);
        if (ex) { const before = ex.quantity; ex.quantity += it.quantity; added.push({ q: ex.quantity, title: it.productTitle, from: before }); }
        else { next.push({ ...it }); added.push({ q: it.quantity, title: it.productTitle }); }
      }
      setItems(next.filter((x) => x.quantity > 0));
      const miss: Missing[] = r.unavailable ?? [];
      if (miss.length) setMissing((p) => [...p, ...miss]);

      // details
      const x: Details = r.details ?? {};
      const got: [Field, string | null][] = [];
      if (x.delivery_date) got.push(["date", x.delivery_date]);
      if (x.time_window) got.push(["window", x.time_window]);
      if (x.truck_type) got.push(["truck", x.truck_type]);
      if (x.note) got.push(["note", x.note]);
      if (question === "note" && r.done && !x.note) got.push(["note", null]);

      const changed = added.length || removed.length || miss.length;
      if (changed) out.push({ id: uid(), from: "bot", added, removed, missing: miss });
      else if (!got.length && !r.done) out.push({ id: uid(), from: "bot", nothing: true });
      setMsgs((p) => [...p, ...out]);

      if (got.length) {
        setD((p) => {
          const n = { ...p };
          for (const [f, v] of got) n[{ date: "delivery_date", window: "time_window", truck: "truck_type", note: "note" }[f] as keyof Details] = v;
          return n;
        });
        setAnswered((p) => Array.from(new Set([...p, ...got.map(([f]) => f)])));
        if (!listDone && started) setListDone(true);
        setEditing(null);
      } else if (r.done && (question === "more" || question === "list") && (next.some((i) => i.quantity > 0))) {
        setListDone(true); setEditing(null);
      } else if (editing && editing !== "more" && changed) {
        /* keep asking same question */
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const setQty = (id: string, q: number) =>
    setItems((p) => (q <= 0 ? p.filter((x) => x.variantId !== id) : p.map((x) => (x.variantId === id ? { ...x, quantity: q } : x))));

  const changeVariant = (id: string, product: VariantProduct, variant: CatalogVariant, previous: CatalogVariant) => {
    if (!items.some((i) => i.variantId === id)) return;
    setItems((current) => {
      const source = current.find((i) => i.variantId === id);
      if (!source) return current;
      const replacement = { ...source, variantId: variant.id, productTitle: product.title, variantTitle: variant.title,
        image: variant.image?.url ?? product.featuredImage?.url ?? source.image,
        price: variant.price.amount, currency: variant.price.currencyCode, available: variant.availableForSale };
      const existing = current.find((i) => i.variantId === variant.id);
      if (existing) return current.filter((i) => i.variantId !== id).map((i) => i.variantId === variant.id
        ? { ...replacement, quantity: existing.quantity + source.quantity } : i);
      return current.map((i) => i.variantId === id ? replacement : i);
    });
    const changed = previous.selectedOptions.filter((o) => variant.selectedOptions.some((v) => v.name === o.name && v.value !== o.value));
    const before = changed.map((o) => o.value).join(" / ") || previous.title;
    const after = changed.map((o) => variant.selectedOptions.find((v) => v.name === o.name)?.value).filter(Boolean).join(" / ") || variant.title;
    push({ id: uid(), from: "bot", formatChange: { title: shortName(product.title), before, after } });
  };

  const decreaseProduct = (item: Item) => {
    if (item.quantity > 1) { setQty(item.variantId, item.quantity - 1); return; }
    setRemovedProduct({ item: { ...item }, index: items.findIndex((i) => i.variantId === item.variantId), key: uid() });
    setQty(item.variantId, 0);
  };
  const undoRemoval = () => {
    if (!removedProduct) return;
    const { item, index } = removedProduct;
    setItems((current) => {
      if (current.some((i) => i.variantId === item.variantId)) return current.map((i) => i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i);
      const next = [...current]; next.splice(Math.max(0, Math.min(index, next.length)), 0, item); return next;
    });
    setRemovedProduct(null);
  };
  const removalNotice = removedProduct && <div role="status" className="shrink-0 px-4 py-2 border-t flex items-center justify-between gap-2 text-sm">
    <span>{lang === "fr" ? "Produit retiré" : "Product removed"}</span>
    <Button variant="ghost" className="h-11 text-secondary font-semibold" onClick={undoRemoval}>{t.cancel}</Button>
  </div>;
  const variantSelector = (item: Item) => <CommanderVariantSelector variantId={item.variantId} lang={lang} disabled={busy || checkingOut}
    row={{ title: shortName(item.productTitle), detail: item.variantTitle !== "Default Title" ? item.variantTitle : "", image: item.image,
      quantity: item.quantity, onDecrease: () => decreaseProduct(item), onIncrease: () => setQty(item.variantId, item.quantity + 1) }}
    onConfirm={(product, variant, previous) => changeVariant(item.variantId, product, variant, previous)} />;

  const mobileSummary = isMobile && question === "summary" && !confirmRestart && !busy;
  const units = items.reduce((s, i) => s + i.quantity, 0);
  const cartLabel = `${t.products(items.length)} · ${t.units(units)}`;

  const fmtDate = (s: string | null) => s ? new Date(`${s}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { weekday: "long", day: "numeric", month: "long" }) : "—";
  const fmt = (f: Field, v: string | null) =>
    f === "date" ? fmtDate(v)
      : f === "window" ? (v ? t.windows[v as keyof typeof t.windows] ?? v : "—")
      : f === "truck" ? (v ? t.trucks[v as keyof typeof t.trucks] ?? v : "—")
      : v || t.noNote;

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
      window.location.href = url;
    } catch (e) { toast.error((e as Error).message); setCheckingOut(false); }
  };

  const restart = () => {
    setConfirmRestart(false);
    setRemovedProduct(null);
    setItems([]); setMissing([]); setMsgs([]); setListDone(false); setAnswered([]); setEditing(null);
    setD({ delivery_date: null, time_window: null, truck_type: null, note: null });
  };

  const joinList = (a: string[]) => a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} ${t.and} ${a[a.length - 1]}`;
  const clean = (s: string) => s.replace(/[.,;:!?\s]+$/, "");
  const delta = (x: Change) => `${shortName(x.title)} : ${x.from} → ${x.q}`;

  const renderMsg = (m: Msg) => {
    if (m.from === "user") {
      if ("voice" in m) return (
        <UserBubble key={m.id}><span className="flex items-center gap-2"><Mic className="h-4 w-4" />{t.voice} · {fmtDur(m.voice)}</span></UserBubble>
      );
      if ("text" in m) return <UserBubble key={m.id}>{m.text}</UserBubble>;
      const q = "done" in m ? t.qMore : { date: t.qDate, window: t.qWindow, truck: t.qTruck, note: t.qNote }[m.answer];
      return (
        <div key={m.id} className="space-y-3">
          <BotBubble>{q}</BotBubble>
          {"done" in m ? <UserBubble>{t.done}</UserBubble>
            : <UserBubble onClick={() => setEditing(m.answer)}>{fmt(m.answer, m.value)}</UserBubble>}
        </div>
      );
    }
    if ("formatChange" in m) return <BotBubble key={m.id}>{m.formatChange.title} : {m.formatChange.before} → {m.formatChange.after}.</BotBubble>;
    if ("nothing" in m) {
      const last = msgs[msgs.length - 1]?.id === m.id;
      return (
        <BotBubble key={m.id}>
          <p>{t.nothing}</p>
          {last && !m.dismissed && !busy && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Pill onClick={openMic}>{t.repeat}</Pill>
              <Pill onClick={() => setMsgs((p) => p.map((x) => (x.id === m.id ? { ...x, dismissed: true } as Msg : x)))}>{t.ignore}</Pill>
            </div>
          )}
        </BotBubble>
      );
    }
    const newAdds = m.added.filter((x) => x.from == null);
    const fullRemoved = m.removed.filter((x) => x.from != null && x.from - x.q <= 0);
    const partRemoved = m.removed.filter((x) => x.from != null && x.from - x.q > 0);
    if (isMobile && (m.added.length || m.removed.length)) {
      const rows = [
        ...m.added.map((x) => ({ s: `+${x.q - (x.from ?? 0)}`, n: shortName(x.title), plus: true })),
        ...m.removed.map((x) => ({ s: `−${x.q}`, n: shortName(x.title), plus: false })),
      ];
      return (
        <BotBubble key={m.id}>
          <p>{t.inCart}</p>
          <div className="mt-2 rounded-xl bg-secondary-foreground/5 px-3 py-2 space-y-1">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-3"><b className={cn("w-10 shrink-0", r.plus ? "text-primary" : "opacity-80")}>{r.s}</b><span className="min-w-0">{r.n}</span></div>
            ))}
          </div>
          {m.missing.length > 0 && (
            <p className="mt-2 flex gap-2 text-sm opacity-90"><PackageX className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>{t.notFound} {joinList(m.missing.map((x) => `${x.quantity} ${clean(x.name)}`))}.</span></p>
          )}
          <button onClick={() => setCartOpen(true)} className="mt-2 min-h-11 flex items-center gap-1 font-semibold text-primary">{t.seeCart}<ChevronRight className="h-4 w-4" /></button>
        </BotBubble>
      );
    }
    return (
      <BotBubble key={m.id}>
        {newAdds.length > 0 && <p>{t.added} {joinList(newAdds.map((x) => `${x.q} ${shortName(x.title)}`))}.</p>}
        {m.added.filter((x) => x.from != null).map((x, i) => <p key={"a" + i}>{delta(x)}.</p>)}
        {partRemoved.map((x, i) => <p key={"p" + i}>{shortName(x.title)} : {x.from} → {(x.from ?? 0) - x.q}.</p>)}
        {fullRemoved.length > 0 && <p>{t.removed} {joinList(fullRemoved.map((x) => shortName(x.title)))}.</p>}
        {m.missing.length > 0 && (
          <p className="mt-1 flex gap-2 text-sm opacity-90"><PackageX className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>{t.notFound} {joinList(m.missing.map((x) => `${x.quantity} ${clean(x.name)}`))}.</span></p>
        )}
      </BotBubble>
    );
  };

  const prompt = () => {
    if (!started) return null;
    switch (question) {
      case "list": case "more":
        return (
          <BotBubble>
            <p className="mb-3">{t.qMore}</p>
            <div className="flex flex-wrap gap-2">
              <Pill onClick={finishList}>{t.done}</Pill>
              <Pill onClick={openMic}>{t.addMore}</Pill>
            </div>
          </BotBubble>
        );
      case "date": {
        const tom = addDays(1), aft = addDays(2);
        return (
          <BotBubble>
            <p className="mb-3">{t.qDate}</p>
            <div className="flex flex-wrap gap-2">
              <Pill onClick={() => answer("date", tom)}>{t.tomorrow}</Pill>
              <Pill onClick={() => answer("date", aft)}>{t.after}</Pill>
              <Pill active={showCal} onClick={() => setShowCal((s) => !s)}>{t.pick}</Pill>
            </div>
            {showCal && (
              <div className="mt-3 rounded-xl bg-card text-card-foreground w-fit">
                <Calendar mode="single" locale={lang === "fr" ? frLocale : enCA}
                  selected={d.delivery_date ? new Date(`${d.delivery_date}T12:00:00`) : undefined}
                  disabled={{ before: new Date(Date.now() + 864e5) }}
                  onSelect={(day) => day && answer("date", ymd(day))} />
              </div>
            )}
          </BotBubble>
        );
      }
      case "window":
        return (
          <BotBubble>
            <p className="mb-3">{t.qWindow}</p>
            <div className="flex flex-wrap gap-2">{Object.entries(t.windows).map(([k, v]) => <Pill key={k} onClick={() => answer("window", k)}>{v}</Pill>)}</div>
          </BotBubble>
        );
      case "truck":
        return (
          <BotBubble>
            <p className="mb-3">{t.qTruck}</p>
            <div className="flex flex-wrap gap-2">{Object.entries(t.trucks).map(([k, v]) => <Pill key={k} onClick={() => answer("truck", k)}>{v}</Pill>)}</div>
          </BotBubble>
        );
      case "note":
        return (
          <BotBubble>
            <p className="mb-3">{t.qNote}</p>
            <Pill onClick={() => answer("note", null)}>{t.noNote}</Pill>
          </BotBubble>
        );
      case "summary": {
        const editF = (f: Question) => { setEditing(f); if (f === "more") setListDone(false); openMic(); };
        if (isMobile) {
          const MRow = ({ label, f, children, action }: { label: string; f: Question; children: React.ReactNode; action?: string }) => (
            <div className="py-3 border-b last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
                <button onClick={() => editF(f)} className="min-h-11 -my-3 flex items-center gap-1.5 font-semibold text-secondary"><Pencil className="h-4 w-4" />{action ?? t.edit}</button>
              </div>
              <div className="mt-1">{children}</div>
            </div>
          );
          return (
            <div className="motion-safe:animate-in motion-safe:fade-in duration-300 rounded-3xl bg-card text-card-foreground p-5 shadow-soft">
              <h3 className="text-2xl font-black mb-2">{t.summary}</h3>
              <MRow label={t.delivery} f="date"><p className="font-semibold first-letter:uppercase">{fmt("date", d.delivery_date)} · {fmt("window", d.time_window).toLowerCase()}</p></MRow>
              <MRow label={t.truck} f="truck"><p className="font-semibold">{fmt("truck", d.truck_type)}</p></MRow>
              <MRow label={t.notes} f="note"><p className={d.note ? "font-semibold" : "text-muted-foreground"}>{d.note || t.none}</p></MRow>
            </div>
          );
        }
        const Row = ({ label, value, f }: { label: string; value: React.ReactNode; f: Question }) => (
          <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
            <dt className="w-24 shrink-0 text-sm text-muted-foreground">{label}</dt>
            <dd className="flex-1 text-sm font-semibold">{value}</dd>
            <button onClick={() => editF(f)}
              className="min-h-11 -my-2 px-2 text-xs font-semibold text-secondary hover:underline flex items-center gap-1"><Pencil className="h-3 w-3" />{t.edit}</button>
          </div>
        );
        return (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-300 rounded-2xl bg-card text-card-foreground p-5 shadow-soft">
            <h3 className="text-lg font-black mb-2">{t.summary}</h3>
            <dl>
              <Row f="more" label={t.materials} value={<ul className="space-y-0.5 font-medium">{items.map((i) => <li key={i.variantId}>{i.quantity} × {i.productTitle}</li>)}</ul>} />
              <Row f="date" label={t.date} value={fmt("date", d.delivery_date)} />
              <Row f="window" label={t.when} value={fmt("window", d.time_window)} />
              <Row f="truck" label={t.truck} value={fmt("truck", d.truck_type)} />
              <Row f="note" label={t.notes} value={d.note || t.none} />
            </dl>
            <Button size="lg" className="w-full mt-4 h-14 text-base font-bold" onClick={checkout} disabled={checkingOut || !items.length}>
              {checkingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : t.checkout}
            </Button>
          </div>
        );
      }
    }
  };

  const cartBody = (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!items.length && !missing.length && <p className="text-sm text-muted-foreground text-center py-10">{t.empty}</p>}
        {items.map((i) => (
          <div key={i.variantId}>
          {variantSelector(i)}
          </div>
        ))}
        {missing.length > 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm font-semibold flex items-center gap-2 text-destructive"><PackageX className="h-4 w-4" />{t.missing}</p>
            <p className="text-xs text-muted-foreground mb-2">{t.missingSub}</p>
            <ul className="space-y-1">
              {missing.map((m, idx) => (
                <li key={idx} className="text-sm flex justify-between items-center gap-2">
                  <span>{m.quantity} × {m.name}</span>
                  <button onClick={() => setMissing((p) => p.filter((_, j) => j !== idx))} className="text-muted-foreground hover:text-destructive p-2"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {removalNotice}
      <p className="px-5 py-3 border-t text-xs text-muted-foreground">{t.priceNote}</p>
    </>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground">
      <div className="hidden sm:block bg-secondary text-secondary-foreground text-xs text-center py-2 px-4">{t.bar}</div>
      <header className="bg-card border-b shrink-0">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tight text-secondary">RENO<span className="text-primary">CART</span></div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {started && !isMobile && <button onClick={() => setConfirmRestart(true)} className="text-xs text-muted-foreground hover:underline mr-2">{t.restart}</button>}
            {isMobile && <Button variant="ghost" size="icon" aria-label={t.restart} title={t.restart} onClick={() => setConfirmRestart(true)} className="h-11 w-11 shrink-0"><RotateCcw className="h-5 w-5" /></Button>}
            <div className={cn("flex", isMobile && "rounded-xl bg-muted p-1")}>
              {(["fr", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className={cn("px-2 py-1 rounded", isMobile && "px-3 rounded-lg", lang === l ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto lg:px-4 lg:py-6 grid lg:grid-cols-[1fr_380px] gap-6">
        <section className="gradient-navy text-secondary-foreground lg:rounded-2xl flex flex-col min-h-0">
          {/* tablet cart bar (desktop layout, unchanged) */}
          {started && !isMobile && (
            <div className="lg:hidden shrink-0 bg-card text-card-foreground border-b">
              <button onClick={() => setCartOpen((o) => !o)} className="w-full min-h-11 px-4 py-2 flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" />{t.cart} · {cartLabel}</span>
                <ChevronUp className={cn("h-4 w-4 transition-transform", !cartOpen && "rotate-180")} />
              </button>
              {cartOpen && <div className="max-h-[50dvh] flex flex-col border-t">{cartBody}</div>}
            </div>
          )}

          <CommanderMobileScroll enabled={isMobile} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 md:px-8 py-6">
            {!started && !confirmRestart ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">{t.title}</h1>
                <p className="mt-4 max-w-xl opacity-90">{t.sub}</p>
                <div className="my-10"><MicButton big busy={busy} onAudio={micHandler} t={t} recording={micOn} start={startRec} stop={micStop} /></div>
                <p className="text-sm opacity-75 italic max-w-lg">{t.example}</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl mx-auto">
                <h1 className="hidden md:block text-xl font-black tracking-tight text-center mb-4 opacity-90">{t.title}</h1>
                {msgs.map(renderMsg)}
                {confirmRestart ? (
                  <BotBubble>
                    <p className="mb-3">{t.confirmRestart}</p>
                    <div className="flex flex-wrap gap-2"><Pill onClick={restart}>{t.yesRestart}</Pill><Pill onClick={() => setConfirmRestart(false)}>{t.cancel}</Pill></div>
                  </BotBubble>
                ) : busy ? <BotBubble><span className="tracking-widest motion-safe:animate-pulse">…</span></BotBubble> : prompt()}
                <div ref={endRef} />
              </div>
            )}
          </CommanderMobileScroll>

          {isMobile ? (
            <div className="shrink-0 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
              <Button key={bump} variant="ghost" onClick={() => setCartOpen(true)}
                className={cn("w-full rounded-2xl bg-card text-card-foreground hover:bg-card px-4 h-14 flex items-center gap-3 text-left shadow-soft", bump > 0 && "animate-cart-bump")}>
                <span className="relative shrink-0">
                  <ShoppingCart className="h-6 w-6" />
                  {items.length > 0 && <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{items.length}</span>}
                </span>
                <span className="flex-1 min-w-0 truncate"><b>{t.cart}</b> <span className="text-muted-foreground text-sm">{cartLabel}</span></span>
                <ChevronUp className="h-5 w-5 shrink-0" />
              </Button>
              {mobileSummary ? (
              <div>
                <Button size="lg" className="w-full h-14 rounded-2xl text-base font-bold" onClick={checkout} disabled={checkingOut || !items.length}>
                  {checkingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : t.checkout}
                </Button>
                <p className="mt-2 text-center text-xs opacity-70">{t.totalNote}</p>
              </div>
            ) : (
                <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim() && !busy) send({ text: typed.trim() }); }}>
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.type} disabled={busy}
                    className="flex-1 min-w-0 h-14 rounded-full bg-card text-card-foreground px-5 text-base outline-none focus:ring-2 focus:ring-primary" />
                  {typed.trim() ? (
                    <Button type="submit" size="icon" aria-label="Envoyer" className="h-14 w-14 rounded-full shrink-0" disabled={busy}>
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  ) : (
                    <MicButton mobile busy={busy} onAudio={micHandler} t={t} recording={micOn} start={startRec} stop={micStop} />
                  )}
                </form>
            )}
            </div>
          ) : (
            <form className="shrink-0 border-t border-secondary-foreground/15 p-3 flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); if (typed.trim() && !busy) send({ text: typed.trim() }); }}>
              <button type="button" aria-label={t.restart} title={t.restart} onClick={() => setConfirmRestart(true)}
                className="h-12 w-12 shrink-0 rounded-full border border-secondary-foreground/30 flex items-center justify-center text-secondary-foreground hover:bg-secondary-foreground/10 disabled:opacity-50"
                disabled={busy}>
                <RotateCcw className="h-5 w-5" />
              </button>
              {started && <MicButton busy={busy} onAudio={micHandler} t={t} recording={micOn} start={startRec} stop={micStop} />}
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.type} disabled={busy}
                className="flex-1 min-w-0 h-12 rounded-full bg-card text-card-foreground px-4 text-base outline-none focus:ring-2 focus:ring-primary" />
              <Button type="submit" size="icon" className="h-12 w-12 rounded-full shrink-0" disabled={busy || !typed.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          )}
        </section>

        <aside className="hidden lg:flex bg-card rounded-2xl border shadow-soft flex-col min-h-0">
          <div className="p-5 border-b flex items-baseline justify-between">
            <h2 className="text-lg font-bold">{t.cart}</h2>
            <span className="text-sm text-muted-foreground">{cartLabel}</span>
          </div>
          {cartBody}
        </aside>
      </main>

      {isMobile && (
        <Drawer open={cartOpen} onOpenChange={setCartOpen}>
          <DrawerContent className="h-[75dvh] flex flex-col">
            <div className="px-5 pt-2 pb-3 border-b flex items-start justify-between">
              <div>
                <DrawerTitle className="text-2xl font-black">{t.cart}</DrawerTitle>
                <p className="text-sm text-muted-foreground">{cartLabel}</p>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label={t.close} className="h-11 w-11 rounded-full bg-muted flex items-center justify-center"><X className="h-5 w-5" /></button>
            </div>
            <CommanderMobileScroll enabled className="flex-1 min-h-0 overflow-y-auto px-5">
              {!items.length && !missing.length && <p className="text-sm text-muted-foreground text-center py-10">{t.empty}</p>}
              {items.map((i) => (
                <div key={i.variantId} className="py-3 border-b">
                  {variantSelector(i)}
                </div>
              ))}
              {missing.length > 0 && (
                <div className="my-4 rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold flex items-center gap-2 text-destructive"><PackageX className="h-4 w-4" />{t.missing}</p>
                  <ul className="space-y-1 mt-1">
                    {missing.map((m, idx) => (
                      <li key={idx} className="text-sm flex justify-between items-center gap-2">
                        <span>{m.quantity} × {m.name}</span>
                        <button onClick={() => setMissing((p) => p.filter((_, j) => j !== idx))} className="text-muted-foreground hover:text-destructive p-2"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CommanderMobileScroll>
            {removalNotice}
            <div className="border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Info className="h-4 w-4" />{t.priceNote}</p>
              <Button size="lg" variant="secondary" className="w-full h-14 rounded-2xl text-base font-bold" onClick={() => setCartOpen(false)}>{t.backChat}</Button>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
