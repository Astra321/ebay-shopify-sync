import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

/**
 * Lightweight polling endpoint for live sync status.
 * Returns the most recent syncLog row plus a count of total active mappings
 * so the dashboard can render a progress bar (itemsSynced / total).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [latest, totalMappings] = await Promise.all([
    db.syncLog.findFirst({
      where: { shop },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        itemsSynced: true,
        startedAt: true,
        finishedAt: true,
        _count: { select: { errors: true } },
      },
    }),
    db.skuMapping.count({ where: { shop, isActive: true } }),
  ]);

  return json({
    log: latest
      ? {
          id: latest.id,
          status: latest.status,
          itemsSynced: latest.itemsSynced,
          startedAt: latest.startedAt.toISOString(),
          finishedAt: latest.finishedAt?.toISOString() ?? null,
          errorCount: latest._count.errors,
        }
      : null,
    totalMappings,
  });
};
