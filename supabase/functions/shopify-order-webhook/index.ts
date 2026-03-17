import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function verifyShopifyWebhook(
  body: string,
  hmacHeader: string,
  secret: string
): boolean {
  const digest = createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  return digest === hmacHeader;
}

function buildAddress(addr: any): string {
  if (!addr) return "N/A";
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province_code || addr.province,
    addr.zip,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Verify webhook signature if secret is configured
    const webhookSecret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET");
    if (webhookSecret) {
      const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";
      if (!verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret)) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const shopifyOrder = JSON.parse(rawBody);
    const topic = req.headers.get("x-shopify-topic") || "orders/create";
    console.log(`Received Shopify webhook: ${topic}, order: ${shopifyOrder.name}`);

    // Only process order creation
    if (topic !== "orders/create") {
      return new Response(
        JSON.stringify({ success: true, message: "Ignored non-create event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const orderNumber = (shopifyOrder.name || "").replace("#", "");
    if (!orderNumber) {
      return new Response(
        JSON.stringify({ error: "Missing order number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if order already exists
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (existing) {
      console.log(`Order ${orderNumber} already exists, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Order already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract packing slip info
    const addr = shopifyOrder.shipping_address;
    const contactName =
      addr?.name ||
      (shopifyOrder.customer
        ? `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`
        : "N/A");
    const contactPhone =
      addr?.phone || shopifyOrder.customer?.phone || null;

    // Insert order
    const { data: newOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        client_name: contactName,
        client_address: buildAddress(addr),
        client_phone: contactPhone,
        delivery_date: new Date().toISOString().split("T")[0],
        delivery_time_window: "TBD",
        status: "pending",
        internal_notes: shopifyOrder.note || null,
        truck_type: null,
      })
      .select("id")
      .single();

    if (orderErr) {
      console.error(`Failed to insert order ${orderNumber}:`, orderErr);
      return new Response(
        JSON.stringify({ error: orderErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert order items with product images
    const items = (shopifyOrder.line_items || []).map(
      (item: any, idx: number) => ({
        order_id: newOrder.id,
        name: item.name || item.title || "Unknown item",
        quantity: item.quantity || 1,
        sku: item.sku || null,
        image_url: item.image?.src || null,
        sort_order: idx,
        client_note: null,
      })
    );

    if (items.length > 0) {
      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(items);

      if (itemsErr) {
        console.error(`Failed to insert items for ${orderNumber}:`, itemsErr);
      }
    }

    console.log(
      `Imported order ${orderNumber} with ${items.length} items`
    );

    return new Response(
      JSON.stringify({ success: true, order_number: orderNumber, items: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
