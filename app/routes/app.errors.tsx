import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { ErrorLogTable } from "../components/ErrorLogTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const errors = await db.syncError.findMany({
    where: { syncLog: { shop: session.shop } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { syncLog: { select: { status: true } } },
  });

  return json({
    errors: errors.map((e) => ({
      id: e.id,
      ebayItemId: e.ebayItemId,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
      syncStatus: e.syncLog.status,
    })),
  });
};

export default function ErrorsPage() {
  const { errors } = useLoaderData<typeof loader>();

  return (
    <Page title="Error Log" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Recent Sync Errors</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                This log shows errors from the last 100 sync operations. Errors are categorized by
                sync status: FAILED indicates a complete sync failure, while PARTIAL means some items
                synced successfully but others encountered issues. Common errors include API rate limits,
                network timeouts, and invalid eBay item references for delisted products.
              </Text>
              <ErrorLogTable errors={errors} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
