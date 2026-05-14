import { LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { db } from "../db.server";
import { exchangeEbayAuthCode } from "../services/ebay.server";
import { encrypt } from "../services/crypto.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // shop name

  if (!code || !state) {
    return json({ error: "Missing authorization code or state parameter" }, { status: 400 });
  }

  // App-level credentials always come from env vars
  const appId = process.env.EBAY_APP_ID ?? "";
  const certId = process.env.EBAY_CERT_ID ?? "";
  const ruName = process.env.EBAY_RUNAME ?? "";

  if (!appId || !certId || !ruName) {
    return json({ error: "App eBay credentials not configured" }, { status: 500 });
  }

  const shop = state;

  try {
    const tokens = await exchangeEbayAuthCode(appId, certId, code, ruName);

    await db.ebayCredential.upsert({
      where: { shop },
      create: {
        shop,
        appId: encrypt(appId),
        certId: encrypt(certId),
        devId: encrypt(process.env.EBAY_DEV_ID ?? ""),
        authToken: "",
        sellerId: "",
        redirectUri: ruName,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        accessTokenExpiry: new Date(Date.now() + (tokens.expiresIn - 60) * 1000),
      },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        accessTokenExpiry: new Date(Date.now() + (tokens.expiresIn - 60) * 1000),
      },
    });

    return redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/settings?oauth=success`);
  } catch (err: any) {
    console.error("[ebay-oauth] Token exchange failed:", err.message);
    return json({ error: `OAuth token exchange failed: ${err.message}` }, { status: 500 });
  }
};
