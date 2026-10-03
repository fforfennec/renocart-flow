// Shared helpers: send an order to the next supplier in the priority list,
// and reply to a supplier inside the original Gmail thread.
import { createRawEmail, sendGmailMessage } from "./gmail.ts";

export async function dispatchToNextSupplier(
  supabase: any,
  opts: { orderId: string; orderNumber: string; fromRank: number; assignmentType: string; skipSupplierIds: string[]; reason: string },
) {
  const { data: settings } = await supabase.from("app_settings").select("value").eq("key", "automations_paused").maybeSingle();
  const { data: o } = await supabase.from("orders").select("automation_paused").eq("id", opts.orderId).single();
  const paused = settings?.value === "true" || o?.automation_paused;

  const { data: next } = await supabase
    .from("supplier_priority")
    .select("*")
    .eq("is_active", true)
    .gt("priority_order", opts.fromRank || 1)
    .order("priority_order")
    .limit(1)
    .maybeSingle();

  if (next && !paused) {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/dispatch-order`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: opts.orderId,
        supplier_email: next.email,
        supplier_name: next.name,
        priority_rank: next.priority_order,
        assignment_type: opts.assignmentType,
        skip_cancel_supplier_ids: opts.skipSupplierIds,
      }),
    });
    await supabase.from("notifications").insert({
      type: "escalation", title: `Commande envoyée au suivant — ${opts.orderNumber}`,
      message: `${opts.reason} Commande envoyée à ${next.name}.`, order_id: opts.orderId, is_read: false,
    });
    return { dispatched: true, to: next.name };
  }

  await supabase.from("orders").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", opts.orderId);
  await supabase.from("notifications").insert({
    type: "escalation_final", title: `⚠️ Action requise — ${opts.orderNumber}`,
    message: paused
      ? `${opts.reason} L'automatisation est en pause : assigne un fournisseur manuellement.`
      : `${opts.reason} Aucun autre fournisseur n'est disponible : assigne un fournisseur manuellement.`,
    order_id: opts.orderId, is_read: false,
  });
  return { dispatched: false };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Sends a message to the supplier in the order's Gmail thread and logs it in the chat. */
export async function replyInThread(
  supabase: any,
  opts: { orderId: string; supplierId: string; text: string; kind?: string },
) {
  const { data: thread } = await supabase
    .from("supplier_email_threads")
    .select("*")
    .eq("order_id", opts.orderId)
    .eq("supplier_id", opts.supplierId)
    .maybeSingle();

  let sent = false;
  if (thread?.supplier_email) {
    try {
      const subject = thread.subject ? (thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`) : "RenoCart";
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;">${esc(opts.text)}</div><p style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;">— RenoCart</p>`;
      const raw = createRawEmail(thread.supplier_email, subject, html, {
        html: true,
        inReplyTo: thread.rfc_message_id || undefined,
        references: thread.rfc_message_id || undefined,
      });
      await sendGmailMessage(raw, thread.gmail_thread_id);
      sent = true;
    } catch (e) {
      console.error("replyInThread email failed:", e);
    }
  }

  await supabase.from("order_messages").insert({
    order_id: opts.orderId,
    user_id: "00000000-0000-0000-0000-000000000000",
    sender_name: "RenoCart",
    content: opts.text,
    supplier_id: opts.supplierId,
    source: "app",
    kind: opts.kind || "text",
    is_broadcast: false,
  });
  return sent;
}
