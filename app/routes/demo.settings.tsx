import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData, useFetcher } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, Banner, Divider, InlineStack, Badge } from "@shopify/polaris";
import { useState } from "react";
import { CredentialsForm } from "../components/CredentialsForm";
import { resetDemoData, runDemoSync } from "../demo/demo-data";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ hasCreds: true, isDemo: true });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("action") as string;

  if (action === "import") {
    // Simulate an import delay
    await new Promise((r) => setTimeout(r, 2000));
    return json({ imported: 20, skipped: 0, errors: [] });
  }

  if (action === "reset") {
    resetDemoData();
    return json({ reset: true });
  }

  return json({ saved: true, error: undefined });
};

export default function DemoSettingsPage() {
  const { hasCreds, isDemo } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    setImporting(true);
    await fetcher.submit({ action: "import" }, { method: "post" });
    setImporting(false);
  };

  return (
    <Page title="Settings" backAction={{ content: "Dashboard", url: "/demo" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Banner tone="info" title="Demo Mode — eBay credentials are simulated">
              <Text as="p" variant="bodyMd">
                In demo mode, all eBay and Shopify API calls are simulated. No real credentials
                are needed. When you deploy this app to production, you'll enter your real eBay
                Developer credentials (or use OAuth 2.0 authorization) and connect to your Shopify
                store through the app installation flow.
              </Text>
            </Banner>

            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Demo Configuration</Text>
                  <Badge tone="info">Demo Mode</Badge>
                </InlineStack>
                <Divider />
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">eBay Connection:</Text>
                    <Badge tone="success">Simulated (OAuth 2.0)</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">Shopify Connection:</Text>
                    <Badge tone="success">Simulated (Access Token)</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">Sync Schedule:</Text>
                    <Badge tone="info">Every 15 minutes</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">Conflict Rule:</Text>
                    <Badge tone="warning">Lowest stock wins</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">Encryption:</Text>
                    <Badge tone="success">AES-256-GCM</Badge>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Initial Import</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  In demo mode, this imports 20 simulated eBay listings into your "Shopify store".
                  Each listing becomes a mapped product with inventory levels that may differ between
                  the two platforms, giving you realistic data to test the sync engine.
                </Text>
                <Divider />
                <InlineStack gap="300" align="start">
                  <Button variant="primary" loading={importing} onClick={handleImport}>
                    {importing ? "Importing..." : "Start eBay Import (Demo)"}
                  </Button>
                  <Button tone="critical" onClick={() => fetcher.submit({ action: "reset" }, { method: "post" })}>
                    Reset All Demo Data
                  </Button>
                </InlineStack>
                {actionData?.imported && (
                  <Banner tone="success" title={`Import complete: ${actionData.imported} products imported`} />
                )}
                {actionData?.reset && (
                  <Banner tone="info" title="All demo data has been reset to its initial state." />
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Production Deployment</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  When you're ready to deploy to production, you'll need:
                </Text>
                <Divider />
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">1. eBay Developer account with App ID, Cert ID, and Dev ID</Text>
                  <Text as="p" variant="bodyMd">2. eBay OAuth 2.0 authorization (recommended) or legacy Auth Token</Text>
                  <Text as="p" variant="bodyMd">3. Shopify Partners account to create a custom app</Text>
                  <Text as="p" variant="bodyMd">4. PostgreSQL database (via Railway, Supabase, or similar)</Text>
                  <Text as="p" variant="bodyMd">5. Redis instance for the BullMQ job queue</Text>
                  <Text as="p" variant="bodyMd">6. Railway or similar platform for deployment</Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
