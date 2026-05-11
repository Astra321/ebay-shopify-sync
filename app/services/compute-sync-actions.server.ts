export interface SyncItem {
  ebayItemId: string;
  ebayQty: number;
  shopifyQty: number;
  inventoryItemId: string;
  locationId: string;
}

export interface SyncAction {
  ebayItemId: string;
  inventoryItemId: string;
  locationId: string;
  targetQty: number;
  updateEbay: boolean;
  updateShopify: boolean;
}

/**
 * Computes the sync actions needed based on the lowest-stock-wins conflict rule.
 * When eBay and Shopify quantities differ, the lower quantity wins to prevent overselling.
 * The target quantity is floored at 0 to prevent negative inventory values.
 */
export function computeSyncActions(items: SyncItem[]): SyncAction[] {
  const actions: SyncAction[] = [];

  for (const item of items) {
    const target = Math.max(0, Math.min(item.ebayQty, item.shopifyQty));
    const needsEbayUpdate = item.ebayQty !== target;
    const needsShopifyUpdate = item.shopifyQty !== target;

    if (needsEbayUpdate || needsShopifyUpdate) {
      actions.push({
        ebayItemId: item.ebayItemId,
        inventoryItemId: item.inventoryItemId,
        locationId: item.locationId,
        targetQty: target,
        updateEbay: needsEbayUpdate,
        updateShopify: needsShopifyUpdate,
      });
    }
  }

  return actions;
}
