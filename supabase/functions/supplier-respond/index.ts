import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);

    // GET = validate token and return order details
    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenData, error: tokenErr } = await supabase
        .from("supplier_response_tokens")
        .select("*, supplier_assignments(*, orders(*), supplier_responses(*))")
        .eq("token", token)
        .maybeSingle();

      if (tokenErr || !tokenData) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tokenData.used_at) {
        return new Response(JSON.stringify({ error: "Token already used", already_responded: true }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Token expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assignment = tokenData.supplier_assignments as any;
      const order = assignment.orders;

      // Fetch order items
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id)
        .order("sort_order");

      return new Response(JSON.stringify({
        order: {
          id: order.id,
          order_number: order.order_number,
          client_address: order.client_address,
          delivery_date: order.delivery_date,
          delivery_time_window: order.delivery_time_window,
          truck_type: order.truck_type,
          internal_notes: order.internal_notes,
        },
        items: items || [],
        assignment_id: assignment.id,
        response_id: (assignment.supplier_responses as any)?.[0]?.id || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST = submit response
    if (req.method === "POST") {
      const body = await req.json();
      const { token, action, can_deliver_date, can_deliver_time, can_deliver_truck,
        alternative_date, alternative_time, alternative_truck,
        supplier_general_note, item_responses } = body;

      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate token
      const { data: tokenData, error: tokenErr } = await supabase
        .from("supplier_response_tokens")
        .select("*, supplier_assignments(id, order_id, supplier_responses(id))")
        .eq("token", token)
        .maybeSingle();

      if (tokenErr || !tokenData) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tokenData.used_at) {
        return new Response(JSON.stringify({ error: "Already responded" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Token expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assignment = tokenData.supplier_assignments as any;
      const responseId = assignment.supplier_responses?.[0]?.id;

      if (!responseId) {
        return new Response(JSON.stringify({ error: "No response record found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();

      // action = "confirm_all" or "modify"
      if (action === "confirm_all") {
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
          .eq("id", responseId);
      } else {
        // "modify" — save partial response
        await supabase
          .from("supplier_responses")
          .update({
            status: "modified",
            can_deliver_date: can_deliver_date ?? null,
            can_deliver_time: can_deliver_time ?? null,
            can_deliver_truck: can_deliver_truck ?? null,
            alternative_date: alternative_date ?? null,
            alternative_time: alternative_time ?? null,
            alternative_truck: alternative_truck ?? null,
            supplier_general_note: supplier_general_note ?? null,
            responded_at: now,
          })
          .eq("id", responseId);

        // Save item-level responses
        if (item_responses && Array.isArray(item_responses)) {
          for (const ir of item_responses) {
            await supabase.from("item_responses").upsert({
              response_id: responseId,
              item_id: ir.item_id,
              can_fulfill: ir.can_fulfill ?? true,
              supplier_note: ir.supplier_note ?? null,
            }, { onConflict: "response_id,item_id" });
          }
        }
      }

      // Mark token as used
      await supabase
        .from("supplier_response_tokens")
        .update({ used_at: now })
        .eq("id", tokenData.id);

      // Update order status
      await supabase
        .from("orders")
        .update({
          status: action === "confirm_all" ? "confirmed" : "modified",
          updated_at: now,
        })
        .eq("id", assignment.order_id);

      // Send notification to RenoCart admin
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", assignment.order_id)
        .single();

      await supabase.from("notifications").insert({
        type: action === "confirm_all" ? "supplier_confirmed" : "supplier_modified",
        title: action === "confirm_all"
          ? `Confirmé — ${order?.order_number}`
          : `Modifié — ${order?.order_number}`,
        message: action === "confirm_all"
          ? `Le fournisseur a confirmé la commande ${order?.order_number}.`
          : `Le fournisseur a modifié sa réponse pour la commande ${order?.order_number}.`,
        order_id: assignment.order_id,
        is_read: false,
      });

      return new Response(JSON.stringify({ success: true, action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error("supplier-respond error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
