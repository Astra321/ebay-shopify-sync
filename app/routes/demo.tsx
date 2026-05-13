import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { AppProvider, Frame, Navigation, TopBar } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import {
  HomeIcon,
  SettingsIcon,
  DataTableIcon,
  AlertTriangleIcon,
} from "@shopify/polaris-icons";

import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import appStyles from "../app.css?url";
import { useState } from "react";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: appStyles },
];

export default function DemoLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentPath = location.pathname;

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={() => setMobileNavOpen((v) => !v)}
      userMenu={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 8px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#2ecc71",
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 500, color: "#202223" }}>
            Demo Store
          </span>
        </div>
      }
    />
  );

  const navigationMarkup = (
    <Navigation location={currentPath}>
      <Navigation.Section
        title="SyncBridge"
        items={[
          {
            label: "Dashboard",
            icon: HomeIcon,
            url: "/demo",
            selected: currentPath === "/demo",
            onClick: () => navigate("/demo"),
          },
          {
            label: "SKU Mappings",
            icon: DataTableIcon,
            url: "/demo/mappings",
            selected: currentPath === "/demo/mappings",
            onClick: () => navigate("/demo/mappings"),
          },
          {
            label: "Error Log",
            icon: AlertTriangleIcon,
            url: "/demo/errors",
            selected: currentPath === "/demo/errors",
            onClick: () => navigate("/demo/errors"),
          },
          {
            label: "Settings",
            icon: SettingsIcon,
            url: "/demo/settings",
            selected: currentPath === "/demo/settings",
            onClick: () => navigate("/demo/settings"),
          },
        ]}
      />
      <Navigation.Section
        separator
        title="Links"
        items={[
          {
            label: "← Back to Homepage",
            url: "/",
            onClick: () => navigate("/"),
          },
        ]}
      />
    </Navigation>
  );

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0 }}>
        <AppProvider i18n={polarisTranslations}>
          <Frame
            topBar={topBarMarkup}
            navigation={navigationMarkup}
            showMobileNavigation={mobileNavOpen}
            onNavigationDismiss={() => setMobileNavOpen(false)}
          >
            <div style={{ padding: "16px 20px 40px" }}>
              <Outlet />
            </div>
          </Frame>
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
