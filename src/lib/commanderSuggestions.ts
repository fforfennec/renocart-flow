import { supabase } from "@/integrations/supabase/client";

export type SuggestionItem = {
  variantId: string; productTitle: string; variantTitle: string; image: string | null;
  price: string; currency: string; available: boolean; quantity: number;
};
export type Suggestion = SuggestionItem & { productId: string; ruleIds: string[]; triggerCount: number; reason: string; recommended: boolean };
export type SuggestionState = {
  sessionId: string; status: "idle" | "pending" | "accepted" | "declined" | "none";
  suggestions: Suggestion[]; accepted: Suggestion[]; hidden: boolean; lastSig: string;
};
export const newSuggestionState = (): SuggestionState => ({ sessionId: crypto.randomUUID(), status: "idle", suggestions: [], accepted: [], hidden: false, lastSig: "" });
// Permanent ban: screws and nails are never suggested.
export const hasScrewWord = (s: string) => /(^|[^\p{L}\p{N}])(vis|screws?|clous?|nails?)(?=$|[^\p{L}\p{N}])/iu.test(s);
export async function suggestionsRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("commander-suggestions", { body });
  if (error) {
    let message = "Les suggestions sont temporairement indisponibles.";
    try { const value = await error.context?.json(); if (value?.error) message = value.error; } catch { /* retain readable error */ }
    throw new Error(message);
  }
  return data as T;
}
export async function evaluateSuggestions(items: SuggestionItem[], include: string[] = []) {
  const result = await suggestionsRequest<{ suggestions: Suggestion[] }>({ action: "evaluate", cart: items.map(({ variantId, quantity }) => ({ variantId, quantity })), include });
  return result.suggestions.filter((s) => !hasScrewWord(`${s.productTitle} ${s.variantTitle} ${s.reason}`));
}