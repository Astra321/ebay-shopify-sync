import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner,
  Badge, InlineStack, Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [totalMapped, lastLog, recentErrors, cred] = await Promise.all([
    db.skuMapping.count({ where: { shop, isActive: true } }),
    db.syncLog.findFirst({
      where: { shop },
      orderBy: { startedAt: "desc" },
    }),
    db.syncError.findMany({
      where: { syncLog: { shop } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.ebayCredential.findUnique({ where: { shop } }),
  ]);

  return json({
    totalMapped,
    lastLog: lastLog
      ? {
          status: lastLog.status,
          startedAt: lastLog.startedAt.toISOString(),
          finishedAt: lastLog.finishedAt?.toISOString() ?? null,
          itemsSynced: lastLog.itemsSynced,
        }
      : null,
    errorCount: recentErrors.length,
    hasCreds: !!cred?.sellerId,
    hasOAuth: !!(cred?.refreshToken),
  });
};

export default function AppIndex() {
  const { totalMapped, lastLog, errorCount, hasCreds, hasOAuth } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const syncStatusTone = !lastLog
    ? "info"
    : lastLog.status === "SUCCESS"
    ? "success"
    : lastLog.status === "PARTIAL"
    ? "warning"
    : "critical";

  const syncStatusLabel = !lastLog
    ? "Never synced"
    : lastLog.status === "SUCCESS"
    ? `Last sync: ${lastLog.itemsSynced} items — ${new Date(lastLog.startedAt).toLocaleString()}`
    : lastLog.status === "PARTIAL"
    ? `Partial sync: ${lastLog.itemsSynced} items, ${errorCount} error(s)`
    : "Last sync failed";

  return (
    <Page
      title="eBay ↔ Shopify Sync"
      primaryAction={{ content: "Settings", onAction: () => navigate("/app/settings") }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            {!hasCreds && (
              <Banner
                tone="warning"
                title="eBay account not connected"
                action={{ content: "Go to Settings", onAction: () => navigate("/app/settings") }}
              >
                <Text as="p" variant="bodyMd">
                  Enter your eBay username and connect your account to start syncing inventory.
                </Text>
              </Banner>
            )}

            {hasCreds && !hasOAuth && (
              <Banner
                tone="info"
                title="eBay OAuth not authorized"
                action={{ content: "Go to Settings", onAction: () => navigate("/app/settings") }}
              >
                <Text as="p" variant="bodyMd">
                  Your eBay username is saved. Click "Connect with eBay" in Settings to authorize access.
                </Text>
              </Banner>
            )}

            {/* Stats */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Sync Overview</Text>
                <Divider />
                <InlineStack gap="800">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">Mapped Products</Text>
                    <Text as="p" variant="headingLg">{totalMapped}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">Recent Errors</Text>
                    <Text as="p" variant="headingLg">{errorCount}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">Status</Text>
                    <Badge tone={syncStatusTone}>
                      {!lastLog ? "No syncs yet" : lastLog.status}
                    </Badge>
                  </BlockStack>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">{syncStatusLabel}</Text>
              </BlockStack>
            </Card>

            {/* Manual Sync */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Manual Sync</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Trigger an immediate inventory sync between eBay and Shopify.
                  The lowest-stock-wins rule is applied — if quantities differ, the lower value is used on both platforms.
                </Text>
                <Divider />
                <form method="post" action="/api/sync">
                  <Button variant="primary" submit disabled={!hasOAuth}>
                    Run Sync Now
                  </Button>
                </form>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
