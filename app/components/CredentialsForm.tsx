import { Form } from "@remix-run/react";
import {
  Card, FormLayout, TextField, Button, Banner, BlockStack, Text, Divider, InlineStack,
} from "@shopify/polaris";
import { useState } from "react";

interface Props {
  saved: boolean;
  error?: string;
  hasOAuth?: boolean;
  oAuthUrl?: string;
  defaultRuName?: string;
}

export function CredentialsForm({ saved, error, hasOAuth, oAuthUrl }: Props) {
  const [sellerId, setSellerId] = useState("");

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">Connect Your eBay Account</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Enter your eBay username to get started. After saving, you'll be redirected to eBay
            to grant the app permission to manage your inventory.
          </Text>
        </BlockStack>

        {saved && <Banner tone="success" title="Account saved. Click the button below to connect with eBay." />}
        {error && <Banner tone="critical" title={error} />}
        {hasOAuth && <Banner tone="success" title="eBay is connected. Your inventory will stay in sync automatically." />}

        <Divider />

        <Form method="post">
          <FormLayout>
            <TextField
              label="eBay Username"
              name="sellerId"
              value={sellerId}
              onChange={setSellerId}
              autoComplete="off"
              placeholder="e.g. john_seller_99"
              helpText="Your eBay seller username — the name you log into eBay with"
            />
            <InlineStack align="end">
              <Button variant="primary" submit disabled={!sellerId.trim()}>Save & Continue</Button>
            </InlineStack>
          </FormLayout>
        </Form>

        {oAuthUrl && !hasOAuth && (
          <BlockStack gap="300">
            <Divider />
            <Text as="p" variant="bodyMd" tone="subdued">
              After saving your username, click below to authorize the app on eBay.
              You'll be taken to eBay's sign-in page and redirected back automatically.
            </Text>
            <Button variant="primary" url={oAuthUrl} external>
              Connect with eBay
            </Button>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
