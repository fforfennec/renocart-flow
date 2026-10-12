import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { emailSupportReply } from "../_shared/clientSupport.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Staff reply to a client support thread: stores the message and emails a copy to the client.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const threadId = typeof body.thread_id === "string" ? body.thread_id : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(threadId) || !content || content.length > 5000) return json({ error: "Requête invalide" }, 400);

    const { data: thread } = await admin.from("support_threads").select("*").eq("id", threadId).maybeSingle();
    if (!thread) return json({ error: "Discussion introuvable" }, 404);
    const { data: prof } = await admin.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const senderName = prof?.full_name || "RenoCart";

    await admin.from("support_messages").insert({ thread_id: threadId, author_user_id: user.id, sender_name: senderName, sender_role: "staff", source: "web", content });
    await admin.from("support_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);

    let emailed = false;
    try { await emailSupportReply(admin, thread, content, senderName); emailed = !!thread.customer_email; }
    catch (e) { console.error("support email failed:", e); }
    return json({ success: true, emailed });
  } catch (e) {
    console.error("support-reply error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 500);
  }
});
