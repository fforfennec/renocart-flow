import { createRawEmail, getRfcMessageId, sendGmailMessage } from "./gmail.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const appUrl = () => (Deno.env.get("APP_URL") || "https://renocart-flow.lovable.app").replace(/\/$/, "");

/** Finds the client account (owner) behind an email, if any. */
async function ownerForEmail(supabase: any, email: string): Promise<string | null> {
  const { data: m } = await supabase.from("client_members").select("owner_id").ilike("email", email).eq("status", "active").maybeSingle();
  if (m?.owner_id) return m.owner_id;
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  return data?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

/** Sends RenoCart's own order confirmation so the client can reply to it; opens the support thread for the order. */
export async function sendClientConfirmation(supabase: any, orderId: string) {
  const { data: o } = await supabase.from("orders").select("id, order_number, client_name, customer_email, delivery_date, delivery_time_window, project_name").eq("id", orderId).maybeSingle();
  if (!o?.customer_email) return;
  const { data: existing } = await supabase.from("support_threads").select("id").eq("order_id", o.id).not("gmail_thread_id", "is", null).maybeSingle();
  if (existing) return;
  const subject = `Commande ${o.order_number} reçue — RenoCart`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
<p>Bonjour ${esc(o.client_name || "")},</p>
<p>Merci ! Nous avons bien reçu votre commande <b>${esc(o.order_number)}</b>${o.project_name ? ` (projet ${esc(o.project_name)})` : ""}.</p>
${o.delivery_date ? `<p>Livraison prévue : <b>${esc(o.delivery_date)}</b>${o.delivery_time_window ? `, ${esc(o.delivery_time_window)}` : ""}.</p>` : ""}
<p><b>Une question ou un changement ? Répondez simplement à ce courriel</b> — notre équipe vous répondra dans ce même fil.</p>
<p>Vous pouvez aussi suivre vos livraisons et écrire au support depuis <a href="${appUrl()}/projets">${appUrl()}/projets</a>.</p>
<p>L'équipe RenoCart</p></div>`;
  const sent = await sendGmailMessage(createRawEmail(o.customer_email, subject, html, { html: true }));
  const rfc = sent?.id ? await getRfcMessageId(sent.id) : null;
  await supabase.from("support_threads").insert({
    owner_id: await ownerForEmail(supabase, o.customer_email),
    customer_email: o.customer_email.toLowerCase(),
    order_id: o.id, subject, gmail_thread_id: sent?.threadId ?? null, rfc_message_id: rfc,
  });
}

/** Emails a staff reply to the client inside the thread's email conversation (starting one if needed). */
export async function emailSupportReply(supabase: any, thread: any, content: string, senderName: string) {
  if (!thread.customer_email) return;
  let orderNumber: string | null = null;
  if (thread.order_id) {
    const { data } = await supabase.from("orders").select("order_number").eq("id", thread.order_id).maybeSingle();
    orderNumber = data?.order_number ?? null;
  }
  const subject = thread.gmail_thread_id && thread.subject ? `Re: ${thread.subject.replace(/^Re:\s*/i, "")}` : (orderNumber ? `Commande ${orderNumber} — Support RenoCart` : "Support RenoCart");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111"><p style="white-space:pre-wrap">${esc(content)}</p>
<p>— ${esc(senderName)}, Support RenoCart</p>
<p style="color:#666;font-size:13px">Répondez à ce courriel ou écrivez-nous depuis <a href="${appUrl()}/projets">${appUrl()}/projets</a>.</p></div>`;
  const raw = createRawEmail(thread.customer_email, subject, html, {
    html: true,
    ...(thread.rfc_message_id ? { inReplyTo: thread.rfc_message_id, references: thread.rfc_message_id } : {}),
  });
  const sent = await sendGmailMessage(raw, thread.gmail_thread_id);
  if (!thread.gmail_thread_id && sent?.threadId) {
    const rfc = sent.id ? await getRfcMessageId(sent.id) : null;
    await supabase.from("support_threads").update({ gmail_thread_id: sent.threadId, rfc_message_id: rfc, subject }).eq("id", thread.id);
  }
}

/** Records a client's email reply into a support thread. Returns true when handled. */
export async function handleClientEmail(supabase: any, opts: {
  threadId: string | null; messageId: string; fromEmail: string; fromName: string; subject: string; body: string;
  orderNumber: string | null; saveAttachments: (prefix: string) => Promise<{ name: string; path: string; mime: string; size: number }[]>;
}): Promise<boolean> {
  let thread: any = null;
  if (opts.threadId) {
    const { data } = await supabase.from("support_threads").select("*").eq("gmail_thread_id", opts.threadId).limit(1).maybeSingle();
    thread = data;
  }
  if (!thread && opts.orderNumber) {
    const { data: order } = await supabase.from("orders").select("id, customer_email").eq("order_number", opts.orderNumber).maybeSingle();
    if (order?.customer_email && order.customer_email.toLowerCase() === opts.fromEmail.toLowerCase()) {
      const { data } = await supabase.from("support_threads").select("*").eq("order_id", order.id).ilike("customer_email", opts.fromEmail).order("created_at").limit(1).maybeSingle();
      thread = data ?? (await supabase.from("support_threads").insert({
        owner_id: await ownerForEmail(supabase, opts.fromEmail), customer_email: opts.fromEmail.toLowerCase(),
        order_id: order.id, subject: opts.subject, gmail_thread_id: opts.threadId,
      }).select("*").single()).data;
    }
  }
  if (!thread) return false;
  const { data: dup } = await supabase.from("support_messages").select("id").eq("email_message_id", opts.messageId).maybeSingle();
  if (!dup) {
    const attachments = await opts.saveAttachments(`email/${thread.id}/${opts.messageId}`);
    await supabase.from("support_messages").insert({
      thread_id: thread.id, sender_name: opts.fromName || opts.fromEmail, sender_role: "client", source: "email",
      content: opts.body || (attachments.length ? "📎 Fichier(s) joint(s)" : ""), attachments, email_message_id: opts.messageId,
    });
    await supabase.from("support_threads").update({ last_message_at: new Date().toISOString(), status: "open" }).eq("id", thread.id);
  }
  return true;
}
