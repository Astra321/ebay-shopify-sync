import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  useLocation,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import appStyles from "./app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: appStyles },
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const isStandalone =
    !process.env.SHOPIFY_API_KEY || process.env.STANDALONE === "true";
  return json({
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    isStandalone,
  });
};

export default function App() {
  const data = useRouteLoaderData<typeof loader>("root");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {!data?.isStandalone && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__SHOPIFY_API_KEY__ = "${data?.apiKey}";`,
            }}
          />
        )}
      </head>
      <body style={{ margin: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
