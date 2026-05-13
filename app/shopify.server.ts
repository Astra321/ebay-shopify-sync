import { shopifyApp, DeliveryMethod } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { db } from "./db.server";

// Lazy Shopify app initialization — only creates the full app when needed.
// In standalone/demo mode, the /app/* routes redirect to /demo/* instead.

let _shopify: ReturnType<typeof shopifyApp> | null = null;

function getShopify() {
  if (!_shopify) {
    _shopify = shopifyApp({
      apiKey: process.env.SHOPIFY_API_KEY || "dummy-key",
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "dummy-secret",
      appUrl:
        process.env.SHOPIFY_APP_URL ??
        process.env.HOST ??
        "http://localhost:3000",
      scopes: (
        process.env.SCOPES ??
        "write_products,write_inventory,read_orders"
      ).split(","),
      sessionStorage: new PrismaSessionStorage(db),
      apiVersion: "2024-01",
      distributable: true,
      future: {
        unstable_newEmbeddedAuthStrategy: true,
      },
      ...(process.env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
        : {}),
      auth: {
        path: "/auth",
        loginPath: "/auth/login",
        callbackPath: "/auth/callback",
      },
      webhooks: {
        ORDERS_PAID: {
          deliveryMethod: DeliveryMethod.Http,
          callbackUrl: "/webhooks/orders-paid",
        },
        INVENTORY_LEVELS_UPDATE: {
          deliveryMethod: DeliveryMethod.Http,
          callbackUrl: "/webhooks/inventory",
        },
      },
      hooks: {
        afterAuth: async ({ session }) => {
          shopify.registerWebhooks({ session });
          const { triggerImmediateSync, schedulePeriodicSync } = await import(
            "./queue.server"
          );
          await schedulePeriodicSync(session.shop);
          await triggerImmediateSync(session.shop);
        },
      },
    });
  }
  return _shopify;
}

// Use a proxy so that `import shopify from "./shopify.server"` works
// but the heavy initialization is deferred until a property is actually accessed.
const shopifyProxy = new Proxy({} as ReturnType<typeof shopifyApp>, {
  get(_target, prop) {
    const app = getShopify();
    const value = (app as any)[prop];
    return typeof value === "function" ? value.bind(app) : value;
  },
});

export default shopifyProxy;
export const apiVersion = new Proxy(
  {},
  { get: () => getShopify().apiVersion }
);
export const addDocumentResponseHeaders = new Proxy(
  {},
  { get: () => getShopify().addDocumentResponseHeaders }
);
export const authenticate = new Proxy(
  {},
  { get: (_t, prop) => (getShopify().authenticate as any)[prop] }
);
export const unauthenticated = new Proxy(
  {},
  { get: () => getShopify().unauthenticated }
);
export const login = new Proxy({}, { get: () => getShopify().login });
export const registerWebhooks = new Proxy(
  {},
  { get: () => getShopify().registerWebhooks }
);
