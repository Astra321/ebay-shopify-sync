import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, Banner, Divider, List } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { ShopifyAdminClient } from "../services/shopify-api.server";
import { EbayClient } from "../services/ebay.server";
import { decrypt } from "../services/crypto.server";

const DEMO_PRODUCTS = [
  { title: "Wireless Bluetooth Headphones", price: "49.99", qty: 20, sku: "DEMO-BT-HDPH-001" },
  { title: "USB-C Fast Charging Cable 2m", price: "12.99", qty: 50, sku: "DEMO-USB-CABLE-002" },
  { title: "Phone Stand Adjustable Desk Mount", price: "19.99", qty: 30, sku: "DEMO-PHSTAND-003" },
  { title: "Mechanical Keyboard Tenkeyless", price: "89.99", qty: 10, sku: "DEMO-MECH-KB-004" },
  { title: "LED Desk Lamp with USB Charging", price: "34.99", qty: 15, sku: "DEMO-LEDLAMP-005" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const count = await db.skuMapping.count({ where: { shop: session.shop, isActive: true } });
  return json({ mappedCount: count });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "clear") {
    await db.skuMapping.deleteMany({ where: { shop } });
    await db.syncLog.deleteMany({ where: { shop } });
    return json({ ok: true, message: "All mappings cleared." });
  }

  // Seed Shopify products + SKU mappings
  const cred = await db.ebayCredential.findUnique({ where: { shop } });
  const shopifyClient = new ShopifyAdminClient(session as any);
  const locationId = await shopifyClient.getLocationId();

  const created: string[] = [];
  const errors: string[] = [];

  // Try to pull real eBay inventory item quantities (if OAuth connected)
  let ebayQtyMap: Record<string, number> = {};
  if (cred?.accessToken || cred?.refreshToken) {
    try {
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

      // Try to create eBay inventory items (no offer/listing needed)
      for (const p of DEMO_PRODUCTS) {
        try {
          const token = await (ebay as any).ensureAccessToken();
          await import("axios").then(({ default: axios }) =>
            axios.put(
              `https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(p.sku)}`,
              {
                product: { title: p.title, description: `Demo product: ${p.title}` },
                condition: "NEW",
                availability: {
                  shipToLocationAvailability: { quantity: p.qty },
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                  "Accept-Language": "en-US",
                  "Content-Language": "en-US",
                },
              }
            )
          );
          ebayQtyMap[p.sku] = p.qty;
        } catch {
          // eBay inventory creation optional — continue with Shopify-only seed
          ebayQtyMap[p.sku] = p.qty;
        }
      }
    } catch {
      DEMO_PRODUCTS.forEach((p) => { ebayQtyMap[p.sku] = p.qty; });
    }
  } else {
    DEMO_PRODUCTS.forEach((p) => { ebayQtyMap[p.sku] = p.qty; });
  }

  for (const p of DEMO_PRODUCTS) {
    try {
      // Skip if SKU mapping already exists
      const existing = await db.skuMapping.findFirst({ where: { shop, ebayItemId: p.sku } });
      if (existing) {
        created.push(`${p.title} (already exists)`);
        continue;
      }

      // Create Shopify product
      const product = await shopifyClient.createProduct({
        title: p.title,
        body_html: `<p>Demo product for eBay-Shopify sync testing.</p>`,
        vendor: "Demo Vendor",
        product_type: "Demo",
        images: [],
        variants: [{ title: "Default Title", price: p.price, sku: p.sku, inventory_management: "shopify" }],
      });

      const variant = product.variants[0];

      // Connect inventory to location and set quantity
      try {
        await shopifyClient.connectInventoryToLocation(variant.inventoryItemId, locationId);
      } catch { /* already connected */ }
      await shopifyClient.setInventoryLevel(locationId, variant.inventoryItemId, ebayQtyMap[p.sku] ?? p.qty);

      // Create SKU mapping
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

      created.push(p.title);
    } catch (err: any) {
      errors.push(`${p.title}: ${err.message}`);
    }
  }

  // Seed a demo sync log
  await db.syncLog.create({
    data: {
      shop,
      status: "SUCCESS",
      itemsSynced: created.length,
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      finishedAt: new Date(),
    },
  });

  return json({
    ok: errors.length === 0,
    message: `Created ${created.length} product(s). ${errors.length > 0 ? `${errors.length} error(s).` : ""}`,
    created,
    errors,
  });
};

export default function SeedPage() {
  const { mappedCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  return (
    <Page title="Demo Seed" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Banner tone="info" title="What this does">
              <List>
                <List.Item>Creates 5 demo products in your Shopify store</List.Item>
                <List.Item>Creates matching eBay inventory items (if eBay is connected)</List.Item>
                <List.Item>Links them with SKU mappings so sync works end-to-end</List.Item>
                <List.Item>Sets inventory to 10–50 units on both platforms</List.Item>
              </List>
            </Banner>

            {result && (
              <Banner tone={result.ok ? "success" : "warning"} title={result.message}>
                {result.created && result.created.length > 0 && (
                  <List>
                    {result.created.map((name) => <List.Item key={name}>{name}</List.Item>)}
                  </List>
                )}
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Current State</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {mappedCount} active SKU mapping(s) in database.
                </Text>
                <Divider />
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="seed" />
                  <Button variant="primary" submit loading={isLoading} disabled={isLoading}>
                    Seed 5 Demo Products
                  </Button>
                </fetcher.Form>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Clear All Mappings</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Removes all SKU mappings and sync logs from the database. Does not delete Shopify products or eBay listings.
                </Text>
                <Divider />
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="clear" />
                  <Button tone="critical" submit loading={isLoading} disabled={isLoading}>
                    Clear All Mappings
                  </Button>
                </fetcher.Form>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
