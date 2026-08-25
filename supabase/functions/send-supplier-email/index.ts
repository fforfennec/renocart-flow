import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createRawEmail, sendGmailMessage } from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_id, supplier_id, content, broadcast = false } = body;

    if (!order_id || !content || (!supplier_id && !broadcast)) {
      return new Response(
        JSON.stringify({ error: "Missing order_id, content, or supplier_id/broadcast" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load admin profile for sender name
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("full_name, company_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const adminSenderName = adminProfile?.company_name || adminProfile?.full_name || "RenoCart";

    // Load order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("order_number")
      .eq("id", order_id)
      .single();
    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine recipients
    const recipients: { supplier_id: string; email: string; name: string }[] = [];

    if (broadcast) {
      const { data: assignments } = await supabase
        .from("supplier_assignments")
        .select("supplier_id")
        .eq("order_id", order_id);

      const supplierIds = [...new Set((assignments || []).map(a => a.supplier_id))];
      for (const sid of supplierIds) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, company_name")
          .eq("user_id", sid)
          .maybeSingle();
        const { data: userData } = await supabase.auth.admin.getUserById(sid);
        const email = userData?.user?.email;
        if (email) {
          recipients.push({
            supplier_id: sid,
            email,
            name: profile?.company_name || profile?.full_name || "Fournisseur",
          });
        }
      }
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, company_name")
        .eq("user_id", supplier_id)
        .maybeSingle();
      const { data: userData } = await supabase.auth.admin.getUserById(supplier_id);
      const email = userData?.user?.email;
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Supplier email not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      recipients.push({
        supplier_id,
        email,
        name: profile?.company_name || profile?.full_name || "Fournisseur",
      });
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = `Commande ${order.order_number} — ${broadcast ? "Message" : "Réponse"}`;

    for (const recipient of recipients) {
      const personalizedBody = broadcast
        ? `Bonjour ${recipient.name},\n\n${content}\n\n— RenoCart`
        : content;

      try {
        await sendGmailMessage(createRawEmail(recipient.email, subject, personalizedBody));
      } catch (err) {
        console.error(`Failed to send email to ${recipient.email}:`, err);
        continue;
      }

      // Insert message record
      await supabase.from("order_messages").insert({
        order_id,
        user_id: user.id,
        sender_name: adminSenderName,
        content,
        supplier_id: recipient.supplier_id,
        source: "app",
        is_broadcast: broadcast,
      });

      // Log event
      await supabase.from("order_events").insert({
        order_id,
        event_type: "email_sent",
        title: `📧 Réponse envoyée à ${recipient.name}`,
        description: `Destinataire: ${recipient.email}${broadcast ? " (à tous)" : ""}`,
        supplier_id: recipient.supplier_id,
        supplier_name: recipient.name,
        metadata: { kind: "chat_reply", recipient: recipient.email, broadcast },
      });
    }

    return new Response(
      JSON.stringify({ success: true, recipients: recipients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-supplier-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
