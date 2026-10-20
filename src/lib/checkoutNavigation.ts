/** Reserve a tab during the click: Shopify refuses embedded checkout pages. */
export async function navigateToCheckout(createUrl: () => Promise<string>): Promise<void> {
  const embedded = window.self !== window.top;
  const tab = embedded ? window.open("about:blank", "_blank") : null;
  if (embedded && !tab) {
    throw new Error("Autorise l’ouverture d’un nouvel onglet pour accéder au paiement Shopify.");
  }
  if (tab) tab.opener = null;
  try {
    const url = await createUrl();
    if (tab) tab.location.replace(url);
    else window.location.assign(url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}