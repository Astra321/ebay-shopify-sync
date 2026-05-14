import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Banner, Divider,
  IndexTable, Badge, InlineStack, Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { previewSync, runSync } from "../services/sync-engine.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  try {
    const result = await previewSync(session.shop, admin);
    return json({ ...result, error: null });
  } catch (err: any) {
    return json({
      preview: [], totalMapped: 0, actionsCount: 0,
      unreachable: undefined, error: err.message,
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  try {
    const result = await runSync(session.shop, admin);
    return json({
      ok: true,
      message: `Sync complete — ${result.synced} item(s) updated${result.errors.length > 0 ? `, ${result.errors.length} error(s)` : ""}.`,
    });
  } catch (err: any) {
    return json({ ok: false, message: `Sync failed: ${err.message}` });
  }
};

export default function PreviewPage() {
  const data = useLoaderData<typeof loader>();
  const applyFetcher = useFetcher<typeof action>();
  const isApplying = applyFetcher.state !== "idle";

  return (
    <Page
      title="Sync preview"
      subtitle="Dry-run — see exactly what will change before applying"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {data.error && (
              <Banner tone="critical" title="Failed to compute preview">
                <Text as="p" variant="bodyMd">{data.error}</Text>
              </Banner>
            )}
            {data.unreachable && (
              <Banner tone="warning" title={data.unreachable} />
            )}
            {applyFetcher.data && (
              <Banner tone={applyFetcher.data.ok ? "success" : "critical"} title={applyFetcher.data.message} />
            )}

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">Proposed changes</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {data.totalMapped} mapped · {data.actionsCount} would change · {data.totalMapped - data.actionsCount} already in sync
                    </Text>
                  </BlockStack>
                  <applyFetcher.Form method="post">
                    <Button
                      variant="primary"
                      submit
                      loading={isApplying}
                      disabled={isApplying || data.actionsCount === 0}
                    >
                      {isApplying ? "Applying…" : `Apply ${data.actionsCount} change(s)`}
                    </Button>
                  </applyFetcher.Form>
                </InlineStack>
                <Divider />
                {data.preview.length === 0 ? (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Nothing to preview — no active mappings yet.
                  </Text>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "item", plural: "items" }}
                    itemCount={data.preview.length}
                    selectable={false}
                    headings={[
                      { title: "SKU" },
                      { title: "Shopify" },
                      { title: "eBay" },
                      { title: "Target (lowest wins)" },
                      { title: "Actions" },
                    ]}
                  >
                    {data.preview.map((p, i) => (
                      <IndexTable.Row id={p.ebayItemId} key={p.ebayItemId} position={i}>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodyMd" fontWeight="medium">{p.ebayItemId}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone={p.willUpdateShopify ? "critical" : undefined}>
                            {p.shopifyQty}{p.willUpdateShopify ? ` → ${p.targetQty}` : ""}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone={p.willUpdateEbay ? "critical" : undefined}>
                            {p.ebayQty}{p.willUpdateEbay ? ` → ${p.targetQty}` : ""}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" fontWeight="semibold">{p.targetQty}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <InlineStack gap="100">
                            {p.willUpdateShopify && <Badge tone="warning">Shopify</Badge>}
                            {p.willUpdateEbay && <Badge tone="warning">eBay</Badge>}
                            {!p.willUpdateShopify && !p.willUpdateEbay && <Badge tone="success">In sync</Badge>}
                          </InlineStack>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
