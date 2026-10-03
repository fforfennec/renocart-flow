// Public voice ordering: transcribes customer speech and maps it to Shopify products
// or to delivery details. Called from the public /commander page.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev";
const CHAT_MODEL = "openai/gpt-6-astra";
const STT_MODEL = "google/gemini-3.5-transcribe";
const SHOP = "e5ec80-69.myshopify.com";
const STOREFRONT_TOKEN = "220d62212479a424adc1837c2bc4f023"; // public storefront token

type Variant = { id: string; title: string; price: string; currency: string; available: boolean };
type Product = { id: string; title: string; handle: string; type: string; image: string | null; variants: Variant[] };

let catalogCache: { at: number; products: Product[] } | null = null;

async function loadCatalog(): Promise<Product[]> {
  if (catalogCache && Date.now() - catalogCache.at < 10 * 60_000) return catalogCache.products;
  const products: Product[] = [];
  let after: string | null = null;
  for (let page = 0; page < 8; page++) {
    const res = await fetch(`https://${SHOP}/api/2025-07/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN },
      body: JSON.stringify({
        query: `query($after:String){products(first:250, after:$after){pageInfo{hasNextPage endCursor}
          edges{node{id title handle productType featuredImage{url}
          variants(first:5){edges{node{id title availableForSale price{amount currencyCode}}}}}}}}`,
        variables: { after },
      }),
    });
    const json = await res.json();
    const data = json?.data?.products;
    if (!data) break;
    for (const e of data.edges) {
      const n = e.node;
      products.push({
        id: n.id, title: n.title, handle: n.handle, type: n.productType || "",
        image: n.featuredImage?.url ?? null,
        variants: n.variants.edges.map((v: any) => ({
          id: v.node.id, title: v.node.title, price: v.node.price.amount,
          currency: v.node.price.currencyCode, available: v.node.availableForSale,
        })),
      });
    }
    if (!data.pageInfo.hasNextPage) break;
    after = data.pageInfo.endCursor;
  }
  catalogCache = { at: Date.now(), products };
  return products;
}

class GatewayError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function readSSE(res: Response, onEvent: (ev: any) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try { onEvent(JSON.parse(d)); } catch { /* ignore */ }
      }
    }
  }
}

async function transcribe(file: File, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new File([file], "voice.webm", { type: file.type.startsWith("audio/") ? file.type : "audio/webm" }));
  form.append("response_format", "json");
  form.append("stream", "true");
  const res = await fetch(`${GATEWAY}/v1/audio/transcriptions`, {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  });
  if (!res.ok) throw new GatewayError(res.status, await safeMsg(res));
  let text = "";
  let final: string | null = null;
  await readSSE(res, (ev) => {
    if (ev.type === "transcript.text.delta") text += ev.delta ?? "";
    if (ev.type === "transcript.text.done") final = ev.text ?? text;
  });
  return (final ?? text).trim();
}

async function safeMsg(res: Response) {
  const t = await res.text();
  try { const j = JSON.parse(t); return j?.error?.message || j?.message || t; } catch { return t || `HTTP ${res.status}`; }
}

async function structured(apiKey: string, system: string, user: string, name: string, schema: object) {
  const res = await fetch(`${GATEWAY}/v1/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_schema", name, schema, strict: true } },
    }),
  });
  if (!res.ok) throw new GatewayError(res.status, await safeMsg(res));
  let out = "";
  let failed: string | null = null;
  await readSSE(res, (ev) => {
    if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
    if (ev.type === "response.failed" || ev.type === "error") failed = ev?.response?.error?.message || ev?.message || "AI error";
  });
  if (failed) throw new GatewayError(502, failed);
  if (!out.trim()) throw new GatewayError(502, "Empty AI response");
  return JSON.parse(out);
}

const cartSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "unavailable"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["ref", "quantity", "said"],
        properties: {
          ref: { type: "integer", description: "Catalog line number" },
          quantity: { type: "integer" },
          said: { type: "string" },
        },
      },
    },
    unavailable: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["name", "quantity"],
        properties: { name: { type: "string" }, quantity: { type: "integer" } },
      },
    },
  },
};

const detailsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["delivery_date", "time_window", "truck_type", "note"],
  properties: {
    delivery_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    time_window: { type: ["string", "null"], enum: ["AM", "PM", "Early", "Day", null] },
    truck_type: { type: ["string", "null"], enum: ["Boom", "Boom 90ft", "Van/Cube", "Hiab", "Other", "unknown", null] },
    note: { type: ["string", "null"] },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI not configured" }, 500);

    const ct = req.headers.get("content-type") || "";
    const form = !ct.includes("multipart")
      ? (() => { const f = new FormData(); return f; })()
      : await req.formData();
    if (!ct.includes("multipart")) {
      const b = await req.json();
      for (const [k, v] of Object.entries(b)) form.append(k, String(v));
    }
    const mode = String(form.get("mode") || "cart");
    const lang = String(form.get("lang") || "fr");
    const audio = form.get("audio");
    let text = String(form.get("text") || "").trim();

    if (audio instanceof File && audio.size > 0) {
      if (audio.size > 10 * 1024 * 1024) return json({ error: "Enregistrement trop long" }, 400);
      text = await transcribe(audio, apiKey);
    }
    if (!text) return json({ error: lang === "en" ? "We didn't hear anything. Try again." : "On n'a rien entendu. Réessaie." }, 400);

    if (mode === "details") {
      const today = new Date().toISOString().slice(0, 10);
      const r = await structured(
        apiKey,
        `Today is ${today} (America/Toronto). Extract delivery details from a construction-materials customer's answer (French or English, Québec). ` +
          `time_window: AM = before noon, PM = afternoon, Early = before 10am, Day = anytime. ` +
          `truck_type: Boom (boom truck / camion girafe), Boom 90ft, Van/Cube (cube / fourgon), Hiab (grue), Other; "unknown" if the customer says they don't know. ` +
          `Resolve relative dates ("demain", "next Tuesday") to YYYY-MM-DD. Use null for anything not mentioned. note: any other delivery instruction, else null.`,
        text, "delivery_details", detailsSchema,
      );
      return json({ transcript: text, details: r });
    }

    const catalog = await loadCatalog();
    const lines: { product: Product; variant: Variant }[] = [];
    for (const p of catalog) for (const v of p.variants) lines.push({ product: p, variant: v });
    const listing = lines
      .map((l, i) => `${i}|${l.product.title}${l.variant.title !== "Default Title" ? ` — ${l.variant.title}` : ""}|${l.product.type}|${l.variant.price}$`)
      .join("\n");

    const r = await structured(
      apiKey,
      `You build a shopping cart for a Québec construction materials store from what a customer said (French or English). ` +
        `Match each requested item to the single best catalog line (by number). Respect dimensions, thickness, R-values and pack sizes. ` +
        `Default quantity 1 if unspecified. If nothing in the catalog reasonably matches, put it in "unavailable" with the customer's wording. ` +
        `Never invent catalog lines.\n\nCATALOG (ref|title|type|price):\n${listing}`,
      text, "cart", cartSchema,
    );

    const items = (r.items || [])
      .filter((it: any) => lines[it.ref])
      .map((it: any) => {
        const l = lines[it.ref];
        return {
          variantId: l.variant.id,
          productTitle: l.product.title,
          variantTitle: l.variant.title,
          handle: l.product.handle,
          image: l.product.image,
          price: l.variant.price,
          currency: l.variant.currency,
          available: l.variant.available,
          quantity: Math.max(1, it.quantity || 1),
          said: it.said,
        };
      });
    return json({ transcript: text, items, unavailable: r.unavailable || [] });
  } catch (e) {
    console.error("voice-order error", e);
    if (e instanceof GatewayError) {
      const status = [400, 402, 403, 404, 429].includes(e.status) ? e.status : 502;
      return json({ error: e.message }, status);
    }
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 500);
  }
});
