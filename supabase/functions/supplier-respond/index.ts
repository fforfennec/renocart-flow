import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple public edge function: accepts assignment_id, confirms the order.
// No auth required — the assignment_id itself acts as the token.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Support both GET (email click) and POST
    const assignmentId = url.searchParams.get("assignment_id") ||
      (req.method === "POST" ? (await req.json()).assignment_id : null);

    if (!assignmentId) {
      return new Response(JSON.stringify({ error: "Missing assignment_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the supplier_response for this assignment
    const { data: response, error: respErr } = await supabase
      .from("supplier_responses")
      .select("id, status, assignment_id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (respErr || !response) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response.status === "confirmed") {
      // Already confirmed — show success page anyway
      return new Response(redirectHtml("Déjà confirmé", "Cette commande a déjà été confirmée. Merci !"), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const now = new Date().toISOString();

    // Mark as confirmed
    await supabase
      .from("supplier_responses")
      .update({
        status: "confirmed",
        can_deliver_date: true,
        can_deliver_time: true,
        can_deliver_truck: true,
        responded_at: now,
        confirmed_at: now,
      })
      .eq("id", response.id);

    // Get order info for notification
    const { data: assignment } = await supabase
      .from("supplier_assignments")
      .select("order_id")
      .eq("id", assignmentId)
      .single();

    if (assignment) {
      // Update order status
      await supabase
        .from("orders")
        .update({ status: "confirmed", updated_at: now })
        .eq("id", assignment.order_id);

      // Get order number for notification
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", assignment.order_id)
        .single();

      // Create notification for admin
      await supabase.from("notifications").insert({
        type: "supplier_confirmed",
        title: `✅ Confirmé — ${order?.order_number}`,
        message: `Le fournisseur a confirmé la commande ${order?.order_number}.`,
        order_id: assignment.order_id,
        is_read: false,
      });
    }

    // Return a simple HTML confirmation page
    return new Response(redirectHtml("Commande confirmée !", "Merci ! L'équipe RenoCart a été notifiée. Vous pouvez fermer cette page."), {
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("supplier-respond error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function redirectHtml(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
  <div style="text-align:center;max-width:400px;padding:40px;">
    <div style="font-size:48px;margin-bottom:16px;">✅</div>
    <h1 style="font-size:24px;color:#1a2e44;margin:0 0 12px;">${title}</h1>
    <p style="color:#6b7280;font-size:16px;line-height:1.5;">${message}</p>
  </div>
</body>
</html>`;
}
