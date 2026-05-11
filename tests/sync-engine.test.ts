import { describe, it, expect, vi } from "vitest";
import { computeSyncActions } from "../app/services/compute-sync-actions.server";

describe("computeSyncActions — lowest-stock-wins", () => {
  it("no action when quantities match", () => {
    const actions = computeSyncActions([
      { ebayItemId: "1", ebayQty: 5, shopifyQty: 5, inventoryItemId: "i1", locationId: "l1" },
    ]);
    expect(actions).toHaveLength(0);
  });

  it("updates ebay when shopify is lower", () => {
    const actions = computeSyncActions([
      { ebayItemId: "1", ebayQty: 10, shopifyQty: 3, inventoryItemId: "i1", locationId: "l1" },
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].targetQty).toBe(3);
    expect(actions[0].updateEbay).toBe(true);
    expect(actions[0].updateShopify).toBe(false);
  });

  it("updates shopify when ebay is lower", () => {
    const actions = computeSyncActions([
      { ebayItemId: "1", ebayQty: 2, shopifyQty: 7, inventoryItemId: "i1", locationId: "l1" },
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].targetQty).toBe(2);
    expect(actions[0].updateEbay).toBe(false);
    expect(actions[0].updateShopify).toBe(true);
  });

  it("floors target at 0 when either side is negative", () => {
    const actions = computeSyncActions([
      { ebayItemId: "1", ebayQty: -1, shopifyQty: 5, inventoryItemId: "i1", locationId: "l1" },
    ]);
    expect(actions[0].targetQty).toBe(0);
  });

  it("handles multiple items independently", () => {
    const actions = computeSyncActions([
      { ebayItemId: "1", ebayQty: 5, shopifyQty: 5, inventoryItemId: "i1", locationId: "l1" },
      { ebayItemId: "2", ebayQty: 3, shopifyQty: 8, inventoryItemId: "i2", locationId: "l1" },
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].ebayItemId).toBe("2");
    expect(actions[0].targetQty).toBe(3);
  });
});
