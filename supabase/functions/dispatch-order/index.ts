import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, supplier_email, supplier_name, priority_rank, assignment_type } = await req.json();
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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
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

        // Send cancellation email
        if (prevEmail && RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "RenoCart <commande@renocart.ca>",
              to: [prevEmail],
              subject: `Annulation — Commande ${order.order_number}`,
              html: `
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
              `,
            }),
          });
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

    // 6. Build URLs
    const confirmUrl = `${SUPABASE_URL}/functions/v1/supplier-respond?assignment_id=${assignment.id}&action=confirm`;
    const modifyUrl = `${SUPABASE_URL}/functions/v1/supplier-respond?assignment_id=${assignment.id}&action=modify`;

    // 7. Build items table
    const itemsHtml = (items || []).map(item => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">${item.name}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;font-size:14px;">${item.quantity}</td>
      </tr>
    `).join("");

    // 8. Send email to new supplier
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "RenoCart <commande@renocart.ca>",
          to: [targetEmail],
          subject: `Nouvelle commande RenoCart — ${order.order_number}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
              <div style="background:#1a2e44;padding:24px 32px;border-radius:8px 8px 0 0;">
                <h1 style="color:#fff;margin:0;font-size:22px;">RenoCart</h1>
                <p style="color:#c9a84c;margin:4px 0 0;font-size:14px;">Nouvelle commande à confirmer</p>
              </div>

              <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px;">
                <h2 style="margin:0 0 4px;font-size:20px;">Commande ${order.order_number}</h2>
                <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Reçue le ${new Date().toLocaleDateString('fr-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>

                <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                  <p style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Livraison</p>
                  <p style="margin:0;font-size:15px;font-weight:600;">${order.client_address}</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Date : ${new Date(order.delivery_date).toLocaleDateString('fr-CA')} &nbsp;|&nbsp; ${order.delivery_time_window}</p>
                  ${order.truck_type ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Camion : ${order.truck_type}</p>` : ""}
                </div>

                <p style="margin:0 0 12px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Matériaux requis</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                  <thead>
                    <tr style="background:#f3f4f6;">
                      <th style="padding:8px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Article</th>
                      <th style="padding:8px 16px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Quantité</th>
                    </tr>
                  </thead>
                  <tbody>${itemsHtml}</tbody>
                </table>

                ${order.internal_notes ? `
                <div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
                  <p style="margin:0;font-size:13px;color:#92400e;"><strong>Note client :</strong> ${order.internal_notes}</p>
                </div>` : ""}

                <p style="margin:0 0 4px;font-size:14px;color:#166534;font-weight:600;text-align:center;">Vous avez 30 minutes pour répondre</p>
                <p style="margin:0 0 20px;font-size:13px;color:#16a34a;text-align:center;">Cliquez sur un bouton ci-dessous</p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
                  <tr>
                    <td style="padding-right:12px;">
                      <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:15px;">
                        ✅ Oui, je confirme
                      </a>
                    </td>
                    <td>
                      <a href="${modifyUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:15px;">
                        ✏️ Modifier / Je ne peux pas
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">Aucune connexion requise pour confirmer.</p>
              </div>
            </div>
          `,
        }),
      });
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
