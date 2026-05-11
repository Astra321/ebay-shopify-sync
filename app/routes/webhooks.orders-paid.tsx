import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { EbayClient } from "../services/ebay.server";
import { decrypt } from "../services/crypto.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_PAID") return new Response("ok");

  const cred = await db.ebayCredential.findUnique({ where: { shop } });
  if (!cred) return new Response("ok");

  const ebay = new EbayClient({
    appId: decrypt(cred.appId),
    certId: decrypt(cred.certId),
    devId: decrypt(cred.devId),
    authToken: cred.authToken ? decrypt(cred.authToken) : "",
    sellerId: cred.sellerId,
    accessToken: cred.accessToken ? decrypt(cred.accessToken) : undefined,
    refreshToken: cred.refreshToken ? decrypt(cred.refreshToken) : undefined,
    accessTokenExpiry: cred.accessTokenExpiry ?? undefined,
  });

  const lineItems: Array<{ variant_id: string; quantity: number }> = payload.line_items ?? [];

  for (const item of lineItems) {
    const mapping = await db.skuMapping.findFirst({
      where: { shop, shopifyVariantId: String(item.variant_id) },
    });
    if (!mapping) continue;

    try {
      // Fetch current eBay qty and reduce by sold amount
      const qtys = await ebay.getItemQuantities([mapping.ebayItemId]);
      const newQty = Math.max(0, (qtys[mapping.ebayItemId] ?? 0) - item.quantity);
      await ebay.updateQuantity(mapping.ebayItemId, newQty);
    } catch (err: any) {
      console.error(`[webhook] Failed to update eBay ${mapping.ebayItemId}:`, err.message);
    }
  }

  return new Response("ok");
};
