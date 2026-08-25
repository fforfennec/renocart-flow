import { createClient } from "npm:@supabase/supabase-js@2";
import {
  extractOrderNumber,
  extractTextBody,
  getGmailMessage,
  listUnreadMessages,
  markMessageAsRead,
} from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  // This function is intended to be called by pg_cron or admin invocation.
  // Reject direct anonymous calls.
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const messages = await listUnreadMessages(50);
    const processed: string[] = [];
    const skipped: string[] = [];

    for (const msg of messages) {
      const messageId = msg.id;

      try {
        const messageData = await getGmailMessage(messageId);
        const headers = messageData.payload?.headers || [];
        const subjectHeader = headers.find((h: any) => h.name === "Subject");
        const fromHeader = headers.find((h: any) => h.name === "From");
        const subject = subjectHeader?.value || "";
        const from = fromHeader?.value || "";
        const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;

        const orderNumber = extractOrderNumber(subject);
        if (!orderNumber) {
          skipped.push(messageId);
          await markMessageAsRead(messageId);
          continue;
        }

        // Find order by order_number
        const { data: order } = await supabase
          .from("orders")
          .select("id, order_number")
          .eq("order_number", orderNumber)
          .maybeSingle();

        if (!order) {
          skipped.push(messageId);
          await markMessageAsRead(messageId);
          continue;
        }

        // Find supplier by email
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const supplierUser = existingUsers?.users?.find(u =>
          u.email?.toLowerCase() === fromEmail.toLowerCase()
        );
        const supplierId = supplierUser?.id || null;

        // Find supplier name
        let senderName = fromEmail;
        if (supplierId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, company_name")
            .eq("user_id", supplierId)
            .maybeSingle();
          senderName = profile?.company_name || profile?.full_name || fromEmail;
        } else {
          senderName = from.match(/^"?([^"<]+)"?/)?.[1]?.trim() || fromEmail;
        }

        // Check for duplicate
        const { data: existing } = await supabase
          .from("order_messages")
          .select("id")
          .eq("email_message_id", messageId)
          .maybeSingle();

        if (!existing) {
          const bodyText = extractTextBody(messageData.payload);

          await supabase.from("order_messages").insert({
            order_id: order.id,
            user_id: supplierId || "00000000-0000-0000-0000-000000000000",
            sender_name: senderName,
            content: bodyText,
            supplier_id: supplierId,
            source: "email",
            email_message_id: messageId,
          });

          await supabase.from("order_events").insert({
            order_id: order.id,
            event_type: "supplier_responded",
            title: `📧 Réponse par email — ${senderName}`,
            description: `Sujet: ${subject}`,
            supplier_id: supplierId,
            supplier_name: senderName,
            metadata: { kind: "email_reply", subject, from: fromEmail, email_message_id: messageId },
          });
        }

        await markMessageAsRead(messageId);
        processed.push(messageId);
      } catch (err) {
        console.error(`Error processing message ${messageId}:`, err);
        // Don't mark as read on error so we can retry
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processed.length, skipped: skipped.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("poll-supplier-emails error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
