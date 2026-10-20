import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommanderMobileExperience } from "./CommanderMobileExperience";

vi.mock("./CommanderMobileScroll", () => ({ CommanderMobileScroll: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
afterEach(cleanup);
function setup(overrides = {}) {
  const onSend = vi.fn();
  const onPayment = vi.fn();
  render(<CommanderMobileExperience lang="fr" started={false} busy={false} recording={false} checkingOut={false} mayOrder hasItems
    cartLabel="1 produit · 2 unités" typed="2 feuilles de gypse" onTyped={vi.fn()} onSend={onSend} onPayment={onPayment}
    welcomeMic={null} composerMic={null} items={null} history={null} delivery={null} paymentFallback={null} removalNotice={null} {...overrides} />);
  return { onSend, onPayment };
}
describe("Mobile order actions", () => {
  it("submits the writing option through the existing order handler", () => {
    const { onSend } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });
  it("does not submit while the microphone is recording", () => {
    const { onSend } = setup({ recording: true });
    fireEvent.submit(screen.getByRole("textbox").closest("form") as HTMLFormElement);
    expect(onSend).not.toHaveBeenCalled();
  });
  it("opens delivery before payment, then uses the existing checkout handler", () => {
    const { onPayment } = setup({ started: true });
    fireEvent.click(screen.getByRole("button", { name: "Compléter ma commande" }));
    expect(onPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Accéder au paiement" }));
    expect(onPayment).toHaveBeenCalledTimes(1);
  });
});