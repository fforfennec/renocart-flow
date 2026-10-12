import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRawEmail, sendGmailMessage } from "../_shared/gmail.ts";

const ADMIN_EMAIL = "admin@renocart.ca";
const ROLE_LABEL: Record<string, string> = { admin: "Admin", supplier: "Fournisseur", partner: "Partenaire RenoCart" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Public: notify admin of a new pending request (idempotent, only emails admin).
    if (action === "notify") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email || email.length > 255) return json({ error: "email requis" }, 400);
      const { data: row } = await admin.from("staff_accounts").select("*")
        .ilike("email", email).eq("status", "pending").eq("admin_notified", false).maybeSingle();
      if (!row) return json({ ok: true });
      const appUrl = Deno.env.get("APP_URL") ?? "https://renocart-flow.lovable.app";
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1b2536">
        <h2>Nouvelle demande d'accès RenoCart</h2>
        <p><b>Nom :</b> ${esc(row.full_name ?? "—")}<br/><b>Courriel :</b> ${esc(row.email)}<br/>
        <b>Compagnie :</b> ${esc(row.company_name ?? "—")}<br/><b>Type demandé :</b> ${ROLE_LABEL[row.requested_role] ?? row.requested_role}</p>
        <p><a href="${appUrl}/admin/utilisateurs" style="background:#F0AE2B;color:#1b2536;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Approuver ou refuser</a></p></div>`;
      await sendGmailMessage(createRawEmail(ADMIN_EMAIL, `Demande d'accès : ${row.full_name ?? row.email}`, html, { html: true }));
      await admin.from("staff_accounts").update({ admin_notified: true }).eq("user_id", row.user_id);
      return json({ ok: true });
    }

    // Everything else: admin only.
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "non connecté" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "accès refusé" }, 403);

    if (action === "list") {
      const [{ data: rows }, { data: suppliers }] = await Promise.all([
        admin.from("staff_accounts").select("*").order("created_at", { ascending: false }),
        admin.from("suppliers").select("id,name").order("name"),
      ]);
      return json({ users: rows ?? [], suppliers: suppliers ?? [] });
    }

    const userId = String(body.user_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "user_id invalide" }, 400);
    if (userId === u.user.id && action !== "approve") return json({ error: "Tu ne peux pas modifier ton propre compte." }, 400);

    if (action === "approve") {
      const role = String(body.role ?? "");
      if (!["admin", "supplier", "partner"].includes(role)) return json({ error: "rôle invalide" }, 400);
      const supplierId = body.supplier_company_id ? String(body.supplier_company_id) : null;
      let companyName: string | null = null;
      if (supplierId) {
        const { data: s } = await admin.from("suppliers").select("name").eq("id", supplierId).maybeSingle();
        companyName = s?.name ?? null;
      }
      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (rErr) throw rErr;
      if (companyName) await admin.from("profiles").update({ company_name: companyName }).eq("user_id", userId);
      await admin.auth.admin.updateUserById(userId, { ban_duration: "none", email_confirm: true });
      await admin.from("staff_accounts").update({ status: "active", requested_role: role, supplier_company_id: supplierId, decided_at: new Date().toISOString() }).eq("user_id", userId);
      return json({ ok: true });
    }
    if (action === "suspend" || action === "refuse") {
      await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (action === "refuse") await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("staff_accounts").update({ status: action === "suspend" ? "suspended" : "refused", decided_at: new Date().toISOString() }).eq("user_id", userId);
      return json({ ok: true });
    }
    if (action === "reactivate") {
      await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      await admin.from("staff_accounts").update({ status: "active", decided_at: new Date().toISOString() }).eq("user_id", userId);
      return json({ ok: true });
    }
    if (action === "delete") {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("staff_accounts").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    console.error("staff-access error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
