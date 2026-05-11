import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { SkuMappingTable } from "../components/SkuMappingTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const mappings = await db.skuMapping.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  return json({
    shop: session.shop,
    mappings: mappings.map((m) => ({
      ...m,
      lastSyncedAt: m.lastSyncedAt?.toISOString() ?? null,
    })),
  });
};

export default function MappingsPage() {
  const { mappings, shop } = useLoaderData<typeof loader>();

  return (
    <Page title="SKU Mappings" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                {mappings.length} eBay ↔ Shopify Mappings
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Each mapping links an eBay item to its corresponding Shopify product variant.
                Active mappings are included in the periodic inventory sync. Inactive mappings
                are skipped during sync operations but remain in the database for historical reference.
                You can click on a Shopify Product ID to view the product directly in your Shopify admin.
              </Text>
              <SkuMappingTable mappings={mappings} shop={shop} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
