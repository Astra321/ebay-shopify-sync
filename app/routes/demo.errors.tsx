import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  Divider,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { ErrorLogTable } from "../components/ErrorLogTable";
import { getDemoErrors, getDemoSyncLogs } from "../demo/demo-data";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = getDemoErrors();
  const syncLogs = getDemoSyncLogs();

  return json({
    errors: errors.map((e) => ({
      id: e.id,
      ebayItemId: e.ebayItemId,
      message: e.message,
      createdAt: e.createdAt,
      syncStatus: e.syncStatus,
    })),
    totalSyncs: syncLogs.length,
    failedSyncs: syncLogs.filter((l) => l.status === "FAILED").length,
    partialSyncs: syncLogs.filter((l) => l.status === "PARTIAL").length,
    successSyncs: syncLogs.filter((l) => l.status === "SUCCESS").length,
  });
};

export default function DemoErrorsPage() {
  const { errors, totalSyncs, failedSyncs, partialSyncs, successSyncs } =
    useLoaderData<typeof loader>();

  return (
    <Page title="Error Log" subtitle={`${errors.length} errors from ${totalSyncs} sync runs`}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Sync summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              <Card>
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Total Syncs
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {totalSyncs}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Successful
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="heading2xl">
                      {successSyncs}
                    </Text>
                    <Badge tone="success">OK</Badge>
                  </InlineStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Partial
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="heading2xl">
                      {partialSyncs}
                    </Text>
                    <Badge tone="warning">Warn</Badge>
                  </InlineStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Failed
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="heading2xl">
                      {failedSyncs}
                    </Text>
                    <Badge tone="critical">Err</Badge>
                  </InlineStack>
                </BlockStack>
              </Card>
            </div>

            {/* Error table */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="300" align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Recent Sync Errors
                  </Text>
                  <InlineStack gap="200">
                    <Badge tone="base">{totalSyncs} total syncs</Badge>
                    <Badge tone={failedSyncs > 0 ? "critical" : "success"}>
                      {failedSyncs} failed
                    </Badge>
                  </InlineStack>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  This log shows errors from sync operations in demo mode. Errors
                  are categorized by sync status: FAILED indicates a complete
                  sync failure, while PARTIAL means some items synced successfully
                  but others encountered issues. In a real deployment, these would
                  include eBay API rate limits, Shopify throttling, network
                  timeouts, and invalid item references.
                </Text>
                <Divider />
                {errors.length === 0 ? (
                  <EmptyState
                    heading="No errors found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <Text as="p" variant="bodyMd">
                      All sync operations completed without errors. Run more syncs
                      or simulate orders to generate error scenarios.
                    </Text>
                  </EmptyState>
                ) : (
                  <ErrorLogTable errors={errors} />
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
