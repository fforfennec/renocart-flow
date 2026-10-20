import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommanderDeliveryHints, type DeliveryHintValues } from "./CommanderDeliveryHints";

afterEach(cleanup);
const complete: DeliveryHintValues = {
  delivery_date: "2026-10-22", time_window: "AM", truck_type: "Boom",
  address1: "100 rue Test", city: "Montréal", province: "QC", postal_code: "H2X 1Y4",
};
function setup(values = complete) {
  const onPatch = vi.fn();
  function Harness() {
    const [current, setCurrent] = useState(values);
    return <CommanderDeliveryHints values={current} lang="fr" onPatch={(patch) => {
      onPatch(patch); setCurrent((previous) => ({ ...previous, ...patch }));
    }} />;
  }
  render(<Harness />);
  return onPatch;
}
describe("Editing preselected delivery details", () => {
  it("replaces the day even when all delivery details are complete", () => {
    const onPatch = setup();
    fireEvent.click(screen.getByRole("button", { name: "Changer : Journée de livraison" }));
    fireEvent.click(screen.getByRole("button", { name: "Après-demain" }));
    const date = new Date(); date.setDate(date.getDate() + 2);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    expect(onPatch).toHaveBeenCalledWith({ delivery_date: expected });
  });
  it("replaces a preselected morning time with afternoon", () => {
    const onPatch = setup();
    fireEvent.click(screen.getByRole("button", { name: "Changer : Moment de la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Après-midi", exact: true }));
    expect(onPatch).toHaveBeenCalledWith({ time_window: "PM" });
  });
  it("replaces a preselected boom truck with a cube truck", () => {
    const onPatch = setup();
    fireEvent.click(screen.getByRole("button", { name: "Changer : Camion" }));
    fireEvent.click(screen.getByRole("button", { name: "Camion cube", exact: true }));
    expect(onPatch).toHaveBeenCalledWith({ truck_type: "Van/Cube" });
  });
});