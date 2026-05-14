import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Button, Banner,
  Badge, InlineStack, Divider, IndexTable, EmptyState, Icon,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  try {
    const { triggerImmediateSync } = await import("../queue.server");
    await triggerImmediateSync(session.shop);
    return json({ ok: true, message: "Sync queued successfully." });
  } catch (err: any) {
    try {
      const { runSync } = await import("../services/sync-engine.server");
      const result = await runSync(session.shop, admin);
      return json({
        ok: true,
        message: `Sync complete — ${result.synced} item(s) updated${result.errors.length > 0 ? `, ${result.errors.length} error(s)` : ""}.`,
      });
    } catch (syncErr: any) {
      return json({ ok: false, message: `Sync failed: ${syncErr.message}` });
    }
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const [totalMapped, totalInactive, lastLog, errorCount, recentLogs, cred] = await Promise.all([
      db.skuMapping.count({ where: { shop, isActive: true } }),
      db.skuMapping.count({ where: { shop, isActive: false } }),
      db.syncLog.findFirst({ where: { shop }, orderBy: { startedAt: "desc" } }),
      db.syncError.count({ where: { syncLog: { shop } } }),
      db.syncLog.findMany({
        where: { shop },
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { id: true, status: true, startedAt: true, finishedAt: true, itemsSynced: true },
      }),
      db.ebayCredential.findUnique({ where: { shop } }),
    ]);

    return json({
      totalMapped,
      totalInactive,
      lastLog: lastLog
        ? {
            status: lastLog.status,
            startedAt: lastLog.startedAt.toISOString(),
            finishedAt: lastLog.finishedAt?.toISOString() ?? null,
            itemsSynced: lastLog.itemsSynced,
          }
        : null,
      errorCount,
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        status: l.status,
        startedAt: l.startedAt.toISOString(),
        finishedAt: l.finishedAt?.toISOString() ?? null,
        itemsSynced: l.itemsSynced,
      })),
      hasCreds: !!cred?.sellerId,
      hasOAuth: !!(cred?.refreshToken),
      sellerId: cred?.sellerId ?? null,
      dbError: null,
    });
  } catch (err: any) {
    console.error("[dashboard] DB error:", err.message);
    return json({
      totalMapped: 0,
      totalInactive: 0,
      lastLog: null,
      errorCount: 0,
      recentLogs: [],
      hasCreds: false,
      hasOAuth: false,
      sellerId: null,
      dbError: "Database temporarily unavailable. Stats will appear once the connection is restored.",
    });
  }
};

function statusTone(status: string): "success" | "warning" | "critical" | "info" {
  if (status === "SUCCESS") return "success";
  if (status === "PARTIAL") return "warning";
  if (status === "FAILED") return "critical";
  return "info";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function AppIndex() {
  const {
    totalMapped, totalInactive, lastLog, errorCount, recentLogs,
    hasCreds, hasOAuth, sellerId, dbError,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const syncFetcher = useFetcher<typeof action>();
  const isSyncing = syncFetcher.state !== "idle";
  const syncResult = syncFetcher.data;

  const lastSyncLabel = !lastLog
    ? "Never synced"
    : `${lastLog.itemsSynced} items · ${timeAgo(lastLog.startedAt)}`;

  return (
    <Page
      title="eBay ↔ Shopify Sync"
      subtitle="Inventory bridge dashboard"
      primaryAction={{
        content: isSyncing ? "Syncing…" : "Run Sync Now",
        onAction: () => {
          const form = new FormData();
          syncFetcher.submit(form, { method: "post" });
        },
        loading: isSyncing,
        disabled: !hasOAuth || isSyncing,
      }}
      secondaryActions={[
        { content: "Settings", onAction: () => navigate("/app/settings") },
        { content: "Mappings", onAction: () => navigate("/app/mappings") },
        { content: "Errors", onAction: () => navigate("/app/errors") },
        { content: "Seed Demo", onAction: () => navigate("/app/seed") },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            {dbError && (
              <Banner tone="warning" title="Database unavailable">
                <Text as="p" variant="bodyMd">{dbError}</Text>
              </Banner>
            )}

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
                  Username saved as <b>{sellerId}</b>. Click "Connect with eBay" in Settings to authorize access.
                </Text>
              </Banner>
            )}

            {syncResult && (
              <Banner
                tone={syncResult.ok ? "success" : "critical"}
                title={syncResult.message}
                onDismiss={() => { /* fetcher data clears on next submit */ }}
              />
            )}

            {/* Top-level stats grid */}
            <Layout>
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">Active mappings</Text>
                    <Text as="p" variant="heading2xl">{totalMapped}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {totalInactive > 0 ? `${totalInactive} inactive` : "All active"}
                    </Text>
                    <Button variant="plain" onClick={() => navigate("/app/mappings")}>View mappings →</Button>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">Recent errors</Text>
                    <Text as="p" variant="heading2xl">{errorCount}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {errorCount === 0 ? "All clean" : "Across all syncs"}
                    </Text>
                    <Button variant="plain" onClick={() => navigate("/app/errors")} disabled={errorCount === 0}>
                      View errors →
                    </Button>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">Last sync</Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone={statusTone(lastLog?.status ?? "")}>
                        {lastLog?.status ?? "None"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">{lastSyncLabel}</Text>
                    <Button variant="plain" disabled={!hasOAuth || isSyncing} onClick={() => {
                      const form = new FormData();
                      syncFetcher.submit(form, { method: "post" });
                    }}>
                      {isSyncing ? "Syncing…" : "Sync again →"}
                    </Button>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>

            {/* Connection status */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Connections</Text>
                <Divider />
                <InlineStack gap="600" wrap>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Shopify</Text>
                    <Badge tone="success">Connected</Badge>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">eBay account</Text>
                    {hasCreds ? (
                      <Badge tone="success">{sellerId}</Badge>
                    ) : (
                      <Badge tone="warning">Not set</Badge>
                    )}
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">eBay OAuth</Text>
                    {hasOAuth ? (
                      <Badge tone="success">Authorized</Badge>
                    ) : (
                      <Badge tone="warning">Not authorized</Badge>
                    )}
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Recent sync history */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Recent sync history</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Last 5 runs</Text>
                </InlineStack>
                <Divider />
                {recentLogs.length === 0 ? (
                  <BlockStack gap="200" align="center">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      No sync history yet. Click "Run Sync Now" to trigger the first sync.
                    </Text>
                  </BlockStack>
                ) : (
                  <BlockStack gap="200">
                    {recentLogs.map((log) => {
                      const elapsed = log.finishedAt
                        ? Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 100) / 10
                        : null;
                      return (
                        <InlineStack key={log.id} align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            <Badge tone={statusTone(log.status)}>{log.status}</Badge>
                            <Text as="span" variant="bodyMd">{log.itemsSynced} items</Text>
                          </InlineStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {timeAgo(log.startedAt)}{elapsed !== null ? ` · ${elapsed}s` : ""}
                          </Text>
                        </InlineStack>
                      );
                    })}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* How it works */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">How sync works</Text>
                <Divider />
                <Text as="p" variant="bodyMd" tone="subdued">
                  When inventory differs between eBay and Shopify, the <b>lower quantity wins</b> on
                  both platforms — this prevents overselling. Syncs run automatically on a schedule
                  (when the queue worker is enabled) and can be triggered manually from this dashboard.
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Each mapping links one eBay SKU to one Shopify variant. Use <b>Seed Demo</b> to
                  create test products and mappings, or visit <b>Mappings</b> to manage them.
                </Text>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
