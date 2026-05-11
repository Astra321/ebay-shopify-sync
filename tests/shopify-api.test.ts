import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shopify.server module since we can't initialize the real SDK in tests
vi.mock("../app/shopify.server", () => ({
  default: {
    api: {
      clients: {
        Rest: vi.fn().mockImplementation(({ session }) => ({
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
        })),
      },
    },
  },
}));

import { ShopifyAdminClient } from "../app/services/shopify-api.server";

// Create a mock session object
const mockSession = {
  shop: "mystore.myshopify.com",
  accessToken: "shpat_token",
  id: "test-session-id",
  state: "test",
  isOnline: false,
  scope: "write_products,write_inventory",
  expires: null,
} as any;

describe("ShopifyAdminClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("constructs with a session object (access token handled by SDK)", () => {
    const client = new ShopifyAdminClient(mockSession);
    expect(client).toBeDefined();
  });

  it("calls getInventoryLevels via SDK Rest client", async () => {
    const mockGet = vi.fn().mockResolvedValue({
      body: {
        inventory_levels: [
          { inventory_item_id: 111, available: 5 },
          { inventory_item_id: 222, available: 8 },
        ],
      },
    });

    // Mock the Rest client constructor to return our mock
    const { default: shopify } = await import("../app/shopify.server");
    (shopify.api.clients.Rest as any).mockImplementation(() => ({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    }));

    const client = new ShopifyAdminClient(mockSession);
    const result = await client.getInventoryLevels(["111", "222"]);

    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "inventory_levels.json",
      })
    );
    expect(result["111"]).toBe(5);
    expect(result["222"]).toBe(8);
  });

  it("calls setInventoryLevel via SDK Rest client", async () => {
    const mockPost = vi.fn().mockResolvedValue({ body: {} });

    const { default: shopify } = await import("../app/shopify.server");
    (shopify.api.clients.Rest as any).mockImplementation(() => ({
      get: vi.fn(),
      post: mockPost,
      put: vi.fn(),
      delete: vi.fn(),
    }));

    const client = new ShopifyAdminClient(mockSession);
    await client.setInventoryLevel("loc_1", "inv_1", 7);

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "inventory_levels/set.json",
        data: { location_id: "loc_1", inventory_item_id: "inv_1", available: 7 },
      })
    );
  });
});
