import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommanderDelivery, type DeliveryFormValues } from "./CommanderDelivery";

const empty: DeliveryFormValues = { delivery_date: "", time_window: "", truck_type: "", note: "", address1: "", city: "", province: "QC", postal_code: "", contact_name: "", contact_phone: "" };
describe("Commander delivery", () => {
  it("requires missing delivery details before payment", () => {
    render(<CommanderDelivery initial={empty} lang="fr" busy={false} onBack={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Journée de livraison")).toBeRequired();
    expect(screen.getByLabelText("Adresse de livraison")).toBeRequired();
    expect(screen.getByLabelText("Moment de la journée")).toBeRequired();
    expect(screen.getByLabelText("As-tu besoin d'un camion particulier ?")).toBeRequired();
  });
  it("preserves edits when returning to the shopping list", () => {
    const back = vi.fn();
    render(<CommanderDelivery initial={{ ...empty, address1: "123 rue du Test" }} lang="fr" busy={false} onBack={back} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Adresse de livraison"), { target: { value: "456 rue du Test" } });
    fireEvent.click(screen.getByRole("button", { name: "Retour à ta liste d'achat" }));
    expect(back).toHaveBeenCalledWith(expect.objectContaining({ address1: "456 rue du Test" }));
  });
});