import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function makeHtmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: new Headers({
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    }),
  });
}

function makeJsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: new Headers({
      ...corsHeaders,
      "Content-Type": "application/json",
    }),
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
      return makeJsonResponse({ error: "Missing assignment_id" }, 400);
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
        status: 404, headers: jsonHeaders,
      });
    }

    // === UNDO action ===
    if (action === "undo") {
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

      // Reset order status back to assigned
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

      return new Response(undoSuccessHtml(), { headers: htmlHeaders });
    }

    // === Already confirmed ===
    if (response.status === "confirmed") {
      return new Response(alreadyConfirmedHtml(), { headers: htmlHeaders });
    }

    const now = new Date().toISOString();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    if (action === "confirm") {
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

      // Update order + notify
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

      const undoUrl = `${SUPABASE_URL}/functions/v1/supplier-respond?assignment_id=${assignmentId}&action=undo`;
      return new Response(
        countdownHtml("Vous avez confirmé cette commande", "Confirmé — Merci !", undoUrl),
        { headers: htmlHeaders }
      );
    }

    if (action === "modify") {
      // Mark as needs_modification
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

      const undoUrl = `${SUPABASE_URL}/functions/v1/supplier-respond?assignment_id=${assignmentId}&action=undo`;
      return new Response(
        countdownHtml("Vous avez demandé une modification", "Modification enregistrée — Merci !", undoUrl),
        { headers: htmlHeaders }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: jsonHeaders,
    });
  } catch (error) {
    console.error("supplier-respond error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

function countdownHtml(title: string, doneMessage: string, undoUrl: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9fafb; min-height:100vh; display:flex; flex-direction:column; }
    .header { background:#1a2e44; padding:20px 32px; }
    .header h1 { color:#fff; font-size:20px; font-weight:700; }
    .header p { color:#c9a84c; font-size:13px; margin-top:2px; }
    .content { flex:1; display:flex; align-items:center; justify-content:center; padding:40px 20px; }
    .card { text-align:center; max-width:420px; width:100%; }
    .icon { font-size:52px; margin-bottom:20px; }
    .title { font-size:22px; font-weight:700; color:#1a2e44; margin-bottom:8px; }
    .subtitle { font-size:15px; color:#6b7280; margin-bottom:28px; line-height:1.5; }
    .undo-btn { display:inline-block; background:#dc2626; color:#fff; border:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; text-decoration:none; transition: opacity .2s; }
    .undo-btn:hover { opacity:.9; }
    .done-msg { font-size:18px; font-weight:600; color:#16a34a; }
    .done-icon { font-size:44px; margin-bottom:12px; }
    .fade-out { animation: fadeOut .4s forwards; }
    @keyframes fadeOut { to { opacity:0; transform:scale(.95); } }
    .fade-in { animation: fadeIn .4s forwards; }
    @keyframes fadeIn { from { opacity:0; transform:scale(.95); } to { opacity:1; transform:scale(1); } }
  </style>
</head>
<body>
  <div class="header">
    <h1>RenoCart</h1>
    <p>Confirmation de commande</p>
  </div>
  <div class="content">
    <div class="card" id="card">
      <div class="icon">✅</div>
      <div class="title">${title}</div>
      <div class="subtitle">Vous pouvez annuler dans les 30 prochaines secondes.</div>
      <a href="#" id="undoBtn" class="undo-btn" onclick="doUndo(event)">Annuler (30s)</a>
    </div>
  </div>
  <script>
    let seconds = 30;
    let timer;
    const btn = document.getElementById('undoBtn');
    const card = document.getElementById('card');

    function tick() {
      seconds--;
      if (seconds <= 0) {
        clearInterval(timer);
        showDone();
        return;
      }
      btn.textContent = 'Annuler (' + seconds + 's)';
    }

    function showDone() {
      card.classList.add('fade-out');
      setTimeout(() => {
        card.innerHTML = '<div class="done-icon">🎉</div><div class="done-msg">${doneMessage}</div><p style="color:#6b7280;margin-top:12px;font-size:14px;">Vous pouvez fermer cette page.</p>';
        card.classList.remove('fade-out');
        card.classList.add('fade-in');
      }, 400);
    }

    function doUndo(e) {
      e.preventDefault();
      clearInterval(timer);
      btn.textContent = 'Annulation…';
      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';
      fetch('${undoUrl}').then(r => {
        if (r.ok) {
          card.classList.add('fade-out');
          setTimeout(() => {
            card.innerHTML = '<div class="icon">↩️</div><div class="title">Action annulée</div><p style="color:#6b7280;margin-top:8px;font-size:14px;">Votre réponse a été annulée. Vous pouvez fermer cette page.</p>';
            card.classList.remove('fade-out');
            card.classList.add('fade-in');
          }, 400);
        }
      });
    }

    timer = setInterval(tick, 1000);
  </script>
</body>
</html>`;
}

function alreadyConfirmedHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Déjà confirmé</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f9fafb;">
  <div style="background:#1a2e44;padding:20px 32px;"><h1 style="color:#fff;font-size:20px;margin:0;">RenoCart</h1></div>
  <div style="display:flex;align-items:center;justify-content:center;min-height:80vh;padding:40px 20px;">
    <div style="text-align:center;max-width:400px;">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <h2 style="font-size:22px;color:#1a2e44;margin:0 0 8px;">Déjà confirmé</h2>
      <p style="color:#6b7280;font-size:15px;">Cette commande a déjà été confirmée. Merci !</p>
    </div>
  </div>
</body>
</html>`;
}

function undoSuccessHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Annulé</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f9fafb;">
  <div style="background:#1a2e44;padding:20px 32px;"><h1 style="color:#fff;font-size:20px;margin:0;">RenoCart</h1></div>
  <div style="display:flex;align-items:center;justify-content:center;min-height:80vh;padding:40px 20px;">
    <div style="text-align:center;max-width:400px;">
      <div style="font-size:48px;margin-bottom:16px;">↩️</div>
      <h2 style="font-size:22px;color:#1a2e44;margin:0 0 8px;">Action annulée</h2>
      <p style="color:#6b7280;font-size:15px;">Votre réponse a été annulée avec succès.</p>
    </div>
  </div>
</body>
</html>`;
}
