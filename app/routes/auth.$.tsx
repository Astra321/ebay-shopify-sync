import type { LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.pathname === "/auth/login") {
    return login(request);
  }
  // /auth/callback and anything else — handled by the Shopify library via authenticate
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);
  return null;
};
