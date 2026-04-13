import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RENOCART_EMAIL = "commande@renocart.ca";
const ESCALATION_MINUTES = 35;
const INITIAL_HOLD_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  try {
    // Check if automations are paused
    const { data: pauseSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "automations_paused")
      .single();

    if (pauseSetting?.value === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "Automations paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- INITIAL DISPATCH: orders older than 5 min with no assignments ---
    const holdCutoff = new Date(Date.now() - INITIAL_HOLD_MINUTES * 60 * 1000).toISOString();
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("id, order_number, automation_paused")
      .eq("status", "pending")
      .eq("automation_paused", false)
      .lt("created_at", holdCutoff);

    let initialDispatched = 0;
    for (const order of pendingOrders || []) {
      // Check if already has assignments
      const { count } = await supabase
        .from("supplier_assignments")
        .select("id", { count: "exact", head: true })
        .eq("order_id", order.id);
      if ((count || 0) > 0) continue;

      // Get priority 1 supplier
      const { data: prioritySupplier } = await supabase
        .from("supplier_priority")
        .select("*")
        .eq("is_active", true)
        .eq("priority_order", 1)
        .maybeSingle();

      if (prioritySupplier) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        await fetch(`${supabaseUrl}/functions/v1/dispatch-order`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_id: order.id,
            supplier_email: prioritySupplier.email,
            supplier_name: prioritySupplier.name,
            priority_rank: prioritySupplier.priority_order,
          }),
        });
        console.log(`Initial dispatch: ${order.order_number} → ${prioritySupplier.name}`);
        initialDispatched++;
      }
    }

    // --- ESCALATION: existing assignments older than 35 min ---
    const cutoff = new Date(Date.now() - ESCALATION_MINUTES * 60 * 1000).toISOString();

    // Find assignments older than 35 min still pending, not yet escalated
    const { data: lateAssignments, error } = await supabase
      .from("supplier_assignments")
      .select(`
        id,
        assigned_at,
        order_id,
        supplier_id,
        priority_rank,
        orders (order_number, client_address, delivery_date, delivery_time_window, truck_type, internal_notes, automation_paused),
        supplier_responses (status, escalated_at)
      `)
      .lt("assigned_at", cutoff)
      .filter("supplier_responses.status", "eq", "pending");

    if (error) throw error;

    const toEscalate = (lateAssignments || []).filter(a => {
      const order = (a as any).orders;
      if (order?.automation_paused) return false; // Skip orders with paused automation
      const responses = (a as any).supplier_responses || [];
      const pending = responses.find((r: any) => r.status === "pending");
      return pending && !pending.escalated_at;
    });

    console.log(`Found ${toEscalate.length} assignments to escalate`);

    for (const assignment of toEscalate) {
      const order = (assignment as any).orders;
      const currentRank = assignment.priority_rank || 1;

      // Mark current assignment as escalated
      await supabase
        .from("supplier_responses")
        .update({ escalated_at: new Date().toISOString(), status: "expired" })
        .eq("assignment_id", assignment.id);

      // Expire any unused tokens for this assignment
      await supabase
        .from("supplier_response_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("assignment_id", assignment.id)
        .is("used_at", null);

      // Find the next supplier in priority list
      const { data: nextSupplier } = await supabase
        .from("supplier_priority")
        .select("*")
        .eq("is_active", true)
        .gt("priority_order", currentRank)
        .order("priority_order")
        .limit(1)
        .maybeSingle();

      if (nextSupplier) {
        console.log(`Escalating order ${order.order_number} to ${nextSupplier.name} (priority ${nextSupplier.priority_order})`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        await fetch(`${supabaseUrl}/functions/v1/dispatch-order`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_id: assignment.order_id,
            supplier_email: nextSupplier.email,
            supplier_name: nextSupplier.name,
            priority_rank: nextSupplier.priority_order,
          }),
        });

        await supabase.from("notifications").insert({
          type: "escalation",
          title: `Escalade — ${order.order_number}`,
          message: `Pas de réponse du fournisseur précédent. Commande envoyée à ${nextSupplier.name}.`,
          order_id: assignment.order_id,
          is_read: false,
        });
      } else {
        // No more suppliers — notify admin urgently
        await supabase.from("notifications").insert({
          type: "escalation_final",
          title: `⚠️ Aucun fournisseur — ${order.order_number}`,
          message: `Tous les fournisseurs ont été contactés sans réponse pour la commande ${order.order_number}.`,
          order_id: assignment.order_id,
          is_read: false,
        });

        // Email alert to RenoCart
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "RenoCart Alerts <commande@renocart.ca>",
            to: [RENOCART_EMAIL],
            subject: `⚠️ Aucun fournisseur disponible — ${order.order_number}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
                <div style="background:#7f1d1d;padding:24px 32px;border-radius:8px 8px 0 0;">
                  <h1 style="color:#fff;margin:0;font-size:20px;">⚠️ Alerte — Aucun fournisseur</h1>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px;">
                  <p style="font-size:16px;margin:0 0 16px;">
                    Tous les fournisseurs ont été contactés sans réponse pour la commande 
                    <strong>${order.order_number}</strong>.
                  </p>
                  <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Adresse de livraison</p>
                    <p style="margin:0;font-weight:600;">${order.client_address}</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Date : ${new Date(order.delivery_date).toLocaleDateString('fr-CA')}</p>
                  </div>
                  <p style="font-size:14px;color:#6b7280;">Connectez-vous au portail admin pour prendre les mesures nécessaires.</p>
                </div>
              </div>
            `,
          }),
        });
      }

      console.log(`Escalated assignment ${assignment.id} for order ${order.order_number}`);
    }

    return new Response(
      JSON.stringify({ success: true, initialDispatched, escalated: toEscalate.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("escalation-check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
