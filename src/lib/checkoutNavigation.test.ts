import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutNavigationError, navigateToCheckout } from "./checkoutNavigation";

afterEach(() => vi.unstubAllGlobals());

describe("checkout navigation", () => {
  it("replaces the top-level page without opening another tab in an embedded preview", async () => {
    const top = { location: { href: "" } };
    const open = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("window", { self: {}, top, open, location: { assign } });
    await navigateToCheckout(async () => "https://renocart.ca/cart/c/test");
    expect(top.location.href).toBe("https://renocart.ca/cart/c/test");
    expect(open).not.toHaveBeenCalled();
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

  it("preserves the ready API checkout URL for a preview-only external link when top navigation is blocked", async () => {
    const location = {};
    Object.defineProperty(location, "href", { set: () => { throw new Error("Sandbox blocked"); } });
    const assign = vi.fn();
    vi.stubGlobal("window", { self: {}, top: { location }, location: { assign } });
    const error = await navigateToCheckout(async () => "https://renocart.ca/cart/c/test").catch((e) => e);
    expect(error).toBeInstanceOf(CheckoutNavigationError);
    expect(error.checkoutUrl).toBe("https://renocart.ca/cart/c/test");
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not open any page if checkout creation fails", async () => {
    const open = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("window", { self: {}, top: {}, open, location: { assign } });
    await expect(navigateToCheckout(async () => { throw new Error("Shopify unavailable"); })).rejects.toThrow("Shopify unavailable");
    expect(open).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});