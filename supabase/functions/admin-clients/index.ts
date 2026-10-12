import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const invoiceFields = "id,order_number,created_at,client_name,client_address,status,project_id,project_name,project_code,subtotal_price,total_tax,shipping_price_total,total_price,currency,order_items(id,name,variant_title,sku,quantity,unit_price)";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Configuration indisponible" }, 500);
  const db = createClient(url, key);
  try {
    const { data: session, error: authError } = await db.auth.getUser((req.headers.get("Authorization") ?? "").replace(/^Bearer /, ""));
    if (authError || !session.user) return json({ error: "Connexion requise" }, 401);
    const [{ data: role }, { data: staff }] = await Promise.all([
      db.rpc("has_role", { _user_id: session.user.id, _role: "admin" }),
      db.from("staff_accounts").select("status").eq("user_id", session.user.id).maybeSingle(),
    ]);
    if (!role || staff?.status !== "active") return json({ error: "Accès administrateur requis" }, 403);
    const body = await req.json();
    if (body.action === "list") {
      const users = [];
      for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) break;
      }
      const [{ data: profiles, error: pe }, { data: staffRows, error: se }, { data: projects, error: pre }, { data: orders, error: oe }] = await Promise.all([
        db.from("profiles").select("user_id,full_name,company_name,phone"),
        db.from("staff_accounts").select("user_id"),
        db.from("client_projects").select("owner_id"),
        db.from("orders").select("customer_email,total_price"),
      ]);
      if (pe || se || pre || oe) throw pe || se || pre || oe;
      const clients = users.filter((u) => !staffRows?.some((s) => s.user_id === u.id) || projects?.some((p) => p.owner_id === u.id) || orders?.some((o) => o.customer_email?.toLowerCase() === u.email?.toLowerCase()));
      return json({ clients: clients.map((u) => {
        const profile = profiles?.find((p) => p.user_id === u.id);
        const ownOrders = orders?.filter((o) => o.customer_email?.toLowerCase() === u.email?.toLowerCase()) ?? [];
        return { id: u.id, email: u.email ?? "", name: profile?.full_name || u.user_metadata.full_name || u.user_metadata.name || u.email, company: profile?.company_name ?? "", phone: profile?.phone ?? "", created_at: u.created_at, projects: projects?.filter((p) => p.owner_id === u.id).length ?? 0, orders: ownOrders.length, spent: ownOrders.reduce((sum, o) => sum + (o.total_price ?? 0), 0) };
      }) });
    }
    const clientId = String(body.client_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return json({ error: "Client invalide" }, 400);
    const { data: client, error: ce } = await db.auth.admin.getUserById(clientId);
    if (ce || !client.user?.email) return json({ error: "Client introuvable" }, 404);
    const email = client.user.email;
    if (body.action === "detail") {
      const [{ data: projects, error: pe }, { data: orders, error: oe }] = await Promise.all([
        db.from("client_projects").select("*").eq("owner_id", clientId).order("created_at", { ascending: false }),
        db.from("orders").select(invoiceFields).ilike("customer_email", email).order("created_at", { ascending: false }),
      ]);
      if (pe || oe) throw pe || oe;
      return json({ projects, orders });
    }
    if (body.action === "save_project") {
      const input = body.input ?? {};
      const values: Record<string, string | null> = {};
      for (const field of ["name", "code", "address1", "city", "province", "postal_code", "contact_name", "contact_phone", "notes"]) values[field] = typeof input[field] === "string" ? input[field].trim().slice(0, field === "notes" ? 5000 : 255) || null : null;
      if (!values.name || !values.code) return json({ error: "Nom et code requis" }, 400);
      const q = body.project_id ? db.from("client_projects").update(values).eq("id", body.project_id).eq("owner_id", clientId) : db.from("client_projects").insert({ ...values, owner_id: clientId });
      const { data, error } = await q.select().single();
      if (error) throw error;
      return json({ project: data });
    }
    if (body.action === "assign") {
      const { data: order, error: oe } = await db.from("orders").select("id,customer_email").eq("id", body.order_id).single();
      if (oe || order.customer_email?.toLowerCase() !== email.toLowerCase()) return json({ error: "Commande introuvable pour ce client" }, 400);
      let project = null;
      if (body.project_id) {
        const { data, error } = await db.from("client_projects").select("id,name,code").eq("id", body.project_id).eq("owner_id", clientId).single();
        if (error) return json({ error: "Projet introuvable pour ce client" }, 400);
        project = data;
      }
      const { error } = await db.from("orders").update({ project_id: project?.id ?? null, project_name: project?.name ?? null, project_code: project?.code ?? null }).eq("id", order.id);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : "Erreur de gestion client" }, 500); }
});