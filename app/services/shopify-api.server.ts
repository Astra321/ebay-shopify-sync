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

// Minimal shape of the admin.rest client returned by Shopify App Remix authenticate.admin()
interface AdminRest {
  get(args: { path: string; query?: Record<string, string | number> }): Promise<Response>;
  post(args: { path: string; data?: unknown }): Promise<Response>;
  put(args: { path: string; data?: unknown }): Promise<Response>;
  delete(args: { path: string }): Promise<Response>;
}

interface AdminClient {
  rest: AdminRest;
}

export class ShopifyAdminClient {
  private rest: AdminRest;

  constructor(admin: AdminClient) {
    this.rest = admin.rest;
  }

  private async readJson(res: Response, method: string, path: string): Promise<any> {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API ${res.status} on ${method} ${path}: ${text}`);
    }
    return res.json();
  }

  async createProduct(data: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    images: Array<{ src: string }>;
    variants: Array<{ title: string; price: string; sku: string; inventory_management: string }>;
  }): Promise<ShopifyProduct> {
    const res = await this.rest.post({ path: "products", data: { product: data } });
    const body = await this.readJson(res, "POST", "products");
    return this.parseProduct(body.product);
  }

  async getLocationId(): Promise<string> {
    const res = await this.rest.get({ path: "locations" });
    const body = await this.readJson(res, "GET", "locations");
    if (!body.locations?.length) throw new Error("No locations found in Shopify store");
    return String(body.locations[0].id);
  }

  async getInventoryLevels(inventoryItemIds: string[]): Promise<Record<string, number>> {
    const res = await this.rest.get({
      path: "inventory_levels",
      query: { inventory_item_ids: inventoryItemIds.join(","), limit: 250 },
    });
    const body = await this.readJson(res, "GET", "inventory_levels");
    const result: Record<string, number> = {};
    for (const level of body.inventory_levels) {
      result[String(level.inventory_item_id)] = level.available ?? 0;
    }
    return result;
  }

  async setInventoryLevel(locationId: string, inventoryItemId: string, available: number): Promise<void> {
    const res = await this.rest.post({
      path: "inventory_levels/set",
      data: {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: Math.max(0, available),
      },
    });
    await this.readJson(res, "POST", "inventory_levels/set");
  }

  async connectInventoryToLocation(inventoryItemId: string, locationId: string): Promise<void> {
    const res = await this.rest.post({
      path: "inventory_levels/connect",
      data: { location_id: locationId, inventory_item_id: inventoryItemId },
    });
    await this.readJson(res, "POST", "inventory_levels/connect");
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
