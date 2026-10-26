// Size-substitution feature (removable): when the requested size is not in the catalog
// but another size of the same product is, the AI adds that size and reports what it replaces.
// To revert: set SUBSTITUTION_ENABLED = false (or delete this file and its 3 imports in index.ts).
export const SUBSTITUTION_ENABLED = true;

export function withReplaces(itemsSchema: any) {
  if (!SUBSTITUTION_ENABLED) return itemsSchema;
  const item = itemsSchema.items;
  return {
    ...itemsSchema,
    items: {
      ...item,
      required: [...item.required, "replaces"],
      properties: {
        ...item.properties,
        replaces: { type: ["string", "null"], description: "Customer wording of the unavailable size this line replaces, else null" },
      },
    },
  };
}

export const SUBSTITUTION_PROMPT = SUBSTITUTION_ENABLED
  ? `- Size substitution: if the exact size/dimension/coverage requested is NOT in the catalog but the same product exists in another size, ` +
    `add the closest available size (prefer the next larger) and set "replaces" to the requested item as the customer said it, in their language, without leading article or quantity ` +
    `(e.g. "rouleau de pare-vapeur de 1500 pi²"). Otherwise "replaces" = null. Only when no size of that product exists, use unavailable.\n`
  : "";

export function replacesOf(it: any): string | null {
  return SUBSTITUTION_ENABLED && typeof it?.replaces === "string" && it.replaces.trim() ? it.replaces.trim() : null;
}
