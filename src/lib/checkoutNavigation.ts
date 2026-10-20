export class CheckoutNavigationError extends Error {
  constructor(public readonly checkoutUrl: string) {
    super("L’aperçu bloque la redirection automatique. Clique sur Accéder au paiement pour continuer dans cet onglet.");
    this.name = "CheckoutNavigationError";
  }
}

/** Shopify must replace the top-level page, never render within the preview frame. */
export async function navigateToCheckout(createUrl: () => Promise<string>): Promise<void> {
  const url = await createUrl();
  if (window.self === window.top) {
    window.location.assign(url);
    return;
  }
  try {
    if (!window.top) throw new Error("No top-level window");
    window.top.location.href = url;
  } catch {
    throw new CheckoutNavigationError(url);
  }
}