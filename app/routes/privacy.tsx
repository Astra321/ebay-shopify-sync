import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy — eBay-Shopify Sync" },
];

export default function Privacy() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", lineHeight: 1.6, color: "#333" }}>
      <h1>Privacy Policy</h1>
      <p><em>Last updated: May 2026</em></p>

      <h2>1. What We Collect</h2>
      <p>
        eBay-Shopify Sync collects only the data necessary to synchronize inventory
        between your eBay seller account and your Shopify store:
      </p>
      <ul>
        <li>Your Shopify shop domain and OAuth access token (stored encrypted)</li>
        <li>Your eBay OAuth access and refresh tokens (stored encrypted with AES-256-GCM)</li>
        <li>eBay listing IDs and Shopify product/variant IDs used to map inventory</li>
        <li>Inventory quantity records for sync operations</li>
      </ul>

      <h2>2. What We Do Not Collect</h2>
      <ul>
        <li>Personal information about your customers</li>
        <li>Payment or financial data</li>
        <li>Passwords or eBay account credentials beyond OAuth tokens</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <p>
        All collected data is used solely to perform inventory synchronization between
        eBay and Shopify on your behalf. We do not sell, share, or disclose your data
        to any third party.
      </p>

      <h2>4. Data Storage and Security</h2>
      <p>
        All tokens and credentials are encrypted at rest using AES-256-GCM before being
        stored in a PostgreSQL database hosted on Railway. Access is restricted to the
        application service.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        Your data is retained for as long as your account is active. You may request
        deletion of your data at any time by contacting us.
      </p>

      <h2>6. eBay Account Deletion</h2>
      <p>
        We comply with eBay's Marketplace Account Deletion notification process. Upon
        receiving an account deletion notification from eBay, any inventory mappings
        associated with that account are removed from our system.
      </p>

      <h2>7. Contact</h2>
      <p>
        For privacy questions or data deletion requests, contact us at:{" "}
        <a href="mailto:maadoo762@gmail.com">maadoo762@gmail.com</a>
      </p>
    </main>
  );
}
