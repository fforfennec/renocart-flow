import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommanderSuggestions } from "./CommanderSuggestions";
import { hasScrewWord, type Suggestion } from "@/lib/commanderSuggestions";

const suggestion = (name: string, recommended: boolean): Suggestion => ({ variantId: name, productId: name, productTitle: name, variantTitle: "Default Title", image: null, price: "20", currency: "CAD", available: true, quantity: 2, triggerCount: 40, reason: "Pour tes 40 feuilles", recommended, ruleIds: [name] });
describe("finishing suggestions", () => {
  it("blocks screws as words, not unrelated substrings", () => {
    for (const value of ["Vis à bois", "wood screws", "Screw", "VIS", "Vis-à-bois", "Clous", "clou", "nails"]) expect(hasScrewWord(value)).toBe(true);
    for (const value of ["Visière", "Adhésif", "Clouterie"]) expect(hasScrewWord(value)).toBe(false);
  });
  it("checks only recommended rows and submits selected quantity without a price", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<CommanderSuggestions suggestions={[suggestion("Composé", true), suggestion("Ruban", false)]} lang="fr" shortName={(s) => s} onAdd={onAdd} onDecline={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ajouter la sélection (1)" })).toBeInTheDocument();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Augmenter Composé" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la sélection (1)" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ productTitle: "Composé", quantity: 3 })]));
  });
});