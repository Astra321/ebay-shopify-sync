import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("axios");
import axios from "axios";
const mockedAxios = vi.mocked(axios, true);

import { ShopifyAdminClient } from "../app/services/shopify-api.server";

const client = new ShopifyAdminClient("mystore.myshopify.com", "shpat_token");

describe("ShopifyAdminClient.getInventoryLevels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns variant inventory map", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: {
        inventory_levels: [
          { inventory_item_id: 111, available: 5 },
          { inventory_item_id: 222, available: 8 },
        ],
      },
    });
    const result = await client.getInventoryLevels(["111", "222"]);
    expect(result["111"]).toBe(5);
    expect(result["222"]).toBe(8);
  });
});

describe("ShopifyAdminClient.setInventoryLevel", () => {
  it("calls inventory_levels/set with correct params", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: {} });
    await client.setInventoryLevel("loc_1", "inv_1", 7);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining("inventory_levels/set.json"),
      { location_id: "loc_1", inventory_item_id: "inv_1", available: 7 },
      expect.any(Object)
    );
  });
});
