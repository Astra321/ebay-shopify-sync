import { LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { exchangeEbayAuthCode } from "../services/ebay.server";
import { encrypt } from "../services/crypto.server";

/**
 * eBay OAuth 2.0 callback route.
 * eBay redirects here after the user grants consent.
 * Exchanges the authorization code for access + refresh tokens.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // shop name

  if (!code || !state) {
    return json({ error: "Missing authorization code or state parameter" }, { status: 400 });
  }

  const shop = state;
  const cred = await db.ebayCredential.findUnique({ where: { shop } });

  if (!cred || !cred.redirectUri) {
    return json({ error: "No eBay credentials or redirect URI configured for this shop" }, { status: 400 });
  }

  try {
    // Decrypt the App ID and Cert ID to exchange the auth code
    const { decrypt } = await import("../services/crypto.server");
    const appId = decrypt(cred.appId);
    const certId = decrypt(cred.certId);

    const tokens = await exchangeEbayAuthCode(appId, certId, code, cred.redirectUri);

    // Store the encrypted tokens
    await db.ebayCredential.update({
      where: { shop },
      data: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        accessTokenExpiry: new Date(Date.now() + (tokens.expiresIn - 60) * 1000),
      },
    });

    // Redirect back to the Shopify app settings page
    return redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/settings?oauth=success`);
  } catch (err: any) {
    console.error("[ebay-oauth] Token exchange failed:", err.message);
    return json({ error: `OAuth token exchange failed: ${err.message}` }, { status: 500 });
  }
};
