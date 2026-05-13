import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useActionData, useFetcher, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  Divider,
  InlineStack,
  Badge,
  TextField,
  Box,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { resetDemoData, runDemoSync, getDemoMappings } from "../demo/demo-data";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const mappings = getDemoMappings();
  const activeMappings = mappings.filter((m) => m.isActive);
  return json({
    hasCreds: true,
    isDemo: true,
    activeMappings: activeMappings.length,
    totalMappings: mappings.length,
    mismatchedCount: activeMappings.filter((m) => m.ebayQty !== m.shopifyQty).length,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("action") as string;

  if (action === "import") {
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
  const { hasCreds, isDemo, activeMappings, totalMappings, mismatchedCount } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      revalidator.revalidate();
      setImporting(false);
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const handleImport = async () => {
    setImporting(true);
    fetcher.submit({ action: "import" }, { method: "post" });
  };

  return (
    <Page title="Settings" subtitle="Demo Mode Configuration">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Banner tone="info" title="Demo Mode — eBay credentials are simulated">
              <Text as="p" variant="bodyMd">
                In demo mode, all eBay and Shopify API calls are simulated. No
                real credentials are needed. When you deploy this app to
                production, you'll enter your real eBay Developer credentials (or
                use OAuth 2.0 authorization) and connect to your Shopify store
                through the app installation flow.
              </Text>
            </Banner>

            {/* Connection status */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Connection Status</Text>
                  <Badge tone="info">Demo Mode</Badge>
                </InlineStack>
                <Divider />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "#2ecc71",
                            display: "inline-block",
                          }}
                        />
                        <Text as="p" variant="bodyMd" fontWeight="medium">
                          eBay Connection
                        </Text>
                      </InlineStack>
                      <Badge tone="success">Simulated (OAuth 2.0)</Badge>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Using simulated eBay REST API with auto-refresh tokens
                      </Text>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "#2ecc71",
                            display: "inline-block",
                          }}
                        />
                        <Text as="p" variant="bodyMd" fontWeight="medium">
                          Shopify Connection
                        </Text>
                      </InlineStack>
                      <Badge tone="success">Simulated (Access Token)</Badge>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Using simulated Shopify Admin API via session
                      </Text>
                    </BlockStack>
                  </Card>
                </div>
              </BlockStack>
            </Card>

            {/* Sync configuration */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Sync Configuration</Text>
                <Divider />
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      Sync Schedule:
                    </Text>
                    <Badge tone="info">Every 15 minutes</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      Conflict Rule:
                    </Text>
                    <Badge tone="warning">Lowest stock wins</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      Encryption:
                    </Text>
                    <Badge tone="success">AES-256-GCM</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      Queue:
                    </Text>
                    <Badge tone="info">BullMQ + Redis</Badge>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Inventory summary */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Inventory Summary</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Current state of your demo inventory mappings.
                </Text>
                <Divider />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 16,
                  }}
                >
                  <BlockStack gap="100" inlineAlign="center">
                    <Text as="p" variant="heading2xl">{totalMappings}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Total Mappings</Text>
                  </BlockStack>
                  <BlockStack gap="100" inlineAlign="center">
                    <Text as="p" variant="heading2xl">{activeMappings}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Active</Text>
                  </BlockStack>
                  <BlockStack gap="100" inlineAlign="center">
                    <Text as="p" variant="heading2xl">{totalMappings - activeMappings}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Inactive</Text>
                  </BlockStack>
                  <BlockStack gap="100" inlineAlign="center">
                    <Text as="p" variant="heading2xl">{mismatchedCount}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Mismatched</Text>
                  </BlockStack>
                </div>
              </BlockStack>
            </Card>

            {/* Initial import */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Initial Import</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  In demo mode, this imports 20 simulated eBay listings into your
                  "Shopify store". Each listing becomes a mapped product with
                  inventory levels that may differ between the two platforms,
                  giving you realistic data to test the sync engine.
                </Text>
                <Divider />
                <InlineStack gap="300" align="start">
                  <Button
                    variant="primary"
                    loading={importing}
                    onClick={handleImport}
                  >
                    {importing ? "Importing..." : "Start eBay Import (Demo)"}
                  </Button>
                  <Button
                    tone="critical"
                    onClick={() =>
                      fetcher.submit({ action: "reset" }, { method: "post" })
                    }
                  >
                    Reset All Demo Data
                  </Button>
                </InlineStack>
                {actionData?.imported && (
                  <Banner
                    tone="success"
                    title={`Import complete: ${actionData.imported} products imported`}
                  />
                )}
                {actionData?.reset && (
                  <Banner
                    tone="info"
                    title="All demo data has been reset to its initial state."
                  />
                )}
              </BlockStack>
            </Card>

            {/* Production deployment */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Production Deployment</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  When you're ready to deploy to production, you'll need:
                </Text>
                <Divider />
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="start">
                    <Badge>1</Badge>
                    <Text as="p" variant="bodyMd">
                      eBay Developer account with App ID, Cert ID, and Dev ID
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="start">
                    <Badge>2</Badge>
                    <Text as="p" variant="bodyMd">
                      eBay OAuth 2.0 authorization (recommended) or legacy Auth
                      Token
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="start">
                    <Badge>3</Badge>
                    <Text as="p" variant="bodyMd">
                      Shopify Partners account to create a custom app
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="start">
                    <Badge>4</Badge>
                    <Text as="p" variant="bodyMd">
                      PostgreSQL database (via Railway, Supabase, or similar)
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="start">
                    <Badge>5</Badge>
                    <Text as="p" variant="bodyMd">
                      Redis instance for the BullMQ job queue
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="start">
                    <Badge>6</Badge>
                    <Text as="p" variant="bodyMd">
                      Railway or similar platform for deployment
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
