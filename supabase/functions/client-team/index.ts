import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRawEmail, sendGmailMessage } from "../_shared/gmail.ts";

// Client sub-account invitations. Permission checks live in the invite_client_member SQL function,
// called with the caller's own token; this function only adds the invitation email.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const ROLE: Record<string, string> = { super_admin: "Super admin", project_manager: "Gestionnaire de projets", employee: "Employé" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Connecte-toi d'abord." }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.slice(7));
    if (!u?.user) return json({ error: "Connecte-toi d'abord." }, 401);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "");
    const { error } = await userClient.rpc("invite_client_member", { _email: email, _role: role });
    if (error) return json({ error: error.message }, 400);

    const appUrl = Deno.env.get("APP_URL") ?? "https://renocart-flow.lovable.app";
    const inviter = u.user.user_metadata?.full_name || u.user.email;
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1b2536">
      <h2>Invitation RenoCart</h2>
      <p>${esc(String(inviter))} t'invite à rejoindre son compte RenoCart comme <b>${ROLE[role]}</b>.</p>
      <p>Crée ton compte (ou connecte-toi avec Google) avec l'adresse <b>${esc(email)}</b> pour accéder aux projets.</p>
      <p><a href="${appUrl}/projets" style="background:#F0AE2B;color:#1b2536;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Rejoindre le compte</a></p></div>`;
    let emailed = true;
    try { await sendGmailMessage(createRawEmail(email, "Invitation à rejoindre un compte RenoCart", html, { html: true })); }
    catch (e) { console.error("invite email failed", e); emailed = false; }
    return json({ ok: true, emailed });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
