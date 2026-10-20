import { describe, expect, it } from "vitest";
import { formatCartLabel } from "./commanderCartLabel";

describe("formatCartLabel", () => {
  it("returns no label while the list is empty, so the header never says it is empty", () => {
    expect(formatCartLabel(0, 0, "fr")).toBe("");
    expect(formatCartLabel(0, 0, "en")).toBe("");
  });

  it("counts products and units once items exist", () => {
    expect(formatCartLabel(1, 2, "fr")).toBe("1 produit · 2 unités");
    expect(formatCartLabel(2, 1, "fr")).toBe("2 produits · 1 unité");
    expect(formatCartLabel(1, 1, "en")).toBe("1 product · 1 unit");
    expect(formatCartLabel(3, 5, "en")).toBe("3 products · 5 units");
  });
});
