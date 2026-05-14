import { db } from "../db.server";
import { EbayClient } from "./ebay.server";
import { ShopifyAdminClient } from "./shopify-api.server";
import { decrypt } from "./crypto.server";
import { computeSyncActions } from "./compute-sync-actions.server";
import type { SyncItem, SyncAction } from "./compute-sync-actions.server";

export { computeSyncActions };
export type { SyncItem, SyncAction };

/**
 * Dry-run sync: computes actions WITHOUT applying them.
 * Returns per-SKU current quantities and the proposed target so the UI can
 * show the user exactly what a real sync would change.
 */
export async function previewSync(shop: string, admin: any): Promise<{
  preview: Array<{
    ebayItemId: string;
    shopifyQty: number;
    ebayQty: number;
    targetQty: number;
    willUpdateShopify: boolean;
    willUpdateEbay: boolean;
  }>;
  totalMapped: number;
  actionsCount: number;
  unreachable?: string;
}> {
  const mappings = await db.skuMapping.findMany({ where: { shop, isActive: true } });
  if (mappings.length === 0) return { preview: [], totalMapped: 0, actionsCount: 0 };

  const cred = await db.ebayCredential.findUnique({ where: { shop } });
  if (!cred) return { preview: [], totalMapped: mappings.length, actionsCount: 0, unreachable: "eBay not connected" };

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
  const shopifyClient = new ShopifyAdminClient(admin);

  const locationId = await shopifyClient.getLocationId();
  const inventoryItemIds = mappings.map((m) => m.shopifyVariantId);

  // Fetch per-SKU eBay qty via getInventoryItem (fast path) instead of full seller listings
  const ebayQtys: Record<string, number> = {};
  await Promise.all(mappings.map(async (m) => {
    try {
      const item = await ebay.getInventoryItem(m.ebayItemId);
      ebayQtys[m.ebayItemId] = item?.quantity ?? 0;
    } catch {
      ebayQtys[m.ebayItemId] = 0;
    }
  }));

  const shopifyQtys = await shopifyClient.getInventoryLevels(inventoryItemIds);

  const syncItems: SyncItem[] = mappings.map((m) => ({
    ebayItemId: m.ebayItemId,
    ebayQty: ebayQtys[m.ebayItemId] ?? 0,
    shopifyQty: shopifyQtys[m.shopifyVariantId] ?? 0,
    inventoryItemId: m.shopifyVariantId,
    locationId,
  }));

  const actions = computeSyncActions(syncItems);
  const actionByItem = new Map(actions.map((a) => [a.ebayItemId, a]));

  const preview = syncItems.map((s) => {
    const a = actionByItem.get(s.ebayItemId);
    return {
      ebayItemId: s.ebayItemId,
      shopifyQty: s.shopifyQty,
      ebayQty: s.ebayQty,
      targetQty: a?.targetQty ?? Math.min(s.shopifyQty, s.ebayQty),
      willUpdateShopify: !!a?.updateShopify,
      willUpdateEbay: !!a?.updateEbay,
    };
  });

  return { preview, totalMapped: mappings.length, actionsCount: actions.length };
}

/**
 * Run the bidirectional inventory sync for a shop.
 * Uses the Shopify session's access token via the official SDK Rest client.
 * eBay credentials are decrypted at runtime; OAuth access tokens are preferred
 * over legacy Auth'n'Auth tokens when available.
 */
export async function runSync(shop: string, admin: any): Promise<{ synced: number; errors: Array<{ ebayItemId: string; message: string }> }> {
  // Create a syncLog upfront so polling endpoints can show live progress
  const log = await db.syncLog.create({ data: { shop, status: "RUNNING", itemsSynced: 0 } });
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

  // Shopify client uses the authenticated admin REST client (handles auth + tokens internally)
  const shopifyClient = new ShopifyAdminClient(admin);

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
      // Update live progress for the polling endpoint
      await db.syncLog.update({ where: { id: log.id }, data: { itemsSynced: synced } }).catch(() => {});
    } catch (err: any) {
      errors.push({ ebayItemId: action.ebayItemId, message: err.message });
      await db.syncError.create({
        data: { syncLogId: log.id, ebayItemId: action.ebayItemId, message: err.message },
      }).catch(() => {});
    }
  }

  // Finalize syncLog
  await db.syncLog.update({
    where: { id: log.id },
    data: {
      status: errors.length === 0 ? "SUCCESS" : synced > 0 ? "PARTIAL" : "FAILED",
      finishedAt: new Date(),
      itemsSynced: synced,
    },
  }).catch(() => {});

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
