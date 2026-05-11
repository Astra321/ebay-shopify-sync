/**
 * Demo data store — realistic mock data for the eBay ↔ Shopify Sync app.
 * Used when DEMO_MODE=true or when accessing /demo routes.
 * No real API calls, no database, no Redis required.
 */

export interface DemoSkuMapping {
  id: string;
  ebayItemId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  ebaysku: string;
  shopifySku: string;
  ebayTitle: string;
  shopifyTitle: string;
  ebayQty: number;
  shopifyQty: number;
  price: number;
  imageUrl: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface DemoSyncLog {
  id: string;
  shop: string;
  jobId: string;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  itemsSynced: number;
  errors: DemoSyncError[];
}

export interface DemoSyncError {
  id: string;
  ebayItemId: string | null;
  message: string;
  createdAt: string;
  syncStatus: "FAILED" | "PARTIAL";
}

// ─── Generate realistic demo SKU mappings ─────────────────────────

const PRODUCT_CATALOG = [
  { title: "Vintage Leather Messenger Bag", category: "Bags & Luggage", price: 89.99, image: "bag" },
  { title: "Wireless Bluetooth Earbuds Pro", category: "Electronics", price: 34.99, image: "earbuds" },
  { title: "Handcrafted Wooden Watch", category: "Jewelry & Watches", price: 129.99, image: "watch" },
  { title: "Organic Cotton T-Shirt (Unisex)", category: "Clothing", price: 24.99, image: "tshirt" },
  { title: "Stainless Steel Water Bottle 750ml", category: "Home & Garden", price: 19.99, image: "bottle" },
  { title: "Running Shoes - Lightweight Mesh", category: "Clothing", price: 64.99, image: "shoes" },
  { title: "Mechanical Keyboard RGB Backlit", category: "Electronics", price: 79.99, image: "keyboard" },
  { title: "Yoga Mat Premium Non-Slip 6mm", category: "Sporting Goods", price: 29.99, image: "yoga" },
  { title: "Ceramic Coffee Mug Set (4-Pack)", category: "Home & Garden", price: 22.99, image: "mug" },
  { title: "Polarized Sunglasses Aviator Style", category: "Jewelry & Watches", price: 44.99, image: "sunglasses" },
  { title: "Portable Bluetooth Speaker Waterproof", category: "Electronics", price: 49.99, image: "speaker" },
  { title: "Bamboo Cutting Board Set", category: "Home & Garden", price: 27.99, image: "cutting" },
  { title: "Silicone Kitchen Utensil Set (6-Piece)", category: "Home & Garden", price: 18.99, image: "utensils" },
  { title: "Canvas Backpack - Travel & School", category: "Bags & Luggage", price: 39.99, image: "backpack" },
  { title: "LED Desk Lamp with USB Charging Port", category: "Electronics", price: 36.99, image: "lamp" },
  { title: "Microfiber Bed Sheet Set Queen", category: "Home & Garden", price: 42.99, image: "sheets" },
  { title: "Resistance Bands Set (5 Levels)", category: "Sporting Goods", price: 14.99, image: "bands" },
  { title: "Electric Wine Opener - Rechargeable", category: "Home & Garden", price: 24.99, image: "wine" },
  { title: "Minimalist Leather Wallet Bifold", category: "Bags & Luggage", price: 32.99, image: "wallet" },
  { title: "Air Purifier HEPA Filter Compact", category: "Home & Garden", price: 89.99, image: "purifier" },
];

function generateMappings(): DemoSkuMapping[] {
  return PRODUCT_CATALOG.map((product, i) => {
    const ebayItemId = String(1100 + i * 7 + 3);
    const shopifyProductId = String(8200000000000 + i * 13);
    const shopifyVariantId = String(44000000000000 + i * 17);

    // Create quantity mismatches for some items to demonstrate sync
    let ebayQty: number;
    let shopifyQty: number;

    if (i % 5 === 0) {
      // Shopify has less (order sold on Shopify)
      ebayQty = 15 + i;
      shopifyQty = Math.max(0, ebayQty - 3 - (i % 4));
    } else if (i % 5 === 2) {
      // eBay has less (order sold on eBay)
      shopifyQty = 12 + i;
      ebayQty = Math.max(0, shopifyQty - 5 - (i % 3));
    } else if (i % 5 === 4) {
      // Both different but eBay lower
      shopifyQty = 20 + i;
      ebayQty = 8 + i;
    } else {
      // Matching quantities
      ebayQty = 10 + i;
      shopifyQty = 10 + i;
    }

    const hoursAgo = i * 3 + 1;
    const lastSynced = i % 3 === 0 ? null : new Date(Date.now() - hoursAgo * 3600000).toISOString();

    return {
      id: `demo-mapping-${i}`,
      ebayItemId,
      shopifyProductId,
      shopifyVariantId,
      ebaysku: `EBAY-${ebayItemId}`,
      shopifySku: `SHOPIFY-${shopifyProductId.slice(-6)}`,
      ebayTitle: product.title,
      shopifyTitle: product.title,
      ebayQty,
      shopifyQty,
      price: product.price,
      imageUrl: `https://picsum.photos/seed/${product.image}/200/200`,
      isActive: i !== 7, // one inactive mapping for variety
      lastSyncedAt: lastSynced,
      createdAt: new Date(Date.now() - (20 - i) * 86400000).toISOString(),
    };
  });
}

function generateSyncLogs(): DemoSyncLog[] {
  return [
    {
      id: "demo-log-1",
      shop: "demo-store.myshopify.com",
      jobId: "job-001",
      startedAt: new Date(Date.now() - 900000).toISOString(),
      finishedAt: new Date(Date.now() - 840000).toISOString(),
      status: "PARTIAL",
      itemsSynced: 4,
      errors: [
        {
          id: "demo-err-1",
          ebayItemId: "1114",
          message: "eBay API rate limit exceeded — ReviseInventoryStatus call failed",
          createdAt: new Date(Date.now() - 840000).toISOString(),
          syncStatus: "PARTIAL",
        },
      ],
    },
    {
      id: "demo-log-2",
      shop: "demo-store.myshopify.com",
      jobId: "job-002",
      startedAt: new Date(Date.now() - 1800000).toISOString(),
      finishedAt: new Date(Date.now() - 1740000).toISOString(),
      status: "SUCCESS",
      itemsSynced: 6,
      errors: [],
    },
    {
      id: "demo-log-3",
      shop: "demo-store.myshopify.com",
      jobId: "job-003",
      startedAt: new Date(Date.now() - 5400000).toISOString(),
      finishedAt: new Date(Date.now() - 5340000).toISOString(),
      status: "FAILED",
      itemsSynced: 0,
      errors: [
        {
          id: "demo-err-2",
          ebayItemId: null,
          message: "eBay API service unavailable (HTTP 503) — all sync operations failed",
          createdAt: new Date(Date.now() - 5340000).toISOString(),
          syncStatus: "FAILED",
        },
        {
          id: "demo-err-3",
          ebayItemId: "1103",
          message: "Connection timeout after 30s — eBay Trading API unresponsive",
          createdAt: new Date(Date.now() - 5340000).toISOString(),
          syncStatus: "FAILED",
        },
      ],
    },
  ];
}

// ─── Demo State (mutable — changes when "sync" runs) ──────────────

let mappings = generateMappings();
let syncLogs = generateSyncLogs();
let syncRunning = false;

export function getDemoMappings(): DemoSkuMapping[] {
  return [...mappings];
}

export function getDemoSyncLogs(): DemoSyncLog[] {
  return [...syncLogs];
}

export function getDemoErrors(): DemoSyncError[] {
  return syncLogs.flatMap((log) => log.errors);
}

export function isDemoSyncRunning(): boolean {
  return syncRunning;
}

/**
 * Simulate a sync run — applies lowest-stock-wins logic to demo data,
 * adds a short delay to simulate API calls, then updates the mappings.
 */
export async function runDemoSync(): Promise<{ synced: number; errors: number }> {
  if (syncRunning) return { synced: 0, errors: 0 };
  syncRunning = true;

  // Create a "RUNNING" log entry
  const runningLog: DemoSyncLog = {
    id: `demo-log-${Date.now()}`,
    shop: "demo-store.myshopify.com",
    jobId: `job-${Date.now()}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "RUNNING",
    itemsSynced: 0,
    errors: [],
  };
  syncLogs = [runningLog, ...syncLogs];

  // Simulate API latency
  await new Promise((r) => setTimeout(r, 1500));

  let synced = 0;
  const errors: DemoSyncError[] = [];

  // Apply lowest-stock-wins to each mapping
  mappings = mappings.map((m) => {
    if (!m.isActive) return m;

    const target = Math.max(0, Math.min(m.ebayQty, m.shopifyQty));
    const needsUpdate = m.ebayQty !== target || m.shopifyQty !== target;

    if (needsUpdate) {
      // Simulate occasional errors (1 in 10 chance)
      if (Math.random() < 0.1) {
        errors.push({
          id: `demo-err-${Date.now()}-${m.ebayItemId}`,
          ebayItemId: m.ebayItemId,
          message: `eBay API error: ReviseInventoryStatus for item ${m.ebayItemId} returned Ack=Warning`,
          createdAt: new Date().toISOString(),
          syncStatus: "PARTIAL",
        });
        return m; // Don't update this item
      }

      synced++;
      return {
        ...m,
        ebayQty: target,
        shopifyQty: target,
        lastSyncedAt: new Date().toISOString(),
      };
    }

    return m;
  });

  // Update the running log to completed
  syncLogs = syncLogs.map((log) =>
    log.id === runningLog.id
      ? {
          ...log,
          finishedAt: new Date().toISOString(),
          status: errors.length === 0 ? "SUCCESS" : synced > 0 ? "PARTIAL" : "FAILED",
          itemsSynced: synced,
          errors,
        }
      : log
  );

  syncRunning = false;
  return { synced, errors: errors.length };
}

/**
 * Simulate an eBay order — reduces eBay inventory for a random item.
 */
export function simulateEbayOrder(): DemoSkuMapping | null {
  const activeMappings = mappings.filter((m) => m.isActive && m.ebayQty > 0);
  if (activeMappings.length === 0) return null;

  const random = activeMappings[Math.floor(Math.random() * activeMappings.length)];
  const qtySold = Math.min(random.ebayQty, Math.floor(Math.random() * 3) + 1);

  mappings = mappings.map((m) =>
    m.id === random.id ? { ...m, ebayQty: Math.max(0, m.ebayQty - qtySold) } : m
  );

  return { ...random, ebayQty: Math.max(0, random.ebayQty - qtySold) };
}

/**
 * Simulate a Shopify order — reduces Shopify inventory for a random item.
 */
export function simulateShopifyOrder(): DemoSkuMapping | null {
  const activeMappings = mappings.filter((m) => m.isActive && m.shopifyQty > 0);
  if (activeMappings.length === 0) return null;

  const random = activeMappings[Math.floor(Math.random() * activeMappings.length)];
  const qtySold = Math.min(random.shopifyQty, Math.floor(Math.random() * 3) + 1);

  mappings = mappings.map((m) =>
    m.id === random.id ? { ...m, shopifyQty: Math.max(0, m.shopifyQty - qtySold) } : m
  );

  return { ...random, shopifyQty: Math.max(0, random.shopifyQty - qtySold) };
}

/**
 * Reset all demo data to initial state.
 */
export function resetDemoData(): void {
  mappings = generateMappings();
  syncLogs = generateSyncLogs();
  syncRunning = false;
}
