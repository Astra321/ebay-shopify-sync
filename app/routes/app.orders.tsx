import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, Text, Banner, Divider,
  IndexTable, Badge, InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { EbayClient } from "../services/ebay.server";
import { decrypt } from "../services/crypto.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const cred = await db.ebayCredential.findUnique({ where: { shop: session.shop } });
  if (!cred || !cred.refreshToken) {
    return json({ orders: [], seller: null, connected: false, error: null });
  }

  const ebay = new EbayClient({
    appId: decrypt(cred.appId),
    certId: decrypt(cred.certId),
    devId: decrypt(cred.devId),
    authToken: cred.authToken ? decrypt(cred.authToken) : "",
    sellerId: cred.sellerId,
    accessToken: cred.accessToken ? decrypt(cred.accessToken) : undefined,
    refreshToken: cred.refreshToken ? decrypt(cred.refreshToken) : undefined,
    accessTokenExpiry: cred.accessTokenExpiry ?? undefined,
  });

  try {
    const [orders, seller] = await Promise.all([
      ebay.getRecentOrders(20),
      ebay.getSellerProfile(),
    ]);
    return json({ orders, seller, connected: true, error: null, needsReauth: false });
  } catch (err: any) {
    const status = err?.response?.status;
    const detail = err?.response?.data?.error_description ?? err?.response?.data?.errors?.[0]?.message ?? err.message;
    // 401/403 typically means the existing refresh token was granted with a narrower scope set
    const needsReauth = status === 401 || status === 403;
    return json({
      orders: [], seller: null, connected: true,
      error: `${status ? status + ": " : ""}${detail}`,
      needsReauth,
    });
  }
};

function fulfillmentTone(status: string): "success" | "warning" | "info" | "critical" {
  if (status === "FULFILLED") return "success";
  if (status === "IN_PROGRESS") return "info";
  if (status === "NOT_STARTED") return "warning";
  return "info";
}

export default function OrdersPage() {
  const { orders, seller, connected, error, needsReauth } = useLoaderData<typeof loader>();

  return (
    <Page
      title="eBay activity"
      subtitle="Seller profile and recent orders pulled live from eBay"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {!connected && (
              <Banner tone="warning" title="eBay not connected">
                <Text as="p" variant="bodyMd">Connect eBay OAuth in Settings to see seller info and orders.</Text>
              </Banner>
            )}
            {error && (
              <Banner
                tone={needsReauth ? "warning" : "critical"}
                title={needsReauth ? "Re-authorize eBay to enable new scopes" : "Could not load from eBay"}
                action={needsReauth ? { content: "Open Settings", url: "/app/settings" } : undefined}
              >
                <Text as="p" variant="bodyMd">
                  {needsReauth
                    ? "Your existing eBay token was issued before fulfillment and identity scopes were added. Reconnect from Settings to grant the new permissions."
                    : error}
                </Text>
              </Banner>
            )}

            {seller && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Seller profile</Text>
                  <Divider />
                  <InlineStack gap="600" wrap>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Username</Text>
                      <Text as="p" variant="headingMd">{seller.username || "—"}</Text>
                    </BlockStack>
                    {seller.email && (
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">Email</Text>
                        <Text as="p" variant="bodyMd">{seller.email}</Text>
                      </BlockStack>
                    )}
                    {seller.userId && (
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">User ID</Text>
                        <Text as="p" variant="bodyMd">{seller.userId}</Text>
                      </BlockStack>
                    )}
                  </InlineStack>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Recent orders</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Last 20</Text>
                </InlineStack>
                <Divider />
                {orders.length === 0 ? (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No recent eBay orders to display.
                  </Text>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "order", plural: "orders" }}
                    itemCount={orders.length}
                    selectable={false}
                    headings={[
                      { title: "Order" },
                      { title: "Date" },
                      { title: "Buyer" },
                      { title: "Items" },
                      { title: "Total" },
                      { title: "Status" },
                    ]}
                  >
                    {orders.map((o, i) => (
                      <IndexTable.Row id={o.orderId} key={o.orderId} position={i}>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodyMd" fontWeight="medium">{o.orderId.slice(-12)}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {new Date(o.creationDate).toLocaleDateString()}
                        </IndexTable.Cell>
                        <IndexTable.Cell>{o.buyer}</IndexTable.Cell>
                        <IndexTable.Cell>
                          {o.items.length === 0
                            ? "—"
                            : o.items[0].title + (o.items.length > 1 ? ` +${o.items.length - 1}` : "")}
                        </IndexTable.Cell>
                        <IndexTable.Cell>{o.currency} {o.total}</IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={fulfillmentTone(o.status)}>{o.status}</Badge>
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
