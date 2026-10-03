import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { dispatchToNextSupplier } from "../_shared/escalate.ts";

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PostSchema = z.object({
  assignment_id: z.string().uuid(),
  action: z.enum(["accept", "decline", "modify"]),
  note: z.string().max(2000).optional().nullable(),
  alternative_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  alternative_time: z.string().max(50).optional().nullable(),
  alternative_truck: z.string().max(50).optional().nullable(),
  items: z.array(z.object({ item_id: z.string().uuid(), quantity: z.number().int().min(0) })).max(500).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const loadContext = async (assignmentId: string) => {
    const { data: assignment } = await supabase
      .from("supplier_assignments")
      .select("id, order_id, supplier_id, priority_rank, assignment_type")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment) return null;
    const [{ data: order }, { data: profile }, { data: response }, { data: items }] = await Promise.all([
      supabase.from("orders").select("id, order_number, client_address, delivery_date, delivery_time_window, truck_type, status").eq("id", assignment.order_id).single(),
      supabase.from("profiles").select("full_name, company_name").eq("user_id", assignment.supplier_id).maybeSingle(),
      supabase.from("supplier_responses").select("id, status").eq("assignment_id", assignmentId).maybeSingle(),
      supabase.from("order_items").select("id, name, sku, quantity, image_url").eq("order_id", assignment.order_id).order("sort_order"),
    ]);
    return { assignment, order, response, items: items || [], supplierName: profile?.company_name || profile?.full_name || "Fournisseur" };
  };

  try {
    if (req.method === "GET") {
      const id = new URL(req.url).searchParams.get("a");
      if (!id || !z.string().uuid().safeParse(id).success) return json({ error: "Lien invalide" }, 400);
      const ctx = await loadContext(id);
      if (!ctx) return json({ error: "expired" }, 404);
      return json({ order: ctx.order, items: ctx.items, supplier_name: ctx.supplierName, status: ctx.response?.status || "pending" });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const parsed = PostSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { assignment_id, action, note, alternative_date, alternative_time, alternative_truck, items: itemChanges } = parsed.data;

    const ctx = await loadContext(assignment_id);
    if (!ctx || !ctx.order) return json({ error: "expired" }, 404);
    const { assignment, order, response, supplierName, items: orderItems } = ctx;

    if (response && ["confirmed", "declined", "expired", "needs_modification"].includes(response.status)) {
      return json({ error: "already", status: response.status }, 409);
    }

    const now = new Date().toISOString();
    let content = "";
    let kind = "";
    let notifTitle = "";
    let orderStatus: string | null = null;
    let proposalRow: any = null;
    let proposalId: string | null = null;

    if (action === "accept") {
      kind = "action_accept";
      content = `✅ ${supplierName} a accepté la commande ${order.order_number}.${note ? `\n\n« ${note} »` : ""}`;
      notifTitle = `✅ Acceptée — ${order.order_number}`;
      orderStatus = "in_progress";
      await supabase.from("supplier_responses").update({
        status: "confirmed", can_deliver_date: true, can_deliver_time: true, can_deliver_truck: true,
        supplier_general_note: note || null, responded_at: now, confirmed_at: now,
      }).eq("assignment_id", assignment_id);
    } else if (action === "decline") {
      kind = "action_decline";
      content = `❌ ${supplierName} a refusé la commande ${order.order_number}.${note ? `\n\nRaison : « ${note} »` : ""}`;
      notifTitle = `❌ Refusée — ${order.order_number}`;
      await supabase.from("supplier_responses").update({
        status: "declined", supplier_general_note: note || null, responded_at: now, escalated_at: now,
      }).eq("assignment_id", assignment_id);
    } else {
      kind = "action_modify";
      const parts: string[] = [];
      const qtyById: Record<string, number> = Object.fromEntries((itemChanges || []).map((c) => [c.item_id, c.quantity]));
      const proposalItems = orderItems.map((it: any) => {
        const q = qtyById[it.id];
        const proposed = q === undefined ? it.quantity : Math.min(q, it.quantity);
        return { item_id: it.id, name: it.name, sku: it.sku, original_qty: it.quantity, proposed_qty: proposed };
      });
      for (const it of proposalItems) {
        if (it.proposed_qty === 0) parts.push(`• Retiré : ${it.name} (${it.original_qty})`);
        else if (it.proposed_qty < it.original_qty) parts.push(`• ${it.name} : ${it.original_qty} → ${it.proposed_qty}`);
      }
      proposalRow = {
        order_id: order.id, assignment_id, supplier_id: assignment.supplier_id, supplier_name: supplierName,
        items: proposalItems, proposed_date: alternative_date || null, proposed_time_window: alternative_time || null,
        proposed_truck: alternative_truck || null, note: note || null,
      };
      if (alternative_date) parts.push(`• Date proposée : ${alternative_date}`);
      if (alternative_time) parts.push(`• Plage horaire proposée : ${alternative_time}`);
      if (alternative_truck) parts.push(`• Camion proposé : ${alternative_truck}`);
      if (note) parts.push(`• Message : « ${note} »`);
      content = `✏️ ${supplierName} propose une modification pour ${order.order_number}.${parts.length ? "\n\n" + parts.join("\n") : ""}`;
      notifTitle = `✏️ Modification proposée — ${order.order_number}`;
      orderStatus = "on_hold";
      await supabase.from("supplier_responses").update({
        status: "needs_modification",
        can_deliver_date: alternative_date ? false : true,
        alternative_date: alternative_date || null,
        can_deliver_time: alternative_time ? false : true,
        alternative_time: alternative_time || null,
        can_deliver_truck: alternative_truck ? false : true,
        alternative_truck: alternative_truck || null,
        supplier_general_note: note || null,
        responded_at: now,
      }).eq("assignment_id", assignment_id);
    }

    if (proposalRow) {
      const { data: prop, error: propErr } = await supabase.from("order_modification_proposals").insert(proposalRow).select("id").single();
      if (propErr) throw propErr;
      proposalId = prop.id;
    }

    // Post into the conversation
    await supabase.from("order_messages").insert({
      order_id: order.id,
      user_id: assignment.supplier_id,
      sender_name: supplierName,
      content,
      supplier_id: assignment.supplier_id,
      source: "action",
      kind,
      is_broadcast: false,
      proposal_id: proposalId,
    });

    if (orderStatus) {
      await supabase.from("orders").update({ status: orderStatus, updated_at: now }).eq("id", order.id);
    }

    await supabase.from("notifications").insert({
      type: kind, title: notifTitle, message: content, order_id: order.id, is_read: false,
    });

    // Decline → move on to the next supplier in the priority list
    if (action === "decline") {
      await dispatchToNextSupplier(supabase, {
        orderId: order.id, orderNumber: order.order_number, fromRank: assignment.priority_rank || 1,
        assignmentType: assignment.assignment_type, skipSupplierIds: [assignment.supplier_id],
        reason: `${supplierName} a refusé.`,
      });
    }

    return json({ success: true });
  } catch (error) {
    console.error("supplier-respond error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
