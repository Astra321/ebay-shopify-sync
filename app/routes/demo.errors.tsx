import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Badge, Divider } from "@shopify/polaris";
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
  });
};

export default function DemoErrorsPage() {
  const { errors, totalSyncs, failedSyncs } = useLoaderData<typeof loader>();

  return (
    <Page title="Error Log" backAction={{ content: "Dashboard", url: "/demo" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="300" align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Recent Sync Errors</Text>
                <InlineStack gap="200">
                  <Badge tone="base">{totalSyncs} total syncs</Badge>
                  <Badge tone={failedSyncs > 0 ? "critical" : "success"}>
                    {failedSyncs} failed
                  </Badge>
                </InlineStack>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                This log shows errors from sync operations in demo mode. Errors are categorized by
                sync status: FAILED indicates a complete sync failure, while PARTIAL means some items
                synced successfully but others encountered issues. In a real deployment, these would
                include eBay API rate limits, Shopify throttling, network timeouts, and invalid item references.
              </Text>
              <Divider />
              <ErrorLogTable errors={errors} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
