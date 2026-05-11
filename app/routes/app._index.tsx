import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { StatsGrid } from "../components/StatsGrid";
import { SyncStatusBanner } from "../components/SyncStatusBanner";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [totalMapped, lastLog, recentErrors, hasCreds] = await Promise.all([
    db.skuMapping.count({ where: { shop, isActive: true } }),
    db.syncLog.findFirst({ where: { shop }, orderBy: { startedAt: "desc" }, include: { errors: { take: 5 } } }),
    db.syncError.findMany({
      where: { syncLog: { shop } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { syncLog: true },
    }),
    db.ebayCredential.findUnique({ where: { shop } }),
  ]);

  return json({
    totalMapped,
    lastLog: lastLog ? {
      status: lastLog.status,
      startedAt: lastLog.startedAt.toISOString(),
      finishedAt: lastLog.finishedAt?.toISOString() ?? null,
      itemsSynced: lastLog.itemsSynced,
    } : null,
    errorCount: recentErrors.length,
    hasCreds: !!hasCreds,
  });
};

export default function Index() {
  const { totalMapped, lastLog, errorCount, hasCreds } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const isSyncing = fetcher.state !== "idle";

  const nextSyncTime = lastLog?.finishedAt
    ? new Date(new Date(lastLog.finishedAt).getTime() + 15 * 60 * 1000).toLocaleTimeString()
    : null;

  return (
    <Page
      title="eBay ↔ Shopify Sync"
      subtitle="Bidirectional inventory sync — lowest stock wins"
      primaryAction={
        <Button
          variant="primary"
          loading={isSyncing}
          disabled={!hasCreds || totalMapped === 0}
          onClick={() => fetcher.submit({}, { method: "post", action: "/api/sync" })}
        >
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      }
      secondaryActions={[
        { content: "Settings", url: "/app/settings" },
        { content: "SKU Mappings", url: "/app/mappings" },
        { content: "Error Log", url: "/app/errors" },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {!hasCreds && (
              <Card>
                <EmptyState
                  heading="Connect your eBay store"
                  action={{ content: "Go to Settings", url: "/app/settings" }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <Text as="p" variant="bodyMd">
                    Enter your eBay API credentials to start syncing inventory between your eBay and Shopify stores.
                    The sync engine uses a lowest-stock-wins conflict resolution strategy to prevent overselling.
                  </Text>
                </EmptyState>
              </Card>
            )}

            {hasCreds && (
              <>
                <SyncStatusBanner
                  status={lastLog?.status ?? null}
                  lastSyncTime={lastLog?.finishedAt ?? lastLog?.startedAt ?? null}
                />
                <StatsGrid
                  totalMapped={totalMapped}
                  lastSyncTime={lastLog?.finishedAt ?? null}
                  nextSyncTime={nextSyncTime}
                  errorCount={errorCount}
                  itemsSyncedLast={lastLog?.itemsSynced ?? 0}
                />
              </>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
