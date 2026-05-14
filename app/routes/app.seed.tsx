import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner, Divider, List,
  InlineStack, Badge, IndexTable,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { ShopifyAdminClient } from "../services/shopify-api.server";
import { EbayClient } from "../services/ebay.server";
import { decrypt } from "../services/crypto.server";

const DEMO_PRODUCTS = [
  { title: "Wireless Bluetooth Headphones",  price: "49.99", shopifyQty: 20, ebayQty: 5,  sku: "DEMO-BT-HDPH-001", desc: "Wireless Bluetooth headphones with noise cancellation. 30h battery life." },
  { title: "USB-C Fast Charging Cable 2m",    price: "12.99", shopifyQty: 50, ebayQty: 8,  sku: "DEMO-USB-CABLE-002", desc: "Durable braided USB-C cable, 100W PD, 2m length." },
  { title: "Phone Stand Adjustable Desk Mount", price: "19.99", shopifyQty: 30, ebayQty: 3, sku: "DEMO-PHSTAND-003", desc: "Aluminum adjustable phone stand for desk use." },
  { title: "Mechanical Keyboard Tenkeyless",  price: "89.99", shopifyQty: 10, ebayQty: 2,  sku: "DEMO-MECH-KB-004", desc: "TKL mechanical keyboard, hot-swappable, RGB backlit." },
  { title: "LED Desk Lamp with USB Charging", price: "34.99", shopifyQty: 15, ebayQty: 4,  sku: "DEMO-LEDLAMP-005", desc: "LED desk lamp with USB-A charging port and dimmer." },
];

async function loadEbayClient(shop: string): Promise<EbayClient | null> {
  const cred = await db.ebayCredential.findUnique({ where: { shop } });
  if (!cred || !cred.refreshToken) return null;
  return new EbayClient({
    appId: decrypt(cred.appId),
    certId: decrypt(cred.certId),
    devId: decrypt(cred.devId),
    authToken: cred.authToken ? decrypt(cred.authToken) : "",
    sellerId: cred.sellerId,
    accessToken: cred.accessToken ? decrypt(cred.accessToken) : undefined,
    refreshToken: cred.refreshToken ? decrypt(cred.refreshToken) : undefined,
    accessTokenExpiry: cred.accessTokenExpiry ?? undefined,
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const mappings = await db.skuMapping.findMany({
    where: { shop, isActive: true },
    select: { ebayItemId: true, shopifyProductId: true, shopifyVariantId: true, ebaysku: true },
  });

  let ebayConnected = false;
  let status: Array<{ sku: string; title: string; shopifyQty: number | null; ebayQty: number | null; mismatch: boolean; error?: string }> = [];

  try {
    const ebay = await loadEbayClient(shop);
    ebayConnected = !!ebay;
    const shopify = new ShopifyAdminClient(admin as any);

    if (mappings.length > 0) {
      const inventoryIds = mappings.map((m) => m.shopifyVariantId);
      const shopifyQtys = await shopify.getInventoryLevels(inventoryIds);

      for (const m of mappings) {
        const sku = m.ebaysku ?? m.ebayItemId;
        let ebayQty: number | null = null;
        let ebayTitle = "";
        let error: string | undefined;
        if (ebay) {
          try {
            const item = await ebay.getInventoryItem(sku);
            ebayQty = item?.quantity ?? null;
            ebayTitle = item?.title ?? "";
          } catch (e: any) {
            error = e?.response?.data?.errors?.[0]?.message ?? e.message;
          }
        }
        const shopifyQty = shopifyQtys[m.shopifyVariantId] ?? null;
        status.push({
          sku,
          title: ebayTitle || sku,
          shopifyQty,
          ebayQty,
          mismatch: ebayQty !== null && shopifyQty !== null && ebayQty !== shopifyQty,
          error,
        });
      }
    }
  } catch (err: any) {
    console.error("[seed loader] status check failed:", err.message);
  }

  return json({ mappedCount: mappings.length, ebayConnected, status });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  // ─── Clear all mappings + delete eBay test items ─────────────────────
  if (intent === "clear") {
    const mappings = await db.skuMapping.findMany({ where: { shop } });
    const ebay = await loadEbayClient(shop);
    const errors: string[] = [];

    if (ebay) {
      for (const m of mappings) {
        try {
          await ebay.deleteInventoryItem(m.ebaysku ?? m.ebayItemId);
        } catch (err: any) {
          errors.push(`Delete ${m.ebayItemId}: ${err?.response?.data?.errors?.[0]?.message ?? err.message}`);
        }
      }
    }
    await db.skuMapping.deleteMany({ where: { shop } });
    await db.syncLog.deleteMany({ where: { shop } });
    return json({
      ok: errors.length === 0,
      message: `Cleared ${mappings.length} mapping(s).${errors.length > 0 ? ` ${errors.length} eBay delete error(s).` : ""}`,
      created: [],
      errors,
    });
  }

  // ─── Re-create mismatch (push Shopify back to seed quantities) ───────
  if (intent === "mismatch") {
    const shopifyClient = new ShopifyAdminClient(admin as any);
    const ebay = await loadEbayClient(shop);
    const errors: string[] = [];
    const updated: string[] = [];

    let locationId: string;
    try {
      locationId = await shopifyClient.getLocationId();
    } catch (err: any) {
      return json({ ok: false, message: `Shopify connection failed: ${err.message}`, created: [], errors: [] });
    }

    const mappings = await db.skuMapping.findMany({ where: { shop, isActive: true } });
    for (const m of mappings) {
      const demo = DEMO_PRODUCTS.find((d) => d.sku === m.ebayItemId);
      if (!demo) continue;
      try {
        await shopifyClient.setInventoryLevel(locationId, m.shopifyVariantId, demo.shopifyQty);
        if (ebay) {
          await ebay.createOrReplaceInventoryItem(demo.sku, {
            title: demo.title,
            description: demo.desc,
            quantity: demo.ebayQty,
          });
        }
        updated.push(`${demo.title} (Shopify: ${demo.shopifyQty}, eBay: ${demo.ebayQty})`);
      } catch (err: any) {
        errors.push(`${demo.title}: ${err?.response?.data?.errors?.[0]?.message ?? err.message}`);
      }
    }
    return json({
      ok: errors.length === 0,
      message: `Reset ${updated.length} item(s) to mismatched state.${ebay ? "" : " (eBay not connected — Shopify only)"}`,
      created: updated,
      errors,
    });
  }

  // ─── Seed new demo data ──────────────────────────────────────────────
  const shopifyClient = new ShopifyAdminClient(admin as any);
  const ebay = await loadEbayClient(shop);

  let locationId: string;
  try {
    locationId = await shopifyClient.getLocationId();
  } catch (err: any) {
    return json({ ok: false, message: `Could not connect to Shopify: ${err.message}`, created: [], errors: [] });
  }

  const created: string[] = [];
  const errors: string[] = [];

  for (const p of DEMO_PRODUCTS) {
    try {
      const existing = await db.skuMapping.findFirst({ where: { shop, ebayItemId: p.sku } });
      if (existing) {
        created.push(`${p.title} (already exists)`);
        continue;
      }

      // Step 1 — Shopify product + inventory at HIGHER quantity
      const product = await shopifyClient.createProduct({
        title: p.title,
        body_html: `<p>${p.desc}</p>`,
        vendor: "Demo Vendor",
        product_type: "Demo",
        images: [],
        variants: [{ title: "Default Title", price: p.price, sku: p.sku, inventory_management: "shopify" }],
      });
      const variant = product.variants[0];

      try { await shopifyClient.connectInventoryToLocation(variant.inventoryItemId, locationId); }
      catch { /* already connected */ }
      await shopifyClient.setInventoryLevel(locationId, variant.inventoryItemId, p.shopifyQty);

      // Step 2 — eBay inventory item at LOWER quantity (creates a mismatch)
      let ebayNote = "";
      if (ebay) {
        try {
          await ebay.createOrReplaceInventoryItem(p.sku, {
            title: p.title,
            description: p.desc,
            quantity: p.ebayQty,
          });
          ebayNote = ` (Shopify: ${p.shopifyQty}, eBay: ${p.ebayQty})`;
        } catch (ebayErr: any) {
          ebayNote = ` (eBay error: ${ebayErr?.response?.data?.errors?.[0]?.message ?? ebayErr.message})`;
        }
      } else {
        ebayNote = " (Shopify only — eBay not connected)";
      }

      // Step 3 — SKU mapping
      await db.skuMapping.create({
        data: {
          shop,
          ebayItemId: p.sku,
          shopifyProductId: product.id,
          shopifyVariantId: variant.inventoryItemId,
          ebaysku: p.sku,
          shopifySku: p.sku,
          isActive: true,
        },
      });

      created.push(`${p.title}${ebayNote}`);
    } catch (err: any) {
      errors.push(`${p.title}: ${err?.response?.data?.errors?.[0]?.message ?? err.message}`);
    }
  }

  if (created.length > 0) {
    await db.syncLog.create({
      data: {
        shop,
        status: "SUCCESS",
        itemsSynced: created.length,
        startedAt: new Date(Date.now() - 60_000),
        finishedAt: new Date(),
      },
    });
  }

  return json({
    ok: errors.length === 0,
    message: `Created ${created.length} product(s).${errors.length > 0 ? ` ${errors.length} failed.` : ""}${ebay ? "" : " ⚠️ Connect eBay in Settings to enable full sync testing."}`,
    created,
    errors,
  });
};

export default function SeedPage() {
  const { mappedCount, ebayConnected, status } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  const mismatchCount = status.filter((s) => s.mismatch).length;
  const errorCount = status.filter((s) => s.error).length;

  return (
    <Page title="Demo Seed & Test" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Banner tone="info" title="What this does">
              <List>
                <List.Item>Creates 5 demo products in Shopify with quantities 10–50</List.Item>
                <List.Item>Creates matching eBay inventory items with LOWER quantities (2–8)</List.Item>
                <List.Item>Links them via SKU mappings — this gives you an inventory mismatch by design</List.Item>
                <List.Item>Click <b>Run Sync Now</b> on the dashboard to see lowest-stock-wins in action</List.Item>
              </List>
            </Banner>

            {!ebayConnected && (
              <Banner tone="warning" title="eBay not connected">
                <Text as="p" variant="bodyMd">
                  Without eBay OAuth, seed will only create Shopify products. Connect eBay in Settings
                  to enable end-to-end sync testing.
                </Text>
              </Banner>
            )}

            {result && (
              <Banner tone={result.ok ? "success" : "warning"} title={result.message}>
                {result.created && result.created.length > 0 && (
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Done:</Text>
                    <List>
                      {result.created.map((name) => <List.Item key={name}>{name}</List.Item>)}
                    </List>
                  </BlockStack>
                )}
                {result.errors && result.errors.length > 0 && (
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Errors:</Text>
                    <List>
                      {result.errors.map((msg, i) => <List.Item key={i}>{msg}</List.Item>)}
                    </List>
                  </BlockStack>
                )}
              </Banner>
            )}

            {/* Live Status Card */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Live inventory status</Text>
                  <InlineStack gap="200">
                    {mismatchCount > 0 && <Badge tone="warning">{`${mismatchCount} mismatched`}</Badge>}
                    {mismatchCount === 0 && status.length > 0 && <Badge tone="success">In sync</Badge>}
                    {errorCount > 0 && <Badge tone="critical">{`${errorCount} error`}</Badge>}
                  </InlineStack>
                </InlineStack>
                <Divider />
                {status.length === 0 ? (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No mapped products yet. Click <b>Seed Demo Products</b> below to get started.
                  </Text>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "item", plural: "items" }}
                    itemCount={status.length}
                    selectable={false}
                    headings={[
                      { title: "SKU" },
                      { title: "Shopify qty" },
                      { title: "eBay qty" },
                      { title: "After sync (lowest wins)" },
                      { title: "Status" },
                    ]}
                  >
                    {status.map((s, i) => {
                      const winner = (s.shopifyQty !== null && s.ebayQty !== null)
                        ? Math.min(s.shopifyQty, s.ebayQty)
                        : null;
                      return (
                        <IndexTable.Row id={s.sku} key={s.sku} position={i}>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd" fontWeight="medium">{s.sku}</Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{s.shopifyQty ?? "—"}</IndexTable.Cell>
                          <IndexTable.Cell>
                            {s.error ? <Badge tone="critical">{s.error}</Badge> : (s.ebayQty ?? "—")}
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {winner !== null ? <Text as="span" variant="bodyMd" fontWeight="semibold">{winner}</Text> : "—"}
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {s.error ? (
                              <Badge tone="critical">Error</Badge>
                            ) : s.mismatch ? (
                              <Badge tone="warning">Mismatch</Badge>
                            ) : (
                              <Badge tone="success">In sync</Badge>
                            )}
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      );
                    })}
                  </IndexTable>
                )}
                {mismatchCount > 0 && (
                  <Banner tone="info">
                    <Text as="p" variant="bodyMd">
                      Open the dashboard and click <b>Run Sync Now</b> — quantities will converge to the lower value on both platforms.
                    </Text>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            {/* Actions */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Test actions</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Currently mapped: <b>{mappedCount}</b> active SKU(s).
                </Text>
                <Divider />
                <InlineStack gap="300" wrap>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="seed" />
                    <Button variant="primary" submit loading={isLoading} disabled={isLoading}>
                      Seed 5 Demo Products
                    </Button>
                  </fetcher.Form>

                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="mismatch" />
                    <Button submit loading={isLoading} disabled={isLoading || mappedCount === 0}>
                      Force Mismatch (re-desync)
                    </Button>
                  </fetcher.Form>

                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="clear" />
                    <Button tone="critical" submit loading={isLoading} disabled={isLoading || mappedCount === 0}>
                      Clear All Mappings
                    </Button>
                  </fetcher.Form>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  <b>Seed</b>: creates new products with intentionally mismatched quantities.{" "}
                  <b>Force Mismatch</b>: resets existing mapped products back to the seed quantities so you can test sync repeatedly.{" "}
                  <b>Clear</b>: removes mappings and deletes eBay inventory items (Shopify products are kept).
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
