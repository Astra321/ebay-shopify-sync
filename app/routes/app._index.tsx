import { LoaderFunctionArgs, redirect } from "@remix-run/node";

/**
 * Redirects /app → /demo in standalone mode (no Shopify credentials).
 * In production with Shopify installed, this route handles the embedded app.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const isStandalone =
    !process.env.SHOPIFY_API_KEY || process.env.STANDALONE === "true";

  if (isStandalone) {
    return redirect("/demo");
  }

  // In production, this would be the Shopify-embedded dashboard.
  // For now, redirect to demo mode as well since we can't authenticate.
  try {
    const { authenticate } = await import("../shopify.server");
    // If we get here with real Shopify credentials, authenticate will handle it
    const { session } = await (authenticate as any).admin(request);
    const shop = session.shop;

    const { db } = await import("../db.server");
    const [totalMapped, lastLog, recentErrors, hasCreds] = await Promise.all([
      db.skuMapping.count({ where: { shop, isActive: true } }),
      db.syncLog.findFirst({
        where: { shop },
        orderBy: { startedAt: "desc" },
        include: { errors: { take: 5 } },
      }),
      db.syncError.findMany({
        where: { syncLog: { shop } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { syncLog: true },
      }),
      db.ebayCredential.findUnique({ where: { shop } }),
    ]);

    return {
      totalMapped,
      lastLog: lastLog
        ? {
            status: lastLog.status,
            startedAt: lastLog.startedAt.toISOString(),
            finishedAt: lastLog.finishedAt?.toISOString() ?? null,
            itemsSynced: lastLog.itemsSynced,
          }
        : null,
      errorCount: recentErrors.length,
      hasCreds: !!hasCreds,
    };
  } catch {
    return redirect("/demo");
  }
};

export default function AppIndex() {
  // This component is only rendered when Shopify auth succeeds
  // Otherwise, the loader redirects to /demo
  return null;
}
