/**
 * Cart count shown in the /commander headers.
 * Returns an empty string while nothing is in the list, so the header never
 * announces an empty cart while the assistant is still working ("Je regarde ça…").
 */
export function formatCartLabel(products: number, units: number, lang: "fr" | "en"): string {
  if (products <= 0) return "";
  const fr = lang === "fr";
  const productWord = fr ? (products > 1 ? "produits" : "produit") : products > 1 ? "products" : "product";
  const unitWord = fr ? (units > 1 ? "unités" : "unité") : units > 1 ? "units" : "unit";
  return `${products} ${productWord} · ${units} ${unitWord}`;
}
