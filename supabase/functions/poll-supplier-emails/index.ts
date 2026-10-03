import { createClient } from "npm:@supabase/supabase-js@2";
import {
  extractOrderNumber,
  extractTextBody,
  getGmailMessage,
  listUnreadMessages,
  markMessageAsRead,
  stripQuotedReply,
} from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  // This function is intended to be called by pg_cron or admin invocation.
  // Reject direct anonymous calls.
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cronToken = req.headers.get("x-cron-token");
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
  const cronSecret = Deno.env.get("CRON_SECRET");
  let authorized = !!(cronSecret && bearer === cronSecret);
  if (!authorized && cronToken) {
    const { data } = await supabaseAdmin.from("internal_cron_tokens").select("token").eq("name", "poll_supplier_emails").maybeSingle();
    authorized = !!data && data.token === cronToken;
  }
  if (!authorized) {
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

        // 1) Match by Gmail thread (reply to our original email)
        const { data: thread } = messageData.threadId
          ? await supabase
              .from("supplier_email_threads")
              .select("order_id, supplier_id")
              .eq("gmail_thread_id", messageData.threadId)
              .limit(1)
              .maybeSingle()
          : { data: null };

        // Only accept replies to our own threads, or emails from a known supplier.
        const { data: existingUsersEarly } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const knownSupplier = existingUsersEarly?.users?.find(u => u.email?.toLowerCase() === fromEmail.toLowerCase());
        let isSupplier = false;
        if (knownSupplier) {
          const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", knownSupplier.id).eq("role", "supplier").maybeSingle();
          isSupplier = !!role;
        }
        if (!thread && !isSupplier) {
          skipped.push(messageId);
          continue; // leave untouched — not a supplier reply
        }

        let order: { id: string; order_number: string } | null = null;
        if (thread) {
          const { data } = await supabase.from("orders").select("id, order_number").eq("id", thread.order_id).maybeSingle();
          order = data;
        } else {
          const orderNumber = extractOrderNumber(subject);
          if (orderNumber) {
            const { data } = await supabase.from("orders").select("id, order_number").eq("order_number", orderNumber).maybeSingle();
            order = data;
          }
        }

        if (!order) {
          skipped.push(messageId);
          continue;
        }

        // Find supplier by email
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const supplierUser = existingUsers?.users?.find(u =>
          u.email?.toLowerCase() === fromEmail.toLowerCase()
        );
        const supplierId = thread?.supplier_id || supplierUser?.id || null;

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
          const bodyText = stripQuotedReply(extractTextBody(messageData.payload));

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
