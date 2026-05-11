import { shopifyApp, DeliveryMethod } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { db } from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  appUrl: process.env.SHOPIFY_APP_URL ?? process.env.HOST ?? "http://localhost:3000",
  scopes: (process.env.SCOPES ?? "write_products,write_inventory,read_orders").split(","),
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
      const { triggerImmediateSync, schedulePeriodicSync } = await import("./queue.server");
      await schedulePeriodicSync(session.shop);
      await triggerImmediateSync(session.shop);
    },
  },
});

export default shopify;
export const apiVersion = shopify.apiVersion;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
