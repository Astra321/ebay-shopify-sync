import { db } from "../db.server";
import { EbayClient } from "./ebay.server";
import { ShopifyAdminClient } from "./shopify-api.server";
import { decrypt } from "./crypto.server";
import { computeSyncActions, SyncItem, SyncAction } from "./compute-sync-actions.server";
import type { Session } from "@shopify/shopify-api";

export { computeSyncActions, SyncItem, SyncAction };

/**
 * Run the bidirectional inventory sync for a shop.
 * Uses the Shopify session's access token via the official SDK Rest client.
 * eBay credentials are decrypted at runtime; OAuth access tokens are preferred
 * over legacy Auth'n'Auth tokens when available.
 */
export async function runSync(shop: string, session: Session): Promise<{ synced: number; errors: Array<{ ebayItemId: string; message: string }> }> {
  const cred = await db.ebayCredential.findUniqueOrThrow({ where: { shop } });

  // Build eBay client — prefer OAuth access token over legacy auth token
  const ebay = new EbayClient({
    appId: decrypt(cred.appId),
    certId: decrypt(cred.certId),
    devId: decrypt(cred.devId),
    authToken: cred.authToken ? decrypt(cred.authToken) : "",
    sellerId: cred.sellerId,
    accessToken: cred.accessToken ? decrypt(cred.accessToken) : undefined,
    refreshToken: cred.refreshToken ? decrypt(cred.refreshToken) : undefined,
    accessTokenExpiry: cred.accessTokenExpiry ?? undefined,
  });

  // Shopify client uses the session's access token via SDK
  const shopifyClient = new ShopifyAdminClient(session);

  const mappings = await db.skuMapping.findMany({ where: { shop, isActive: true } });
  if (mappings.length === 0) return { synced: 0, errors: [] };

  const locationId = await shopifyClient.getLocationId();
  const inventoryItemIds = mappings.map((m) => m.shopifyVariantId);
  const [ebayQtys, shopifyQtys] = await Promise.all([
    ebay.getItemQuantities(mappings.map((m) => m.ebayItemId)),
    shopifyClient.getInventoryLevels(inventoryItemIds),
  ]);

  const syncItems: SyncItem[] = mappings.map((m) => ({
    ebayItemId: m.ebayItemId,
    ebayQty: ebayQtys[m.ebayItemId] ?? 0,
    shopifyQty: shopifyQtys[m.shopifyVariantId] ?? 0,
    inventoryItemId: m.shopifyVariantId,
    locationId,
  }));

  const actions = computeSyncActions(syncItems);
  const errors: Array<{ ebayItemId: string; message: string }> = [];
  let synced = 0;

  for (const action of actions) {
    try {
      if (action.updateShopify) {
        await shopifyClient.setInventoryLevel(action.locationId, action.inventoryItemId, action.targetQty);
      }
      if (action.updateEbay) {
        await ebay.updateQuantity(action.ebayItemId, action.targetQty);
      }
      await db.skuMapping.updateMany({
        where: { shop, ebayItemId: action.ebayItemId },
        data: { lastSyncedAt: new Date() },
      });
      synced++;
    } catch (err: any) {
      errors.push({ ebayItemId: action.ebayItemId, message: err.message });
    }
  }

  // Persist refreshed eBay OAuth token if it was updated during sync
  if (ebay.usesOAuth && (ebay as any).creds.accessToken) {
    const { encrypt } = await import("./crypto.server");
    await db.ebayCredential.update({
      where: { shop },
      data: {
        accessToken: encrypt((ebay as any).creds.accessToken),
        accessTokenExpiry: (ebay as any).creds.accessTokenExpiry,
      },
    });
  }

  return { synced, errors };
}
