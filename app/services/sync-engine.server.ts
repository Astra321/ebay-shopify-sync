import { db } from "../db.server";
import { EbayClient } from "./ebay.server";
import { ShopifyAdminClient } from "./shopify-api.server";
import { decrypt } from "./crypto.server";
import { computeSyncActions, SyncItem, SyncAction } from "./compute-sync-actions.server";

export { computeSyncActions, SyncItem, SyncAction };

export async function runSync(shop: string, accessToken: string): Promise<{ synced: number; errors: Array<{ ebayItemId: string; message: string }> }> {
  const cred = await db.ebayCredential.findUniqueOrThrow({ where: { shop } });
  const ebay = new EbayClient({
    appId: decrypt(cred.appId),
    certId: decrypt(cred.certId),
    devId: decrypt(cred.devId),
    authToken: decrypt(cred.authToken),
    sellerId: cred.sellerId,
  });
  const shopifyClient = new ShopifyAdminClient(shop, accessToken);

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

  return { synced, errors };
}
