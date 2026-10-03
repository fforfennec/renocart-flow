import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRawEmail, getRfcMessageId, sendGmailMessage } from "../_shared/gmail.ts";

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TIME_LABELS: Record<string, string> = { AM: "AM (avant midi)", PM: "PM (après-midi)", Early: "Tôt (avant 10h)", Day: "Journée (n'importe quand)" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, supplier_email, supplier_name, priority_rank, assignment_type, skip_cancel_supplier_ids } = await req.json();
    const skipCancel: string[] = Array.isArray(skip_cancel_supplier_ids) ? skip_cancel_supplier_ids : [];
    if (!order_id || !supplier_email || !supplier_name) {
      return new Response(JSON.stringify({ error: "Missing order_id, supplier_email, or supplier_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    const targetEmail = supplier_email;
    const targetName = supplier_name;
    const rank = priority_rank || 1;
    const type = assignment_type || "material";

    // 1. Load order + items
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();
    if (orderErr) throw orderErr;

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order_id)
      .order("sort_order");

    // 2. Check for existing assignments of same type — send cancellation email to previous
    const { data: existingAssignments } = await supabase
      .from("supplier_assignments")
      .select("id, supplier_id")
      .eq("order_id", order_id)
      .eq("assignment_type", type);

    if (existingAssignments && existingAssignments.length > 0) {
      for (const prev of existingAssignments) {
        // Get previous supplier email
        const { data: prevProfile } = await supabase
          .from("profiles")
          .select("full_name, company_name")
          .eq("user_id", prev.supplier_id)
          .maybeSingle();

        const { data: prevUser } = await supabase.auth.admin.getUserById(prev.supplier_id);
        const prevEmail = prevUser?.user?.email;
        const prevName = prevProfile?.company_name || prevProfile?.full_name || "Fournisseur";

        // Send cancellation email via Gmail
        if (prevEmail && !skipCancel.includes(prev.supplier_id)) {
          try {
            const cancelHtml = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
                <div style="background:#7f1d1d;padding:24px 32px;border-radius:8px 8px 0 0;">
                  <h1 style="color:#fff;margin:0;font-size:22px;">RenoCart</h1>
                  <p style="color:#fca5a5;margin:4px 0 0;font-size:14px;">Commande annulée</p>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px;">
                  <h2 style="margin:0 0 16px;font-size:20px;">Commande ${order.order_number}</h2>
                  <p style="font-size:15px;color:#374151;margin:0 0 16px;">
                    Bonjour ${prevName},
                  </p>
                  <p style="font-size:15px;color:#374151;margin:0 0 24px;">
                    Nous vous informons que la commande <strong>${order.order_number}</strong>
                    a été réassignée à un autre fournisseur. Veuillez annuler cette commande de votre côté si nécessaire.
                  </p>
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;">
                    <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">
                      ❌ Aucune action n'est requise de votre part pour cette commande.
                    </p>
                  </div>
                  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                    Merci de votre compréhension.
                  </p>
                </div>
              </div>
            `;

            await sendGmailMessage(
              createRawEmail(prevEmail, `Annulation — Commande ${order.order_number}`, cancelHtml, { html: true })
            );

            console.log(`Sent cancellation email to ${prevEmail} for order ${order.order_number}`);
            await supabase.from("order_events").insert({
              order_id,
              event_type: "email_sent",
              title: `📧 Email d'annulation envoyé — ${prevName}`,
              description: `Destinataire: ${prevEmail}`,
              supplier_id: prev.supplier_id,
              supplier_name: prevName,
              metadata: { kind: "cancellation", recipient: prevEmail },
            });
          } catch (cancelErr) {
            console.error("Failed to send cancellation email via Gmail:", cancelErr);
          }
        }

        // Mark previous response as cancelled
        await supabase
          .from("supplier_responses")
          .update({ status: "expired" })
          .eq("assignment_id", prev.id);

        // Delete previous assignment
        await supabase
          .from("supplier_assignments")
          .delete()
          .eq("id", prev.id);
      }
    }

    // 3. Find or create supplier user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let supplierUser = existingUsers?.users?.find(u => u.email === targetEmail);

    if (!supplierUser) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: targetEmail,
        email_confirm: true,
        user_metadata: { full_name: targetName, company_name: targetName },
      });
      if (createErr) throw createErr;
      supplierUser = newUser.user;

      await supabase.from("profiles").upsert({
        user_id: supplierUser.id,
        full_name: targetName,
        company_name: targetName,
        supplier_type: type,
      });

      await supabase.from("user_roles").upsert({
        user_id: supplierUser.id,
        role: "supplier",
      });
    }

    // 4. Create assignment
    const { data: assignment, error: assignErr } = await supabase
      .from("supplier_assignments")
      .insert({
        order_id,
        supplier_id: supplierUser.id,
        assignment_type: type,
        assigned_at: new Date().toISOString(),
        priority_rank: rank,
      })
      .select("id")
      .single();
    if (assignErr) throw assignErr;

    await supabase.from("supplier_responses").insert({
      assignment_id: assignment.id,
      status: "pending",
    });

    // 5. Update order status
    await supabase
      .from("orders")
      .update({ status: "assigned", updated_at: new Date().toISOString() })
      .eq("id", order_id);

    // 6. Build URLs (simple pages, no login required)
    const APP_URL = (Deno.env.get("APP_URL") || "https://renocart-flow.lovable.app").replace(/\/$/, "");
    const link = (action: string) => `${APP_URL}/supplier/respond?a=${assignment.id}&action=${action}`;

    // 7. Items table
    const itemsHtml = (items || []).map(item => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(item.name)}${item.sku ? `<br><span style="color:#9ca3af;font-size:12px;">SKU ${esc(item.sku)}</span>` : ""}${item.client_note ? `<br><span style="color:#92400e;font-size:12px;">Note : ${esc(item.client_note)}</span>` : ""}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;font-size:15px;">${esc(item.quantity)}</td>
      </tr>`).join("");

    const dateLabel = order.delivery_date
      ? new Date(order.delivery_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "À confirmer";
    const row = (label: string, value: string | null | undefined) => value ? `
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;vertical-align:top;">${label}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${esc(value)}</td></tr>` : "";
    const btn = (href: string, bg: string, label: string) => `
      <td style="padding:4px;"><a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:6px;font-weight:700;font-size:14px;">${label}</a></td>`;

    const subject = `Commande ${order.order_number} — Nouvelle commande RenoCart`;

    // 8. Send email to new supplier via Gmail
    try {
      const dispatchHtml = `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#1a2e44;padding:22px 28px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">RenoCart</h1>
            <p style="color:#c9a84c;margin:4px 0 0;font-size:14px;">Nouvelle commande à confirmer</p>
          </div>
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 4px;font-size:15px;">Bonjour ${esc(targetName)},</p>
            <p style="margin:0 0 20px;font-size:14px;color:#374151;">Voici une nouvelle commande. Merci de nous indiquer si vous pouvez la compléter.</p>

            <h2 style="margin:0 0 12px;font-size:20px;">Commande ${esc(order.order_number)}</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f9fafb;border-radius:8px;">
              <tr><td style="padding:14px 18px;"><table style="width:100%;border-collapse:collapse;">
                ${row("Date de livraison", dateLabel)}
                ${row("Plage horaire", order.delivery_time_window ? (TIME_LABELS[order.delivery_time_window] || order.delivery_time_window) : "À confirmer")}
                ${row("Type de camion", order.truck_type || "À confirmer")}
                ${row("Mode de livraison", order.shipping_method)}
                ${row("Adresse", order.client_address)}
                ${row("Client", order.client_name)}
                ${row("Téléphone", order.client_phone)}
              </table></td></tr>
            </table>

            <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Matériaux requis</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <thead><tr style="background:#f3f4f6;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Article</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;width:90px;">Quantité</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            ${order.internal_notes ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;margin-bottom:20px;"><p style="margin:0;font-size:13px;color:#92400e;"><strong>Note :</strong> ${esc(order.internal_notes)}</p></div>` : ""}

            <p style="margin:8px 0 12px;font-size:14px;font-weight:700;text-align:center;">Votre réponse</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;"><tr>
              ${btn(link("accept"), "#16a34a", "✅ Accepter la commande")}
              ${btn(link("decline"), "#dc2626", "❌ Refuser")}
              ${btn(link("modify"), "#d97706", "✏️ Proposer une modification")}
            </tr></table>
            <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">Aucune connexion requise. Vous pouvez aussi répondre directement à ce courriel.</p>
          </div>
        </div>`;

      const sent = await sendGmailMessage(createRawEmail(targetEmail, subject, dispatchHtml, { html: true }));
      const rfcId = sent?.id ? await getRfcMessageId(sent.id) : null;

      await supabase.from("supplier_email_threads").upsert({
        order_id,
        supplier_id: supplierUser.id,
        supplier_email: targetEmail,
        gmail_thread_id: sent?.threadId || null,
        rfc_message_id: rfcId,
        subject,
        updated_at: new Date().toISOString(),
      }, { onConflict: "order_id,supplier_id" });

      // Seed the conversation in the app
      await supabase.from("order_messages").insert({
        order_id,
        user_id: supplierUser.id,
        sender_name: "RenoCart",
        content: `📧 Commande ${order.order_number} envoyée à ${targetName} (${targetEmail}) avec les boutons Accepter / Refuser / Proposer une modification.`,
        supplier_id: supplierUser.id,
        source: "app",
        kind: "dispatch",
        is_broadcast: false,
      });

      await supabase.from("order_events").insert({
        order_id,
        event_type: "email_sent",
        title: `📧 Email envoyé au fournisseur ${rank === 1 ? "prioritaire" : `(rang ${rank})`} — ${targetName}`,
        description: `Destinataire: ${targetEmail}`,
        supplier_id: supplierUser.id,
        supplier_name: targetName,
        metadata: { kind: "dispatch", recipient: targetEmail, priority_rank: rank, assignment_type: type },
      });
    } catch (emailErr) {
      console.error("Failed to send dispatch email via Gmail:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, assignment_id: assignment.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("dispatch-order error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
