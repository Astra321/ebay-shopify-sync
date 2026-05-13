import { createHash } from "crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

const ENDPOINT_URL =
  "https://ebay-shopify-sync-production.up.railway.app/webhooks/ebay-account-deletion";

/**
 * GET — eBay sends a challenge_code to verify ownership of the endpoint.
 * Must respond with SHA256(challengeCode + verificationToken + endpointUrl).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const challengeCode = url.searchParams.get("challenge_code");

  if (!challengeCode) {
    return json({ error: "Missing challenge_code" }, { status: 400 });
  }

  const verificationToken = process.env.EBAY_DELETION_TOKEN ?? "";
  const hash = createHash("sha256")
    .update(challengeCode + verificationToken + ENDPOINT_URL)
    .digest("hex");

  return json({ challengeResponse: hash });
};

/**
 * POST — eBay notifies us when a user requests account deletion.
 * We acknowledge receipt (200 OK). No user data to delete since
 * we only store inventory mappings tied to eBay item IDs, not PII.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  return new Response("OK", { status: 200 });
};
