// Public Shopify Storefront API (read products, create checkout). Token is publishable.
export const SHOPIFY_STORE_PERMANENT_DOMAIN = "e5ec80-69.myshopify.com";
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/2025-07/graphql.json`;
const SHOPIFY_STOREFRONT_TOKEN = "220d62212479a424adc1837c2bc4f023";

export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 402) throw new Error("Shopify: un forfait payant est requis pour la boutique.");
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(data.errors.map((e: { message: string }) => e.message).join(", "));
  return data;
}

const CART_CREATE = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }`;

export async function createCheckout(
  lines: { merchandiseId: string; quantity: number }[],
  attributes: { key: string; value: string }[],
  note: string,
): Promise<string> {
  const data = await storefrontApiRequest(CART_CREATE, { input: { lines, attributes, note } });
  const errs = data?.data?.cartCreate?.userErrors || [];
  if (errs.length) throw new Error(errs.map((e: { message: string }) => e.message).join(", "));
  const url = data?.data?.cartCreate?.cart?.checkoutUrl;
  if (!url) throw new Error("Impossible de créer le panier");
  const u = new URL(url);
  u.searchParams.set("channel", "online_store");
  return u.toString();
}
