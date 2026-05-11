import axios from "axios";

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
  private base: string;
  private headers: Record<string, string>;

  constructor(shop: string, accessToken: string) {
    this.base = `https://${shop}/admin/api/2024-01`;
    this.headers = {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    };
  }

  async createProduct(data: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    images: Array<{ src: string }>;
    variants: Array<{ title: string; price: string; sku: string; inventory_management: string }>;
  }): Promise<ShopifyProduct> {
    const { data: res } = await axios.post(
      `${this.base}/products.json`,
      { product: data },
      { headers: this.headers }
    );
    return this.parseProduct(res.product);
  }

  async getLocationId(): Promise<string> {
    const { data } = await axios.get(`${this.base}/locations.json`, { headers: this.headers });
    return String(data.locations[0].id);
  }

  async getInventoryLevels(inventoryItemIds: string[]): Promise<Record<string, number>> {
    const ids = inventoryItemIds.join(",");
    const { data } = await axios.get(
      `${this.base}/inventory_levels.json?inventory_item_ids=${ids}&limit=250`,
      { headers: this.headers }
    );
    const result: Record<string, number> = {};
    for (const level of data.inventory_levels) {
      result[String(level.inventory_item_id)] = level.available ?? 0;
    }
    return result;
  }

  async setInventoryLevel(locationId: string, inventoryItemId: string, available: number): Promise<void> {
    await axios.post(
      `${this.base}/inventory_levels/set.json`,
      { location_id: locationId, inventory_item_id: inventoryItemId, available: Math.max(0, available) },
      { headers: this.headers }
    );
  }

  async connectInventoryToLocation(inventoryItemId: string, locationId: string): Promise<void> {
    await axios.post(
      `${this.base}/inventory_levels/connect.json`,
      { location_id: locationId, inventory_item_id: inventoryItemId },
      { headers: this.headers }
    );
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
