import { db } from "../db.server";
import { EbayClient, EbayCredentials, EbayListing } from "./ebay.server";
import { ShopifyAdminClient } from "./shopify-api.server";
import { decrypt } from "./crypto.server";

export async function runInitialImport(shop: string, accessToken: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const cred = await db.ebayCredential.findUniqueOrThrow({ where: { shop } });
  const ebay = new EbayClient({
    appId: decrypt(cred.appId),
    certId: decrypt(cred.certId),
    devId: decrypt(cred.devId),
    authToken: decrypt(cred.authToken),
    sellerId: cred.sellerId,
  });
  const shopify = new ShopifyAdminClient(shop, accessToken);

  const listings = await ebay.getSellerListings();
  const locationId = await shopify.getLocationId();
  const existingMappings = await db.skuMapping.findMany({ where: { shop } });
  const existingEbayIds = new Set(existingMappings.map((m) => m.ebayItemId));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const listing of listings) {
    if (existingEbayIds.has(listing.itemId)) {
      skipped++;
      continue;
    }

    try {
      const product = await shopify.createProduct({
        title: listing.title,
        body_html: listing.description,
        vendor: "eBay",
        product_type: listing.category ?? "",
        images: listing.images.slice(0, 12).map((src) => ({ src })),
        variants: [
          {
            title: "Default Title",
            price: String(listing.price),
            sku: `ebay-${listing.itemId}`,
            inventory_management: "shopify",
          },
        ],
      });

      const variant = product.variants[0];
      await shopify.connectInventoryToLocation(variant.inventoryItemId, locationId);
      await shopify.setInventoryLevel(locationId, variant.inventoryItemId, listing.quantity);

      await db.skuMapping.create({
        data: {
          shop,
          ebayItemId: listing.itemId,
          shopifyProductId: product.id,
          shopifyVariantId: variant.inventoryItemId,
          ebaysku: `ebay-${listing.itemId}`,
          shopifySku: variant.sku,
        },
      });

      imported++;
      // Respect Shopify rate limit: 2 req/sec
      await sleep(600);
    } catch (err: any) {
      errors.push(`eBay ${listing.itemId}: ${err.message}`);
    }
  }

  return { imported, skipped, errors };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
