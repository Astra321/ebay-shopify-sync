import { getShopifyApi } from "../shopify.server";
import type { Session } from "@shopify/shopify-api";

export interface ShopifyProduct {
  id: string;
  variants: ShopifyVariant[];
}

export interface ShopifyVariant {
  id: string;
  inventoryItemId: string;
  sku: string;
  price: string;
  title: string;
}

/**
 * Shopify Admin API client that uses the official Shopify SDK's built-in
 * Rest client with the session's access token for authentication.
 * No manual token management needed — the SDK handles auth, rate limiting,
 * and API versioning automatically.
 */
export class ShopifyAdminClient {
  private client: InstanceType<ReturnType<typeof getShopifyApi>["clients"]["Rest"]>;
  private session: Session;

  constructor(session: Session) {
    this.session = session;
    this.client = new (getShopifyApi().clients.Rest)({ session });
  }

  async createProduct(data: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    images: Array<{ src: string }>;
    variants: Array<{ title: string; price: string; sku: string; inventory_management: string }>;
  }): Promise<ShopifyProduct> {
    const response = await this.client.post({
      path: "products.json",
      data: { product: data },
    });
    const body = response.body as any;
    return this.parseProduct(body.product);
  }

  async getLocationId(): Promise<string> {
    const response = await this.client.get({
      path: "locations.json",
    });
    const body = response.body as any;
    return String(body.locations[0].id);
  }

  async getInventoryLevels(inventoryItemIds: string[]): Promise<Record<string, number>> {
    const ids = inventoryItemIds.join(",");
    const response = await this.client.get({
      path: "inventory_levels.json",
      query: { inventory_item_ids: ids, limit: "250" },
    });
    const body = response.body as any;
    const result: Record<string, number> = {};
    for (const level of body.inventory_levels) {
      result[String(level.inventory_item_id)] = level.available ?? 0;
    }
    return result;
  }

  async setInventoryLevel(locationId: string, inventoryItemId: string, available: number): Promise<void> {
    await this.client.post({
      path: "inventory_levels/set.json",
      data: {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: Math.max(0, available),
      },
    });
  }

  async connectInventoryToLocation(inventoryItemId: string, locationId: string): Promise<void> {
    await this.client.post({
      path: "inventory_levels/connect.json",
      data: {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
      },
    });
  }

  private parseProduct(p: any): ShopifyProduct {
    return {
      id: String(p.id),
      variants: (p.variants ?? []).map((v: any) => ({
        id: String(v.id),
        inventoryItemId: String(v.inventory_item_id),
        sku: v.sku ?? "",
        price: String(v.price),
        title: v.title,
      })),
    };
  }
}
