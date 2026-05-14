import type { Session } from "@shopify/shopify-api";

const API_VERSION = "2025-07";

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

export class ShopifyAdminClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(session: Session) {
    this.baseUrl = `https://${session.shop}/admin/api/${API_VERSION}`;
    this.accessToken = session.accessToken!;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API ${res.status} on ${method} ${path}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async createProduct(data: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    images: Array<{ src: string }>;
    variants: Array<{ title: string; price: string; sku: string; inventory_management: string }>;
  }): Promise<ShopifyProduct> {
    const body = await this.request<{ product: any }>("POST", "products.json", { product: data });
    return this.parseProduct(body.product);
  }

  async getLocationId(): Promise<string> {
    const body = await this.request<{ locations: any[] }>("GET", "locations.json");
    if (!body.locations?.length) throw new Error("No locations found in Shopify store");
    return String(body.locations[0].id);
  }

  async getInventoryLevels(inventoryItemIds: string[]): Promise<Record<string, number>> {
    const ids = inventoryItemIds.join(",");
    const body = await this.request<{ inventory_levels: any[] }>(
      "GET",
      `inventory_levels.json?inventory_item_ids=${encodeURIComponent(ids)}&limit=250`,
    );
    const result: Record<string, number> = {};
    for (const level of body.inventory_levels) {
      result[String(level.inventory_item_id)] = level.available ?? 0;
    }
    return result;
  }

  async setInventoryLevel(locationId: string, inventoryItemId: string, available: number): Promise<void> {
    await this.request("POST", "inventory_levels/set.json", {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: Math.max(0, available),
    });
  }

  async connectInventoryToLocation(inventoryItemId: string, locationId: string): Promise<void> {
    await this.request("POST", "inventory_levels/connect.json", {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
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
