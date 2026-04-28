import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "e5ec80-69.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";

interface ShopifyOrder {
  id: number;
  name: string;
  note: string | null;
  shipping_address?: {
    address1: string;
    address2?: string;
    city: string;
    province_code: string;
    zip: string;
    country: string;
    name: string;
    phone: string | null;
  };
  line_items: Array<{
    name: string;
    title?: string;
    quantity: number;
    sku: string | null;
    image?: { src: string } | null;
    product_id: number;
    variant_id: number;
    product_type?: string | null;
    vendor?: string | null;
  }>;
  created_at: string;
  fulfillment_status: string | null;
  financial_status: string;
  customer?: {
    first_name: string;
    last_name: string;
    phone: string | null;
  };
}

async function fetchShopifyOrders(
  accessToken: string,
  orderNumbers?: string[]
): Promise<ShopifyOrder[]> {
  let url = `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=50`;

  if (orderNumbers && orderNumbers.length > 0) {
    const names = orderNumbers.map((n) => n.replace("#", "")).join(",");
    url += `&name=${names}`;
  }

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify API error [${response.status}]: ${body}`);
  }

  const data = await response.json();
  return data.orders || [];
}

async function fetchProductImage(
  productId: number,
  accessToken: string
): Promise<string | null> {
  try {
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}/images.json?limit=1`;
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      await res.text();
      return null;
    }

    const data = await res.json();
    return data.images?.[0]?.src || null;
  } catch (e) {
    console.error(`Failed to fetch image for product ${productId}:`, e);
    return null;
  }
}

function buildAddress(addr: ShopifyOrder["shipping_address"]): string {
  if (!addr) return "N/A";
  const parts = [addr.address1, addr.address2, addr.city, addr.province_code, addr.zip, addr.country].filter(Boolean);
  return parts.join(", ");
}

async function buildItemsWithImages(
  orderId: string,
  lineItems: ShopifyOrder["line_items"],
  shopifyToken: string,
) {
  const items = [];

  for (let idx = 0; idx < lineItems.length; idx++) {
    const item = lineItems[idx];
    let imageUrl = item.image?.src || null;

    if (!imageUrl && item.product_id) {
      imageUrl = await fetchProductImage(item.product_id, shopifyToken);
    }

    items.push({
      order_id: orderId,
      name: item.name || item.title || "Unknown item",
      quantity: item.quantity,
      sku: item.sku || null,
      image_url: imageUrl,
      sort_order: idx,
      client_note: null,
      product_type: item.product_type || null,
      vendor: item.vendor || null,
    });
  }

  return items;
}

async function backfillExistingOrderImages(
  supabase: ReturnType<typeof createClient>,
  existingOrderId: string,
  lineItems: ShopifyOrder["line_items"],
  shopifyToken: string,
) {
  const { data: existingItems, error } = await supabase
    .from("order_items")
    .select("id, sort_order, image_url")
    .eq("order_id", existingOrderId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  let updated = 0;

  for (let idx = 0; idx < lineItems.length; idx++) {
    const dbItem = existingItems?.find((item) => (item.sort_order ?? 0) === idx);
    if (!dbItem || dbItem.image_url) continue;

    const lineItem = lineItems[idx];
    let imageUrl = lineItem.image?.src || null;

    if (!imageUrl && lineItem.product_id) {
      imageUrl = await fetchProductImage(lineItem.product_id, shopifyToken);
    }

    if (!imageUrl) continue;

    const { error: updateError } = await supabase
      .from("order_items")
      .update({ image_url: imageUrl })
      .eq("id", dbItem.id);

    if (updateError) {
      console.error(`Failed to update image for item ${dbItem.id}:`, updateError);
      continue;
    }

    updated++;
  }

  return updated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    if (!shopifyToken) {
      return new Response(
        JSON.stringify({ success: false, error: "SHOPIFY_ACCESS_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { order_numbers } = body as { order_numbers?: string[] };

    console.log("Fetching Shopify orders:", order_numbers || "latest");

    const shopifyOrders = await fetchShopifyOrders(shopifyToken, order_numbers);
    console.log(`Found ${shopifyOrders.length} orders from Shopify`);

    if (shopifyOrders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, updated_images: 0, message: "No orders found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderNums = shopifyOrders.map((o) => o.name.replace("#", ""));
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("id, order_number")
      .in("order_number", orderNums);

    const existingMap = new Map((existingOrders || []).map((order) => [order.order_number, order.id]));

    let imported = 0;
    let updatedImages = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const shopifyOrder of shopifyOrders) {
      const orderNumber = shopifyOrder.name.replace("#", "");
      const existingOrderId = existingMap.get(orderNumber);

      if (existingOrderId) {
        try {
          const updated = await backfillExistingOrderImages(
            supabase,
            existingOrderId,
            shopifyOrder.line_items,
            shopifyToken,
          );
          updatedImages += updated;
          if (updated === 0) skipped++;
          console.log(`Backfilled ${updated} images for existing order ${orderNumber}`);
        } catch (error) {
          console.error(`Failed to backfill existing order ${orderNumber}:`, error);
          errors.push(`${orderNumber}: ${error instanceof Error ? error.message : "Backfill failed"}`);
        }
        continue;
      }

      const addr = shopifyOrder.shipping_address;
      const contactName = addr?.name ||
        (shopifyOrder.customer ? `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}` : "N/A");
      const contactPhone = addr?.phone || shopifyOrder.customer?.phone || null;

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
        errors.push(`${orderNumber}: ${orderErr.message}`);
        continue;
      }

      const items = await buildItemsWithImages(newOrder.id, shopifyOrder.line_items, shopifyToken);

      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from("order_items")
          .insert(items);

        if (itemsErr) {
          console.error(`Failed to insert items for ${orderNumber}:`, itemsErr);
          errors.push(`${orderNumber} items: ${itemsErr.message}`);
          continue;
        }
      }

      imported++;
      console.log(`Imported order ${orderNumber} with ${items.length} items`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated_images: updatedImages,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing orders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
