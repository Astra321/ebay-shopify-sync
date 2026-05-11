import { Form } from "@remix-run/react";
import {
  Card, FormLayout, TextField, Button, Banner, BlockStack, Text, Divider, InlineStack,
} from "@shopify/polaris";
import { useState } from "react";

interface Props {
  saved: boolean;
  error?: string;
}

export function CredentialsForm({ saved, error }: Props) {
  const [appId, setAppId] = useState("");
  const [certId, setCertId] = useState("");
  const [devId, setDevId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [sellerId, setSellerId] = useState("");

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">eBay API Credentials</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Enter your eBay Developer credentials. All values are encrypted at rest using AES-256-GCM encryption,
            ensuring that your sensitive API keys and tokens remain protected even if the database is compromised.
            These credentials are only decrypted at runtime when needed for API calls.
          </Text>
        </BlockStack>

        {saved && <Banner tone="success" title="Credentials saved successfully. Your eBay integration is now active and ready to sync inventory." />}
        {error && <Banner tone="critical" title={error} />}

        <Divider />

        <Form method="post">
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="App ID (Client ID)"
                name="appId"
                value={appId}
                onChange={setAppId}
                autoComplete="off"
                helpText="Your eBay application ID from the developer portal"
              />
              <TextField
                label="Cert ID (Client Secret)"
                name="certId"
                value={certId}
                onChange={setCertId}
                autoComplete="off"
                helpText="Your eBay certificate ID for API authentication"
              />
            </FormLayout.Group>
            <TextField
              label="Dev ID"
              name="devId"
              value={devId}
              onChange={setDevId}
              autoComplete="off"
              helpText="Your eBay developer ID associated with your developer account"
            />
            <TextField
              label="User Auth Token"
              name="authToken"
              value={authToken}
              onChange={setAuthToken}
              multiline={4}
              autoComplete="off"
              helpText="Found in your eBay Developer account under User Tokens. This is a long-lived token that authorizes API calls on behalf of your seller account."
            />
            <TextField
              label="eBay Seller ID (username)"
              name="sellerId"
              value={sellerId}
              onChange={setSellerId}
              autoComplete="off"
              helpText="Your eBay seller username, used to fetch active listings"
            />
            <InlineStack align="end">
              <Button variant="primary" submit>Save Credentials</Button>
            </InlineStack>
          </FormLayout>
        </Form>
      </BlockStack>
    </Card>
  );
}
