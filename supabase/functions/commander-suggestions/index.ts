import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const shop = "e5ec80-69.myshopify.com";
const gid = z.string().regex(/^gid:\/\/shopify\/(Product|ProductVariant)\/\d+$/);
const qty = z.number().positive().max(10000).refine((n) => Math.round(n * 1000) === n * 1000, "3 décimales max");
const ruleSchema = z.object({
  id: z.string().uuid().optional(), trigger_kind: z.enum(["product", "product_type", "variant"]),
  trigger_values: z.array(z.string().trim().min(1).max(255)).min(1).max(30), variant_id: gid,
  suggested_qty: qty, trigger_qty: qty, priority: z.number().int().min(1).max(1000),
  note: z.string().trim().max(1000).nullable().default(null),
  reason: z.string().trim().min(1).max(250), recommended: z.boolean(), active: z.boolean(),
});
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("catalog"), search: z.string().max(150).default("") }),
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("save"), rule: ruleSchema }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("evaluate"), cart: z.array(z.object({ variantId: gid, quantity: z.number().int().min(1).max(100000) })).max(100), include: z.array(gid).max(5).default([]) }),
  z.object({ action: z.literal("offer"), sessionId: z.string().uuid(), ruleIds: z.array(z.string().uuid()).max(30) }),
  z.object({ action: z.literal("accept"), sessionId: z.string().uuid(), ruleIds: z.array(z.string().uuid()).max(30) }),
]);
type Product = { id: string; title: string; productType: string; featuredImage: { url: string } | null; collections: { nodes: { title: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string } } };
type Variant = { id: string; title: string; availableForSale: boolean; image: { url: string } | null; price: { amount: string; currencyCode: string }; product: Product };
// Permanent ban: screws and nails are never suggested, whatever a rule says.
const banned = (value: string) => /(^|[^\p{L}\p{N}])(vis|screws?|clous?|nails?)(?=$|[^\p{L}\p{N}])/iu.test(value);
const rulesOf = (rows: any[]) => rows.map((r) => ({ ...r, trigger_values: r.trigger_values?.length ? r.trigger_values : [r.trigger_value], suggested_qty: Number(r.suggested_qty ?? r.suggested_units), trigger_qty: Number(r.trigger_qty ?? r.trigger_units) }));
async function storefront(query: string, variables: Record<string, unknown> = {}) {
  const token = Deno.env.get("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  if (!token) throw new Error("Connexion Shopify indisponible.");
  const response = await fetch(`https://${shop}/api/2025-07/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token }, body: JSON.stringify({ query, variables }) });
  if (!response.ok) throw new Error("Impossible de lire le catalogue Shopify.");
  const result = await response.json();
  if (result.errors) throw new Error("Impossible de lire le catalogue Shopify.");
  return result.data;
}
const productFields = `id title productType featuredImage { url } collections(first: 250) { nodes { title } pageInfo { hasNextPage endCursor } }`;
const variantFields = `id title availableForSale image { url } price { amount currencyCode } product { ${productFields} }`;
async function variants(ids: string[]): Promise<(Variant | null)[]> {
  if (!ids.length) return [];
  const out: (Variant | null)[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await storefront(`query($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { ${variantFields} } } }`, { ids: ids.slice(i, i + 100) });
    out.push(...data.nodes);
  }
  return out;
}
async function safeProduct(p: Product) {
  if (banned(p.title) || banned(p.productType)) return false;
  let connection = p.collections;
  while (connection) {
    if (connection.nodes.some((c) => banned(c.title))) return false;
    if (!connection.pageInfo.hasNextPage) return true;
    const data = await storefront(`query($id: ID!, $after: String) { node(id: $id) { ... on Product { collections(first: 250, after: $after) { nodes { title } pageInfo { hasNextPage endCursor } } } } }`, { id: p.id, after: connection.pageInfo.endCursor });
    connection = data.node?.collections;
  }
  return false;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non permise." }, 405);
  try {
    const input = schema.safeParse(await req.json());
    if (!input.success) return json({ error: "Données invalides." }, 400);
    const body = input.data;
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    if (["catalog", "list", "save", "delete"].includes(body.action)) {
      const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!auth) return json({ error: "Connecte-toi pour gérer les règles." }, 401);
      const { data: userData, error } = await db.auth.getUser(auth);
      if (error || !userData.user) return json({ error: "Connecte-toi pour gérer les règles." }, 401);
      const role = await db.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
      if (role.error || !role.data) return json({ error: "Accès administrateur requis." }, 403);
    }
    if (body.action === "catalog") {
      const data = await storefront(`query($query: String) { products(first: 40, query: $query) { nodes { id title productType variants(first: 100) { nodes { id title availableForSale } } } } }`, { query: body.search || null });
      return json({ products: data.products.nodes });
    }
    if (body.action === "save") {
      const rule = body.rule;
      const [variant] = await variants([rule.variant_id]);
      if (!variant || !variant.availableForSale) return json({ error: "Cette variante Shopify n’est pas disponible." }, 400);
      if (!await safeProduct(variant.product) || banned(variant.title) || banned(rule.reason)) return json({ error: "Les vis et les clous ne sont jamais suggérés." }, 400);
      if (rule.trigger_kind !== "product_type") {
        const re = rule.trigger_kind === "product" ? /^gid:\/\/shopify\/Product\/\d+$/ : /^gid:\/\/shopify\/ProductVariant\/\d+$/;
        if (!rule.trigger_values.every((v) => re.test(v))) return json({ error: "Choisis le ou les déclencheurs." }, 400);
        const found = await storefront(`query($ids: [ID!]!) { nodes(ids: $ids) { id } }`, { ids: rule.trigger_values });
        if (found.nodes.some((n: { id?: string } | null) => !n?.id)) return json({ error: "Déclencheur introuvable dans Shopify." }, 400);
      }
      const { id, ...values } = rule;
      const row = { ...values, trigger_value: values.trigger_values[0], suggested_units: Math.max(1, Math.ceil(values.suggested_qty)), trigger_units: Math.max(1, Math.ceil(values.trigger_qty)) };
      const result = id ? await db.from("suggestion_rules").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).select().single() : await db.from("suggestion_rules").insert(row).select().single();
      if (result.error) throw result.error;
      return json({ rule: result.data });
    }
    if (body.action === "delete") {
      const result = await db.from("suggestion_rules").delete().eq("id", body.id);
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    if (body.action === "list") {
      const rules = await db.from("suggestion_rules").select("*").order("priority").order("created_at");
      const offers = await db.from("suggestion_offers").select("rule_id,accepted");
      if (rules.error || offers.error) throw rules.error || offers.error;
      const list = rulesOf(rules.data ?? []);
      const vs = await variants(list.map((r) => r.variant_id));
      return json({ rules: list.map((r, i) => ({ ...r, productTitle: vs[i]?.product.title ?? "Produit introuvable", variantTitle: vs[i]?.title ?? "", proposed: offers.data?.filter((o) => o.rule_id === r.id).length ?? 0, accepted: offers.data?.filter((o) => o.rule_id === r.id && o.accepted).length ?? 0 })) });
    }
    if (body.action === "offer") {
      const active = await db.from("suggestion_rules").select("id").in("id", body.ruleIds).eq("active", true);
      if (active.error) throw active.error;
      const rows = (active.data ?? []).map((r) => ({ session_id: body.sessionId, rule_id: r.id }));
      if (rows.length) {
        const result = await db.from("suggestion_offers").upsert(rows, { onConflict: "session_id,rule_id", ignoreDuplicates: true });
        if (result.error) throw result.error;
      }
      return json({ ok: true });
    }
    if (body.action === "accept") {
      const result = await db.from("suggestion_offers").update({ accepted: true }).eq("session_id", body.sessionId).in("rule_id", body.ruleIds);
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    const rules = await db.from("suggestion_rules").select("*").eq("active", true).order("recommended", { ascending: false }).order("created_at");
    if (rules.error) throw rules.error;
    const activeRules = rulesOf(rules.data ?? []);
    const cartVariants = await variants(body.cart.map((i) => i.variantId));
    const suggested = await variants(activeRules.map((r) => r.variant_id));
    const typeOf = (p?: Product) => (p?.productType ?? "").trim().toLocaleLowerCase();
    type Row = { ruleIds: string[]; variantId: string; productId: string; productTitle: string; variantTitle: string; image: string | null; price: string; currency: string; available: boolean; quantity: number; raw: number; triggerCount: number; reason: string; recommended: boolean; priority: number };
    const grouped = new Map<string, Row>();
    for (let i = 0; i < activeRules.length; i++) {
      const rule = activeRules[i], variant = suggested[i];
      if (!variant || !variant.availableForSale || banned(variant.title) || banned(rule.reason) || !await safeProduct(variant.product)) continue;
      if (!body.include.includes(variant.id)) {
        // Skip when the cart already has this product or any product of the same Shopify type.
        const t = typeOf(variant.product);
        if (cartVariants.some((v) => v && (v.product.id === variant.product.id || (t && typeOf(v.product) === t)))) continue;
      }
      const values = rule.trigger_values.map((v: string) => v.toLocaleLowerCase());
      const n = body.cart.reduce((sum, item, index) => {
        const v = cartVariants[index];
        if (!v) return sum;
        const hit = rule.trigger_kind === "variant" ? values.includes(v.id.toLocaleLowerCase())
          : rule.trigger_kind === "product" ? values.includes(v.product.id.toLocaleLowerCase())
          : values.includes(typeOf(v.product));
        return sum + (hit ? item.quantity : 0);
      }, 0);
      if (!n) continue;
      const raw = n * rule.suggested_qty / rule.trigger_qty;
      const reason = rule.reason.includes("{n}") ? rule.reason.replaceAll("{n}", String(n)) : `${rule.reason} · ${n}`;
      const prev = grouped.get(variant.product.id);
      if (prev) {
        // Same product suggested by several rules: one line, quantities added.
        prev.ruleIds.push(rule.id); prev.raw += raw; prev.recommended ||= rule.recommended;
        prev.priority = Math.min(prev.priority, rule.priority ?? 100); prev.triggerCount += n;
      } else grouped.set(variant.product.id, { ruleIds: [rule.id], variantId: variant.id, productId: variant.product.id, productTitle: variant.product.title, variantTitle: variant.title,
        image: variant.image?.url ?? variant.product.featuredImage?.url ?? null, price: variant.price.amount, currency: variant.price.currencyCode,
        available: true, quantity: 0, raw, triggerCount: n, reason, recommended: rule.recommended, priority: rule.priority ?? 100 });
    }
    const list = Array.from(grouped.values())
      .map(({ raw, ...s }) => ({ ...s, quantity: Math.max(1, Math.ceil(raw - 1e-9)) }))
      .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.priority - b.priority)
      .slice(0, 5);
    return json({ suggestions: list });
  } catch (error) {
    console.error("commander-suggestions:", error instanceof Error ? error.message : "request failed");
    return json({ error: "Les suggestions sont temporairement indisponibles." }, 500);
  }
});