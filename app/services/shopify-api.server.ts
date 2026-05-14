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

// admin.graphql() function from shopify-app-remix authenticate.admin()
type GraphqlFn = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

interface AdminClient {
  graphql: GraphqlFn;
}

// Convert numeric/string ID to Shopify GID (e.g. "123" -> "gid://shopify/Location/123")
function toGid(type: string, id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/${type}/${id}`;
}

// Extract numeric ID from a GID (e.g. "gid://shopify/Location/123" -> "123")
function fromGid(gid: string): string {
  const i = gid.lastIndexOf("/");
  return i >= 0 ? gid.slice(i + 1) : gid;
}

export class ShopifyAdminClient {
  private graphql: GraphqlFn;

  constructor(admin: AdminClient) {
    this.graphql = admin.graphql;
  }

  private async run<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await this.graphql(query, variables ? { variables } : undefined);
    const body = await res.json();
    if (body.errors) {
      throw new Error(`Shopify GraphQL error: ${JSON.stringify(body.errors)}`);
    }
    return body.data as T;
  }

  async getLocationId(): Promise<string> {
    const data = await this.run<{ locations: { edges: Array<{ node: { id: string } }> } }>(
      `#graphql
        query { locations(first: 1) { edges { node { id } } } }`,
    );
    if (!data.locations.edges.length) throw new Error("No locations found in Shopify store");
    return fromGid(data.locations.edges[0].node.id);
  }

  async createProduct(input: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    images: Array<{ src: string }>;
    variants: Array<{ title: string; price: string; sku: string; inventory_management: string }>;
  }): Promise<ShopifyProduct> {
    const v = input.variants[0];
    const data = await this.run<{
      productCreate: {
        product: {
          id: string;
          variants: { edges: Array<{ node: { id: string; sku: string; price: string; title: string; inventoryItem: { id: string } } }> };
        } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(
      `#graphql
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              variants(first: 1) {
                edges { node { id sku price title inventoryItem { id } } }
              }
            }
            userErrors { field message }
          }
        }`,
      {
        input: {
          title: input.title,
          descriptionHtml: input.body_html,
          vendor: input.vendor,
          productType: input.product_type,
          variants: [
            {
              price: v.price,
              sku: v.sku,
              inventoryManagement: "SHOPIFY",
            },
          ],
        },
      },
    );

    if (data.productCreate.userErrors.length > 0) {
      throw new Error(`productCreate failed: ${data.productCreate.userErrors.map((e) => e.message).join(", ")}`);
    }
    const p = data.productCreate.product!;
    const variants: ShopifyVariant[] = p.variants.edges.map((e) => ({
      id: fromGid(e.node.id),
      inventoryItemId: fromGid(e.node.inventoryItem.id),
      sku: e.node.sku ?? "",
      price: String(e.node.price),
      title: e.node.title,
    }));
    return { id: fromGid(p.id), variants };
  }

  async getInventoryLevels(inventoryItemIds: string[]): Promise<Record<string, number>> {
    if (inventoryItemIds.length === 0) return {};
    const gids = inventoryItemIds.map((id) => toGid("InventoryItem", id));
    const data = await this.run<{
      nodes: Array<{
        id: string;
        inventoryLevels: { edges: Array<{ node: { quantities: Array<{ name: string; quantity: number }> } }> };
      } | null>;
    }>(
      `#graphql
        query getLevels($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on InventoryItem {
              id
              inventoryLevels(first: 5) {
                edges { node { quantities(names: ["available"]) { name quantity } } }
              }
            }
          }
        }`,
      { ids: gids },
    );

    const result: Record<string, number> = {};
    for (const node of data.nodes) {
      if (!node) continue;
      const itemId = fromGid(node.id);
      const firstLevel = node.inventoryLevels.edges[0]?.node;
      const available = firstLevel?.quantities.find((q) => q.name === "available")?.quantity ?? 0;
      result[itemId] = available;
    }
    return result;
  }

  async setInventoryLevel(locationId: string, inventoryItemId: string, available: number): Promise<void> {
    const data = await this.run<{
      inventorySetQuantities: { userErrors: Array<{ field: string[]; message: string }> };
    }>(
      `#graphql
        mutation setQty($input: InventorySetQuantitiesInput!) {
          inventorySetQuantities(input: $input) {
            userErrors { field message }
          }
        }`,
      {
        input: {
          name: "available",
          reason: "correction",
          ignoreCompareQuantity: true,
          quantities: [
            {
              inventoryItemId: toGid("InventoryItem", inventoryItemId),
              locationId: toGid("Location", locationId),
              quantity: Math.max(0, available),
            },
          ],
        },
      },
    );
    if (data.inventorySetQuantities.userErrors.length > 0) {
      throw new Error(`inventorySetQuantities failed: ${data.inventorySetQuantities.userErrors.map((e) => e.message).join(", ")}`);
    }
  }

  async connectInventoryToLocation(inventoryItemId: string, locationId: string): Promise<void> {
    const data = await this.run<{
      inventoryActivate: { userErrors: Array<{ field: string[]; message: string }> };
    }>(
      `#graphql
        mutation activate($inventoryItemId: ID!, $locationId: ID!) {
          inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId) {
            userErrors { field message }
          }
        }`,
      {
        inventoryItemId: toGid("InventoryItem", inventoryItemId),
        locationId: toGid("Location", locationId),
      },
    );
    if (data.inventoryActivate.userErrors.length > 0) {
      // "already activated" is fine — caller swallows errors anyway
      throw new Error(`inventoryActivate: ${data.inventoryActivate.userErrors.map((e) => e.message).join(", ")}`);
    }
  }
}
