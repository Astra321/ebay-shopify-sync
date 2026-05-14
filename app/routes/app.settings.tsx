import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { Page, Layout, BlockStack, Card, Text, Button, Divider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { encrypt } from "../services/crypto.server";
import { getEbayAuthUrl } from "../services/ebay.server";
import { CredentialsForm } from "../components/CredentialsForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const cred = await db.ebayCredential.findUnique({ where: { shop: session.shop } });
  const hasCreds = !!(cred?.sellerId);
  const hasOAuth = !!(cred?.refreshToken);

  // App-level credentials always come from env vars — user never needs to enter them
  const appId = process.env.EBAY_APP_ID ?? null;
  const ruName = process.env.EBAY_RUNAME ?? null;
  const oAuthUrl = appId && ruName
    ? getEbayAuthUrl(appId, ruName, session.shop)
    : null;

  return json({ hasCreds, hasOAuth, oAuthUrl });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const sellerId = (form.get("sellerId") as string)?.trim();

  if (!sellerId) {
    return json({ saved: false, error: "eBay username is required." });
  }

  // App-level credentials come from env vars — encrypt and cache them in DB
  // so the sync engine and token refresh don't need live env access.
  const appId = process.env.EBAY_APP_ID ?? "";
  const certId = process.env.EBAY_CERT_ID ?? "";
  const devId = process.env.EBAY_DEV_ID ?? "";
  const ruName = process.env.EBAY_RUNAME ?? "";

  if (!appId || !certId || !devId) {
    return json({ saved: false, error: "App is not configured yet. Please contact support." });
  }

  await db.ebayCredential.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      appId: encrypt(appId),
      certId: encrypt(certId),
      devId: encrypt(devId),
      authToken: "",
      sellerId,
      redirectUri: ruName || null,
    },
    update: {
      appId: encrypt(appId),
      certId: encrypt(certId),
      devId: encrypt(devId),
      sellerId,
      redirectUri: ruName || null,
    },
  });

  return json({ saved: true, error: undefined });
};

export default function SettingsPage() {
  const { hasCreds, hasOAuth, oAuthUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page title="Settings" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <CredentialsForm
              saved={actionData?.saved ?? false}
              error={actionData?.error}
              hasOAuth={hasOAuth}
              oAuthUrl={oAuthUrl ?? undefined}
            />

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
