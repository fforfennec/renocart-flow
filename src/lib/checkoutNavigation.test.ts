import { afterEach, describe, expect, it, vi } from "vitest";
import { navigateToCheckout } from "./checkoutNavigation";

afterEach(() => vi.unstubAllGlobals());

describe("checkout navigation", () => {
  it("reserves an external tab before creating checkout in an embedded preview", async () => {
    const tab = { opener: {}, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.fn(() => tab);
    const assign = vi.fn();
    vi.stubGlobal("window", { self: {}, top: {}, open, location: { assign } });
    await navigateToCheckout(async () => {
      expect(open).toHaveBeenCalledWith("about:blank", "_blank");
      return "https://renocart.ca/cart/c/test";
    });
    expect(tab.location.replace).toHaveBeenCalledWith("https://renocart.ca/cart/c/test");
    expect(tab.opener).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps same-tab navigation on the standalone site", async () => {
    const frame = {};
    const assign = vi.fn();
    const open = vi.fn();
    vi.stubGlobal("window", { self: frame, top: frame, open, location: { assign } });
    await navigateToCheckout(async () => "https://renocart.ca/cart/c/test");
    expect(assign).toHaveBeenCalledWith("https://renocart.ca/cart/c/test");
    expect(open).not.toHaveBeenCalled();
  });

  it("does not create a cart or navigate inside the frame if popups are blocked", async () => {
    const createUrl = vi.fn();
    vi.stubGlobal("window", { self: {}, top: {}, open: () => null });
    await expect(navigateToCheckout(createUrl)).rejects.toThrow("nouvel onglet");
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("closes the reserved tab if checkout creation fails", async () => {
    const tab = { opener: null, close: vi.fn() };
    vi.stubGlobal("window", { self: {}, top: {}, open: () => tab });
    await expect(navigateToCheckout(async () => { throw new Error("Shopify unavailable"); })).rejects.toThrow("Shopify unavailable");
    expect(tab.close).toHaveBeenCalledOnce();
  });
});