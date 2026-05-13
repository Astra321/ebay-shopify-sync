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

export function CredentialsForm({ saved, error, hasOAuth, oAuthUrl, defaultRuName = "" }: Props) {
  const [appId, setAppId] = useState("");
  const [certId, setCertId] = useState("");
  const [devId, setDevId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [redirectUri, setRedirectUri] = useState(defaultRuName);

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">eBay API Credentials</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Enter your eBay Developer credentials. All values are encrypted at rest using AES-256-GCM encryption.
            The preferred authentication method is OAuth 2.0 access tokens (recommended by eBay), which support
            automatic token refresh and use the modern REST API. Legacy Auth'n'Auth tokens are supported as a
            fallback but use the older XML Trading API.
          </Text>
        </BlockStack>

        {saved && <Banner tone="success" title="Credentials saved successfully. Your eBay integration is now active and ready to sync inventory." />}
        {error && <Banner tone="critical" title={error} />}
        {hasOAuth && <Banner tone="info" title="eBay OAuth 2.0 is connected. Access tokens will be automatically refreshed." />}

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
              label="eBay Seller ID (username)"
              name="sellerId"
              value={sellerId}
              onChange={setSellerId}
              autoComplete="off"
              helpText="Your eBay seller username, used to fetch active listings"
            />
            <TextField
              label="OAuth Redirect URI (RuName)"
              name="redirectUri"
              value={redirectUri}
              onChange={setRedirectUri}
              autoComplete="off"
              helpText="Pre-filled from your eBay developer portal RuName. Leave as-is unless you have a different RuName."
            />
            <Divider />
            <Text as="h3" variant="headingSm">Legacy Auth Token (Optional)</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Only needed if not using OAuth 2.0. This is the legacy Auth'n'Auth token from your eBay Developer account.
            </Text>
            <TextField
              label="User Auth Token (Legacy)"
              name="authToken"
              value={authToken}
              onChange={setAuthToken}
              multiline={4}
              autoComplete="off"
              helpText="Found in your eBay Developer account under User Tokens. Only used as fallback if OAuth is not configured."
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
