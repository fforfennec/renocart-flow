import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommanderVariantSelector } from "./CommanderVariantSelector";
import { getVariantProduct, type CatalogVariant, type VariantProduct } from "@/lib/shopifyVariants";

vi.mock("@/lib/shopifyVariants", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/shopifyVariants")>(), getVariantProduct: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const variant = (id: string, thickness: string, size: string, available = true): CatalogVariant => ({
  id, title: `${thickness} / ${size}`, availableForSale: available,
  selectedOptions: [{ name: "Épaisseur", value: thickness }, { name: "Format", value: size }],
  image: { url: `${id}.png` }, price: { amount: "20.00", currencyCode: "CAD" },
});
const product: VariantProduct = {
  id: "product", title: "Gypse", featuredImage: null,
  options: [{ name: "Épaisseur", values: ["½ po", "5/8 po", "¾ po", "1 po"] }, { name: "Format", values: ["4x8", "4x10"] }],
  variants: [variant("current", "½ po", "4x8"), variant("other", "5/8 po", "4x8"),
    variant("unavailable", "¾ po", "4x8", false), variant("different", "1 po", "4x10")],
};

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getVariantProduct).mockResolvedValue(product); });

describe("Commander inline Shopify variant selector", () => {
  it("opens from the compact name/detail and switches the decrease control to removal at one", async () => {
    const decrease = vi.fn();
    const increase = vi.fn();
    render(<CommanderVariantSelector variantId="current" lang="fr" disabled={false} onConfirm={vi.fn()}
      row={{ title: "Gypse", detail: "½ po / 4x8", image: null, quantity: 1, onDecrease: decrease, onIncrease: increase }} />);
    const trigger = await screen.findByRole("button", { name: "Changer de format : Gypse" });
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(screen.queryByText("Changer de format", { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(decrease).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Augmenter la quantité" }));
    expect(increase).toHaveBeenCalledOnce();
    fireEvent.click(trigger);
    await screen.findByRole("button", { name: "½ po" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps a single-variant compact name inert without an arrow", async () => {
    vi.mocked(getVariantProduct).mockResolvedValue({ ...product, variants: [product.variants[0]] });
    const { container } = render(<CommanderVariantSelector variantId="current" lang="fr" disabled={false} onConfirm={vi.fn()}
      row={{ title: "Gypse", detail: "½ po / 4x8", image: null, quantity: 2, onDecrease: vi.fn(), onIncrease: vi.fn() }} />);
    await waitFor(() => expect(getVariantProduct).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Gypse ½ po / 4x8" })).toBeDisabled();
    expect(container.querySelector("[data-format-arrow]")).toBeNull();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("selects the current variant, disables unavailable and nonexistent combinations and confirms an available variant", async () => {
    const confirm = vi.fn();
    render(<CommanderVariantSelector variantId="current" lang="fr" disabled={false} onConfirm={confirm} />);
    fireEvent.click(await screen.findByRole("button", { name: "Changer de format" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "½ po" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "¾ po" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1 po" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "4x10" })).toBeDisabled();
    expect(screen.getByRole("region")).not.toHaveTextContent("20.00");
    fireEvent.click(screen.getByRole("button", { name: "5/8 po" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(product, product.variants[1], product.variants[0]));
    expect(screen.getByRole("button", { name: "Changer de format" })).toHaveAttribute("aria-expanded", "false");
  });

  it("discards the draft when cancelled and restores the current variant on reopen", async () => {
    const confirm = vi.fn();
    render(<CommanderVariantSelector variantId="current" lang="fr" disabled={false} onConfirm={confirm} />);
    const trigger = await screen.findByRole("button", { name: "Changer de format" });
    fireEvent.click(trigger);
    await screen.findByRole("button", { name: "5/8 po" });
    fireEvent.click(screen.getByRole("button", { name: "5/8 po" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("button", { name: "½ po" })).toHaveAttribute("aria-pressed", "true"));
  });

  it("hides the trigger for a single-variant product", async () => {
    vi.mocked(getVariantProduct).mockResolvedValue({ ...product, variants: [product.variants[0]] });
    const { container } = render(<CommanderVariantSelector variantId="current" lang="fr" disabled={false} onConfirm={vi.fn()} />);
    await waitFor(() => expect(getVariantProduct).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("rechecks availability before confirming", async () => {
    const confirm = vi.fn();
    render(<CommanderVariantSelector variantId="current" lang="fr" disabled={false} onConfirm={confirm} />);
    fireEvent.click(await screen.findByRole("button", { name: "Changer de format" }));
    fireEvent.click(await screen.findByRole("button", { name: "5/8 po" }));
    vi.mocked(getVariantProduct).mockResolvedValue({ ...product, variants: product.variants.map((v) => v.id === "other" ? { ...v, availableForSale: false } : v) });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "5/8 po" })).toBeDisabled());
    expect(confirm).not.toHaveBeenCalled();
  });
});