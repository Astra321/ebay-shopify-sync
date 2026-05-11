import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import appStyles from "./app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: appStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ apiKey: process.env.SHOPIFY_API_KEY ?? "" });
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
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__SHOPIFY_API_KEY__ = "${data?.apiKey}";`,
          }}
        />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
