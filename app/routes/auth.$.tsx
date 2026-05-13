import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Catch-all for /auth/login and /auth/callback — delegates entirely to the
// Shopify App Remix library which handles the OAuth flow automatically.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
