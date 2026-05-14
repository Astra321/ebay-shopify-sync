import type { LoaderFunctionArgs } from "@remix-run/node";
import shopify from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.pathname === "/auth/login") {
    return shopify.login(request);
  }
  await shopify.authenticate.admin(request);
  return null;
};
