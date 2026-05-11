import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Badge, Button, Divider, InlineStack } from "@shopify/polaris";
import { SkuMappingTable } from "../components/SkuMappingTable";
import { getDemoMappings, simulateEbayOrder, simulateShopifyOrder } from "../demo/demo-data";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const mappings = getDemoMappings();
  return json({
    shop: "demo-store.myshopify.com",
    mappings: mappings.map((m) => ({
      id: m.id,
      ebayItemId: m.ebayItemId,
      shopifyProductId: m.shopifyProductId,
      ebaysku: m.ebaysku,
      shopifySku: m.shopifySku,
      isActive: m.isActive,
      lastSyncedAt: m.lastSyncedAt,
    })),
    mismatchedCount: mappings.filter((m) => m.isActive && m.ebayQty !== m.shopifyQty).length,
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("action") as string;
  if (action === "ebay-order") simulateEbayOrder();
  if (action === "shopify-order") simulateShopifyOrder();
  return json({ ok: true });
};

export default function DemoMappingsPage() {
  const { mappings, shop, mismatchedCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <Page title="SKU Mappings" backAction={{ content: "Dashboard", url: "/demo" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    {mappings.length} eBay ↔ Shopify Mappings
                  </Text>
                  {mismatchedCount > 0 && (
                    <Badge tone="warning">{mismatchedCount} mismatched</Badge>
                  )}
                </InlineStack>
                <InlineStack gap="200">
                  <Button size="slim" onClick={() => fetcher.submit({ action: "ebay-order" }, { method: "post" })}>
                    Simulate eBay Order
                  </Button>
                  <Button size="slim" onClick={() => fetcher.submit({ action: "shopify-order" }, { method: "post" })}>
                    Simulate Shopify Order
                  </Button>
                </InlineStack>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                Each mapping links an eBay item to its corresponding Shopify product variant.
                Active mappings are included in the periodic inventory sync. Mismatched items
                (where eBay and Shopify quantities differ) will be resolved during the next sync.
              </Text>
              <Divider />
              <SkuMappingTable mappings={mappings} shop={shop} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
