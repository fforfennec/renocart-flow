import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { dispatchToNextSupplier, replyInThread } from "../_shared/escalate.ts";

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ proposal_id: z.string().uuid(), decision: z.enum(["accept", "refuse"]) });

const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", month: "long", day: "numeric" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // TEST MODE: app login is bypassed, so callers are not authenticated yet.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { proposal_id, decision } = parsed.data;

    const { data: p } = await supabase.from("order_modification_proposals").select("*").eq("id", proposal_id).maybeSingle();
    if (!p) return json({ error: "Proposition introuvable" }, 404);
    if (p.status !== "pending") return json({ error: "Proposition déjà traitée" }, 409);

    const { data: order } = await supabase.from("orders").select("*").eq("id", p.order_id).single();
    const { data: assignment } = await supabase.from("supplier_assignments").select("*").eq("id", p.assignment_id).maybeSingle();
    const now = new Date().toISOString();
    const supplierName = p.supplier_name || "Fournisseur";

    if (decision === "refuse") {
      await supabase.from("order_modification_proposals").update({ status: "refused", decided_at: now }).eq("id", p.id);
      await supabase.from("supplier_responses").update({ status: "declined", escalated_at: now }).eq("assignment_id", p.assignment_id);
      await replyInThread(supabase, {
        orderId: order.id, supplierId: p.supplier_id, kind: "proposal_refused",
        text: `Bonjour,\n\nMerci pour votre proposition pour la commande ${order.order_number}. Nous ne pouvons malheureusement pas l'accepter : la commande sera confiée à un autre fournisseur.\n\nMerci de votre compréhension.`,
      });
      const r = await dispatchToNextSupplier(supabase, {
        orderId: order.id, orderNumber: order.order_number, fromRank: assignment?.priority_rank || 1,
        assignmentType: assignment?.assignment_type || "material", skipSupplierIds: [p.supplier_id],
        reason: `Proposition de ${supplierName} refusée.`,
      });
      return json({ success: true, ...r });
    }

    // ACCEPT
    const items = (p.items || []) as { item_id: string; name: string; original_qty: number; proposed_qty: number }[];
    const removed = items.filter((i) => i.proposed_qty < i.original_qty);
    const baseNumber = order.order_number.replace(/-A$/, "");
    let splitOrder: { id: string; order_number: string } | null = null;

    const orderUpdate: Record<string, unknown> = { status: "in_progress", updated_at: now };
    if (p.proposed_date) orderUpdate.delivery_date = p.proposed_date;
    if (p.proposed_time_window) orderUpdate.delivery_time_window = p.proposed_time_window;
    if (p.proposed_truck) orderUpdate.truck_type = p.proposed_truck;

    if (removed.length) {
      const { data: fullItems } = await supabase.from("order_items").select("*").eq("order_id", order.id);
      const byId = Object.fromEntries((fullItems || []).map((i: any) => [i.id, i]));

      // New order "-B" with the removed part (keeps the originally requested delivery details)
      const { data: b, error: bErr } = await supabase.from("orders").insert({
        order_number: `${baseNumber}-B`,
        client_name: order.client_name, client_address: order.client_address, client_phone: order.client_phone,
        delivery_date: order.delivery_date, delivery_time_window: order.delivery_time_window, truck_type: order.truck_type,
        internal_notes: order.internal_notes, shipping_method: order.shipping_method, created_by: order.created_by,
        status: "pending", parent_order_id: order.id,
      }).select("id, order_number").single();
      if (bErr) throw bErr;
      splitOrder = b;

      await supabase.from("order_items").insert(removed.map((r) => {
        const src = byId[r.item_id] || {};
        return {
          order_id: b.id, name: src.name || r.name, sku: src.sku ?? null, image_url: src.image_url ?? null,
          client_note: src.client_note ?? null, product_type: src.product_type ?? null, vendor: src.vendor ?? null,
          sort_order: src.sort_order ?? 0, quantity: r.original_qty - r.proposed_qty,
        };
      }));

      // Adjust the confirmed part
      for (const r of removed) {
        if (r.proposed_qty === 0) await supabase.from("order_items").delete().eq("id", r.item_id);
        else await supabase.from("order_items").update({ quantity: r.proposed_qty }).eq("id", r.item_id);
      }
      orderUpdate.order_number = `${baseNumber}-A`;
    }

    await supabase.from("orders").update(orderUpdate).eq("id", order.id);
    await supabase.from("supplier_responses").update({ status: "confirmed", confirmed_at: now }).eq("assignment_id", p.assignment_id);
    await supabase.from("order_modification_proposals").update({ status: "accepted", decided_at: now, split_order_id: splitOrder?.id ?? null }).eq("id", p.id);

    const lines: string[] = [];
    if (removed.length) {
      lines.push("Articles confirmés :");
      for (const i of items) if (i.proposed_qty > 0) lines.push(`• ${i.name} — ${i.proposed_qty}`);
    }
    if (p.proposed_date) lines.push(`Date de livraison : ${fmtDate(p.proposed_date)}`);
    if (p.proposed_time_window) lines.push(`Plage horaire : ${p.proposed_time_window}`);
    if (p.proposed_truck) lines.push(`Camion : ${p.proposed_truck}`);
    const finalNumber = (orderUpdate.order_number as string) || order.order_number;
    await replyInThread(supabase, {
      orderId: order.id, supplierId: p.supplier_id, kind: "proposal_accepted",
      text: `Bonjour,\n\nVotre proposition est acceptée. La commande ${finalNumber} est confirmée avec vous.${lines.length ? "\n\n" + lines.join("\n") : ""}\n\nMerci !`,
    });

    if (splitOrder) {
      await supabase.from("notifications").insert({
        type: "order_split", title: `Commande divisée — ${baseNumber}`,
        message: `${supplierName} prend ${baseNumber}-A. La partie retirée devient ${splitOrder.order_number}.`,
        order_id: splitOrder.id, is_read: false,
      });
      await dispatchToNextSupplier(supabase, {
        orderId: splitOrder.id, orderNumber: splitOrder.order_number, fromRank: assignment?.priority_rank || 1,
        assignmentType: assignment?.assignment_type || "material", skipSupplierIds: [p.supplier_id],
        reason: `Partie retirée par ${supplierName}.`,
      });
    }

    return json({ success: true, split_order: splitOrder });
  } catch (e) {
    console.error("decide-proposal error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
