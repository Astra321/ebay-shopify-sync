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

    // Step 1: create the product (no variants — productCreate in 2025-07 does not accept them inline)
    const createData = await this.run<{
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
        },
      },
    );

    if (createData.productCreate.userErrors.length > 0) {
      throw new Error(`productCreate: ${createData.productCreate.userErrors.map((e) => e.message).join(", ")}`);
    }
    const product = createData.productCreate.product!;
    const defaultVariant = product.variants.edges[0]?.node;
    if (!defaultVariant) {
      throw new Error("productCreate returned no default variant");
    }

    // Step 2: update the auto-created default variant with price + SKU
    const updateData = await this.run<{
      productVariantsBulkUpdate: {
        productVariants: Array<{ id: string; sku: string; price: string; title: string; inventoryItem: { id: string } }> | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(
      `#graphql
        mutation variantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id sku price title inventoryItem { id } }
            userErrors { field message }
          }
        }`,
      {
        productId: product.id,
        variants: [
          {
            id: defaultVariant.id,
            price: v.price,
            inventoryItem: { sku: v.sku, tracked: true },
          },
        ],
      },
    );

    if (updateData.productVariantsBulkUpdate.userErrors.length > 0) {
      throw new Error(`variantUpdate: ${updateData.productVariantsBulkUpdate.userErrors.map((e) => e.message).join(", ")}`);
    }
    const updated = updateData.productVariantsBulkUpdate.productVariants?.[0] ?? defaultVariant;
    const variants: ShopifyVariant[] = [
      {
        id: fromGid(updated.id),
        inventoryItemId: fromGid(updated.inventoryItem.id),
        sku: updated.sku ?? "",
        price: String(updated.price),
        title: updated.title,
      },
    ];
    return { id: fromGid(product.id), variants };
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
