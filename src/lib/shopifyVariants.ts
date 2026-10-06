import { storefrontApiRequest } from "@/lib/shopifyStorefront";

export type CatalogVariant = {
  id: string; title: string; availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  image: { url: string } | null;
  price: { amount: string; currencyCode: string };
};
export type VariantProduct = {
  id: string; title: string; options: { name: string; values: string[] }[];
  featuredImage: { url: string } | null; variants: CatalogVariant[];
};

const cache = new Map<string, Promise<VariantProduct | null>>();

async function readProduct(variantId: string): Promise<VariantProduct | null> {
  const result = await storefrontApiRequest(`query VariantProduct($id: ID!) {
    node(id: $id) { ... on ProductVariant { product {
      id title options { name values } featuredImage { url }
    } } }
  }`, { id: variantId });
  const product = result.data?.node?.product;
  if (!product) return null;
  const variants: CatalogVariant[] = [];
  let after: string | null = null;
  do {
    const page = await storefrontApiRequest(`query ProductVariants($id: ID!, $after: String) {
      node(id: $id) { ... on Product { variants(first: 250, after: $after) {
        nodes { id title availableForSale selectedOptions { name value } image { url } price { amount currencyCode } }
        pageInfo { hasNextPage endCursor }
      } } }
    }`, { id: product.id, after });
    const connection = page.data?.node?.variants;
    if (!connection) throw new Error("Impossible de charger les variantes Shopify.");
    variants.push(...connection.nodes);
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);
  return { ...product, variants };
}

export function getVariantProduct(variantId: string, fresh = false): Promise<VariantProduct | null> {
  if (!fresh) {
    const existing = cache.get(variantId);
    if (existing) return existing;
  }
  const request = readProduct(variantId).then((product) => {
    if (product) for (const variant of product.variants) cache.set(variant.id, Promise.resolve(product));
    return product;
  }).catch((error) => { cache.delete(variantId); throw error; });
  cache.set(variantId, request);
  return request;
}

export function matchesOptions(variant: CatalogVariant, selected: Record<string, string>) {
  return variant.selectedOptions.every((option) => selected[option.name] === option.value);
}