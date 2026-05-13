import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useFetcher, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  Button,
  Divider,
  InlineStack,
  Banner,
  Tooltip,
} from "@shopify/polaris";
import { SkuMappingTable } from "../components/SkuMappingTable";
import {
  getDemoMappings,
  simulateEbayOrder,
  simulateShopifyOrder,
} from "../demo/demo-data";
import { useEffect, useCallback } from "react";

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
      ebayTitle: m.ebayTitle,
      shopifyTitle: m.shopifyTitle,
      ebayQty: m.ebayQty,
      shopifyQty: m.shopifyQty,
      price: m.price,
      imageUrl: m.imageUrl,
    })),
    mismatchedCount: mappings.filter(
      (m) => m.isActive && m.ebayQty !== m.shopifyQty
    ).length,
    totalActive: mappings.filter((m) => m.isActive).length,
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
  const { mappings, shop, mismatchedCount, totalActive } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const handleAction = useCallback(
    (action: string) => {
      fetcher.submit({ action }, { method: "post" });
    },
    [fetcher]
  );

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  return (
    <Page title="SKU Mappings" subtitle={`${totalActive} active product links`}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {mismatchedCount > 0 && (
              <Banner tone="warning" title={`${mismatchedCount} items have quantity mismatches`}>
                <Text as="p" variant="bodyMd">
                  These items have different inventory between eBay and Shopify.
                  Run a sync from the dashboard to apply the lowest-stock-wins
                  rule and bring both platforms into alignment.
                </Text>
              </Banner>
            )}

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
                    <Tooltip content="Simulate an eBay order to create a quantity mismatch">
                      <Button
                        size="slim"
                        onClick={() => handleAction("ebay-order")}
                      >
                        Simulate eBay Order
                      </Button>
                    </Tooltip>
                    <Tooltip content="Simulate a Shopify order to create a quantity mismatch">
                      <Button
                        size="slim"
                        onClick={() => handleAction("shopify-order")}
                      >
                        Simulate Shopify Order
                      </Button>
                    </Tooltip>
                  </InlineStack>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Each mapping links an eBay item to its corresponding Shopify
                  product variant. Active mappings are included in the periodic
                  inventory sync. Mismatched items (where eBay and Shopify
                  quantities differ) will be resolved during the next sync.
                </Text>
                <Divider />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                        <th style={thStyle}>Product</th>
                        <th style={thStyle}>eBay SKU</th>
                        <th style={thStyle}>Shopify SKU</th>
                        <th style={thStyle}>eBay Qty</th>
                        <th style={thStyle}>Shopify Qty</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Last Synced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => {
                        const mismatch = m.ebayQty !== m.shopifyQty;
                        const target = Math.max(
                          0,
                          Math.min(m.ebayQty, m.shopifyQty)
                        );
                        return (
                          <tr
                            key={m.id}
                            style={{ borderBottom: "1px solid #f1f2f3" }}
                          >
                            <td style={tdStyle}>
                              <InlineStack gap="200" blockAlign="center">
                                <img
                                  src={m.imageUrl}
                                  alt=""
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 4,
                                    objectFit: "cover",
                                  }}
                                />
                                <Text
                                  as="span"
                                  variant="bodyMd"
                                  fontWeight="medium"
                                >
                                  {m.ebayTitle}
                                </Text>
                              </InlineStack>
                            </td>
                            <td style={tdStyle}>
                              <Text as="span" variant="bodySm" fontFamily="monospace">
                                {m.ebaysku}
                              </Text>
                            </td>
                            <td style={tdStyle}>
                              <Text as="span" variant="bodySm" fontFamily="monospace">
                                {m.shopifySku}
                              </Text>
                            </td>
                            <td style={tdStyle}>
                              <Badge
                                tone={
                                  mismatch && m.ebayQty < m.shopifyQty
                                    ? "critical"
                                    : "success"
                                }
                              >
                                {m.ebayQty}
                              </Badge>
                            </td>
                            <td style={tdStyle}>
                              <Badge
                                tone={
                                  mismatch && m.shopifyQty < m.ebayQty
                                    ? "critical"
                                    : "success"
                                }
                              >
                                {m.shopifyQty}
                              </Badge>
                            </td>
                            <td style={tdStyle}>
                              {m.isActive ? (
                                mismatch ? (
                                  <Badge tone="warning">Mismatch</Badge>
                                ) : (
                                  <Badge tone="success">In Sync</Badge>
                                )
                              ) : (
                                <Badge tone="base">Inactive</Badge>
                              )}
                            </td>
                            <td style={tdStyle}>
                              <Text as="span" variant="bodySm" tone="subdued">
                                {m.lastSyncedAt
                                  ? new Date(m.lastSyncedAt).toLocaleString()
                                  : "Never"}
                              </Text>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 13,
  color: "#6d7175",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 14,
};
