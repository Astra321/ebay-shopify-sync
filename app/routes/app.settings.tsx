import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { Page, Layout, BlockStack, Card, Text, Button, Banner, Divider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { encrypt, decrypt } from "../services/crypto.server";
import { getEbayAuthUrl } from "../services/ebay.server";
import { CredentialsForm } from "../components/CredentialsForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const cred = await db.ebayCredential.findUnique({ where: { shop: session.shop } });
  const hasCreds = !!cred;
  const hasOAuth = !!(cred?.refreshToken);
  const oAuthUrl = hasCreds && cred.redirectUri
    ? getEbayAuthUrl(decrypt(cred.appId), cred.redirectUri, session.shop)
    : null;

  return json({ hasCreds, hasOAuth, oAuthUrl });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  const appId = form.get("appId") as string;
  const certId = form.get("certId") as string;
  const devId = form.get("devId") as string;
  const authToken = (form.get("authToken") as string) || "";
  const sellerId = form.get("sellerId") as string;
  const redirectUri = (form.get("redirectUri") as string) || "";

  if (!appId || !certId || !devId || !sellerId) {
    return json({ saved: false, error: "App ID, Cert ID, Dev ID, and Seller ID are required." });
  }

  if (!authToken && !redirectUri) {
    return json({ saved: false, error: "Either a legacy Auth Token or an OAuth Redirect URI is required to authenticate with eBay." });
  }

  await db.ebayCredential.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      appId: encrypt(appId),
      certId: encrypt(certId),
      devId: encrypt(devId),
      authToken: authToken ? encrypt(authToken) : "",
      sellerId,
      redirectUri: redirectUri || null,
    },
    update: {
      appId: encrypt(appId),
      certId: encrypt(certId),
      devId: encrypt(devId),
      authToken: authToken ? encrypt(authToken) : "",
      sellerId,
      redirectUri: redirectUri || null,
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
            {hasCreds && !actionData?.saved && (
              <Banner tone="info" title="Credentials already configured. Re-enter to update them. Existing credentials will be overwritten with the new values you provide." />
            )}
            <CredentialsForm
              saved={actionData?.saved ?? false}
              error={actionData?.error}
              hasOAuth={hasOAuth}
              oAuthUrl={oAuthUrl ?? undefined}
            />

            {oAuthUrl && !hasOAuth && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Connect with eBay OAuth 2.0</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    After saving your credentials, click the button below to authorize the app with eBay
                    using OAuth 2.0. This will redirect you to eBay's consent page where you grant the
                    app permission to manage your inventory. OAuth access tokens are automatically refreshed
                    and are the recommended authentication method.
                  </Text>
                  <Divider />
                  <Button variant="primary" url={oAuthUrl} external>
                    Authorize with eBay (OAuth 2.0)
                  </Button>
                </BlockStack>
              </Card>
            )}

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
