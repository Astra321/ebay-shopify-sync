import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useFetcher, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  Badge,
  Divider,
  InlineStack,
  Tooltip,
  Spinner,
  ButtonGroup,
} from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import { StatsGrid } from "../components/StatsGrid";
import { SyncStatusBanner } from "../components/SyncStatusBanner";
import {
  getDemoMappings,
  getDemoSyncLogs,
  getDemoErrors,
  runDemoSync,
  simulateEbayOrder,
  simulateShopifyOrder,
  isDemoSyncRunning,
  resetDemoData,
} from "../demo/demo-data";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const mappings = getDemoMappings();
  const syncLogs = getDemoSyncLogs();
  const errors = getDemoErrors();

  const lastLog = syncLogs[0] ?? null;
  const totalMapped = mappings.filter((m) => m.isActive).length;
  const mismatchedItems = mappings.filter(
    (m) => m.isActive && m.ebayQty !== m.shopifyQty
  );

  return json({
    totalMapped,
    lastLog: lastLog
      ? {
          status: lastLog.status,
          startedAt: lastLog.startedAt,
          finishedAt: lastLog.finishedAt,
          itemsSynced: lastLog.itemsSynced,
        }
      : null,
    errorCount: errors.length,
    mismatchedCount: mismatchedItems.length,
    mappings: mappings.slice(0, 8),
    syncRunning: isDemoSyncRunning(),
    syncLogs: syncLogs.slice(0, 5).map((log) => ({
      id: log.id,
      status: log.status,
      startedAt: log.startedAt,
      finishedAt: log.finishedAt,
      itemsSynced: log.itemsSynced,
      errorCount: log.errors.length,
    })),
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("action") as string;

  switch (action) {
    case "sync":
      await runDemoSync();
      break;
    case "ebay-order":
      simulateEbayOrder();
      break;
    case "shopify-order":
      simulateShopifyOrder();
      break;
    case "reset":
      resetDemoData();
      break;
  }

  return json({ ok: true });
};

export default function DemoDashboard() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const isSyncing = fetcher.state !== "idle";

  const nextSyncTime = data.lastLog?.finishedAt
    ? new Date(
        new Date(data.lastLog.finishedAt).getTime() + 15 * 60 * 1000
      ).toLocaleTimeString()
    : null;

  const handleAction = useCallback(
    (action: string) => {
      fetcher.submit({ action }, { method: "post" });
    },
    [fetcher]
  );

  // Auto-refresh after actions
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  return (
    <Page
      title="eBay ↔ Shopify Sync"
      subtitle="Demo Mode — Lowest stock wins"
      titleMetadata={<Badge tone="info">Demo</Badge>}
      primaryAction={
        <Button
          variant="primary"
          loading={isSyncing}
          onClick={() => handleAction("sync")}
        >
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      }
      secondaryActions={[
        { content: "SKU Mappings", url: "/demo/mappings" },
        { content: "Error Log", url: "/demo/errors" },
        { content: "Settings", url: "/demo/settings" },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Demo mode banner */}
            <Banner tone="info" title="Demo Mode Active">
              <Text as="p" variant="bodyMd">
                This is a fully interactive demo with simulated data. No real
                eBay or Shopify connections needed. Use the simulation controls
                below to trigger orders on either platform, then run a sync to
                see the lowest-stock-wins logic in action.
              </Text>
            </Banner>

            <SyncStatusBanner
              status={data.lastLog?.status ?? null}
              lastSyncTime={
                data.lastLog?.finishedAt ?? data.lastLog?.startedAt ?? null
              }
            />

            <StatsGrid
              totalMapped={data.totalMapped}
              lastSyncTime={data.lastLog?.finishedAt ?? null}
              nextSyncTime={nextSyncTime}
              errorCount={data.errorCount}
              itemsSyncedLast={data.lastLog?.itemsSynced ?? 0}
            />

            {/* Quantity mismatch preview */}
            {data.mismatchedCount > 0 && (
              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="200" align="space-between">
                    <Text as="h2" variant="headingMd">
                      Quantity Mismatches
                    </Text>
                    <Badge tone="warning">
                      {data.mismatchedCount} items need sync
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    These items have different inventory levels between eBay and
                    Shopify. Running a sync will apply the lowest quantity to
                    both platforms to prevent overselling.
                  </Text>
                  <Divider />
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                          <th style={thStyle}>Product</th>
                          <th style={thStyle}>eBay Qty</th>
                          <th style={thStyle}>Shopify Qty</th>
                          <th style={thStyle}>Target</th>
                          <th style={thStyle}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.mappings
                          .filter((m) => m.isActive && m.ebayQty !== m.shopifyQty)
                          .map((m) => {
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
                                        width: 32,
                                        height: 32,
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
                                  <Badge
                                    tone={
                                      m.ebayQty < m.shopifyQty
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
                                      m.shopifyQty < m.ebayQty
                                        ? "critical"
                                        : "success"
                                    }
                                  >
                                    {m.shopifyQty}
                                  </Badge>
                                </td>
                                <td style={tdStyle}>
                                  <Badge tone="info">{target}</Badge>
                                </td>
                                <td style={tdStyle}>
                                  <Text
                                    as="span"
                                    variant="bodySm"
                                    tone="subdued"
                                  >
                                    {m.ebayQty < m.shopifyQty
                                      ? "Update Shopify"
                                      : "Update eBay"}
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
            )}

            {/* Simulation controls */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Simulation Controls
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Simulate real-world events to test the sync engine. Place
                  orders on either platform to create inventory mismatches, then
                  run a sync to resolve them.
                </Text>
                <Divider />
                <InlineStack gap="300" align="start">
                  <Tooltip content="Simulate an order on eBay — reduces eBay inventory by 1-3 units">
                    <Button onClick={() => handleAction("ebay-order")}>
                      Simulate eBay Order
                    </Button>
                  </Tooltip>
                  <Tooltip content="Simulate an order on Shopify — reduces Shopify inventory by 1-3 units">
                    <Button onClick={() => handleAction("shopify-order")}>
                      Simulate Shopify Order
                    </Button>
                  </Tooltip>
                  <Tooltip content="Reset all demo data to initial state">
                    <Button tone="critical" onClick={() => handleAction("reset")}>
                      Reset Demo Data
                    </Button>
                  </Tooltip>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Recent sync history */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recent Sync History
                </Text>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Items Synced</th>
                        <th style={thStyle}>Errors</th>
                        <th style={thStyle}>Started</th>
                        <th style={thStyle}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.syncLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              color: "#8c9196",
                              padding: 24,
                            }}
                          >
                            No sync history yet. Run your first sync!
                          </td>
                        </tr>
                      ) : (
                        data.syncLogs.map((log) => {
                          const duration = log.finishedAt
                            ? Math.round(
                                (new Date(log.finishedAt).getTime() -
                                  new Date(log.startedAt).getTime()) /
                                  1000
                              )
                            : null;
                          return (
                            <tr
                              key={log.id}
                              style={{ borderBottom: "1px solid #f1f2f3" }}
                            >
                              <td style={tdStyle}>
                                <Badge
                                  tone={
                                    log.status === "SUCCESS"
                                      ? "success"
                                      : log.status === "PARTIAL"
                                      ? "warning"
                                      : log.status === "FAILED"
                                      ? "critical"
                                      : "info"
                                  }
                                >
                                  {log.status}
                                </Badge>
                              </td>
                              <td style={tdStyle}>{log.itemsSynced}</td>
                              <td style={tdStyle}>{log.errorCount}</td>
                              <td style={tdStyle}>
                                {new Date(log.startedAt).toLocaleString()}
                              </td>
                              <td style={tdStyle}>
                                {duration !== null ? `${duration}s` : "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
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
