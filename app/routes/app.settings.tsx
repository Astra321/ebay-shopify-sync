import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { Page, Layout, BlockStack, Card, Text, Button, Banner, Divider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { encrypt } from "../services/crypto.server";
import { CredentialsForm } from "../components/CredentialsForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const hasCreds = !!(await db.ebayCredential.findUnique({ where: { shop: session.shop } }));
  return json({ hasCreds });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  const appId = form.get("appId") as string;
  const certId = form.get("certId") as string;
  const devId = form.get("devId") as string;
  const authToken = form.get("authToken") as string;
  const sellerId = form.get("sellerId") as string;

  if (!appId || !certId || !devId || !authToken || !sellerId) {
    return json({ saved: false, error: "All fields are required. Please fill in every credential field to enable the eBay integration." });
  }

  await db.ebayCredential.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      appId: encrypt(appId),
      certId: encrypt(certId),
      devId: encrypt(devId),
      authToken: encrypt(authToken),
      sellerId,
    },
    update: {
      appId: encrypt(appId),
      certId: encrypt(certId),
      devId: encrypt(devId),
      authToken: encrypt(authToken),
      sellerId,
    },
  });

  return json({ saved: true, error: undefined });
};

export default function SettingsPage() {
  const { hasCreds } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page title="Settings" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {hasCreds && !actionData?.saved && (
              <Banner tone="info" title="Credentials already configured. Re-enter to update them. Existing credentials will be overwritten with the new values you provide." />
            )}
            <CredentialsForm saved={actionData?.saved ?? false} error={actionData?.error} />
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Initial Import</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Run a one-time import of all active eBay listings into your Shopify store.
                  This will create new products in Shopify for each eBay listing, including titles,
                  descriptions, images, prices, and current inventory levels. The import respects
                  Shopify rate limits and may take several minutes for large catalogs with hundreds
                  or thousands of items. Each imported item will be automatically mapped for ongoing sync.
                </Text>
                <Divider />
                <form method="post" action="/api/import">
                  <Button variant="primary" submit>Start eBay Import</Button>
                </form>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
