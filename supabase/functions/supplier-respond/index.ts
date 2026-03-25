import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignment_id") ||
      (req.method === "POST" ? (await req.json()).assignment_id : null);
    const action = url.searchParams.get("action") || "confirm";

    if (!assignmentId) {
      return jsonResponse({ error: "Missing assignment_id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const APP_URL = Deno.env.get("APP_URL") || "https://renocart.ca";

    // Find the supplier_response for this assignment
    const { data: response, error: respErr } = await supabase
      .from("supplier_responses")
      .select("id, status, assignment_id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (respErr || !response) {
      return jsonResponse({ error: "Assignment not found" }, 404);
    }

    // === UNDO action ===
    if (action === "undo") {
      if (response.status !== "confirmed" && response.status !== "needs_modification") {
        return jsonResponse({ success: true, message: "Already reset" });
      }

      await supabase
        .from("supplier_responses")
        .update({
          status: "pending",
          can_deliver_date: null,
          can_deliver_time: null,
          can_deliver_truck: null,
          responded_at: null,
          confirmed_at: null,
        })
        .eq("id", response.id);

      const { data: assignment } = await supabase
        .from("supplier_assignments")
        .select("order_id")
        .eq("id", assignmentId)
        .single();

      if (assignment) {
        await supabase
          .from("orders")
          .update({ status: "assigned", updated_at: new Date().toISOString() })
          .eq("id", assignment.order_id);
      }

      return jsonResponse({ success: true, message: "Action undone" });
    }

    // === Already confirmed — redirect to status page ===
    if (response.status === "confirmed") {
      return redirect(`${APP_URL}/supplier/respond?assignment_id=${assignmentId}&status=already_confirmed`);
    }

    const now = new Date().toISOString();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    if (action === "confirm") {
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

      const { data: assignment } = await supabase
        .from("supplier_assignments")
        .select("order_id")
        .eq("id", assignmentId)
        .single();

      if (assignment) {
        await supabase
          .from("orders")
          .update({ status: "confirmed", updated_at: now })
          .eq("id", assignment.order_id);

        const { data: order } = await supabase
          .from("orders")
          .select("order_number")
          .eq("id", assignment.order_id)
          .single();

        await supabase.from("notifications").insert({
          type: "supplier_confirmed",
          title: `✅ Confirmé — ${order?.order_number}`,
          message: `Le fournisseur a confirmé la commande ${order?.order_number}.`,
          order_id: assignment.order_id,
          is_read: false,
        });
      }

      return redirect(`${APP_URL}/supplier/respond?assignment_id=${assignmentId}&action=confirm`);
    }

    if (action === "modify") {
      await supabase
        .from("supplier_responses")
        .update({
          status: "needs_modification",
          responded_at: now,
        })
        .eq("id", response.id);

      const { data: assignment } = await supabase
        .from("supplier_assignments")
        .select("order_id")
        .eq("id", assignmentId)
        .single();

      if (assignment) {
        await supabase
          .from("orders")
          .update({ status: "needs_modification", updated_at: now })
          .eq("id", assignment.order_id);

        const { data: order } = await supabase
          .from("orders")
          .select("order_number")
          .eq("id", assignment.order_id)
          .single();

        await supabase.from("notifications").insert({
          type: "supplier_needs_modification",
          title: `✏️ Modification demandée — ${order?.order_number}`,
          message: `Le fournisseur demande une modification pour la commande ${order?.order_number}.`,
          order_id: assignment.order_id,
          is_read: false,
        });
      }

      return redirect(`${APP_URL}/supplier/respond?assignment_id=${assignmentId}&action=modify`);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("supplier-respond error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, "Location": url },
  });
}
