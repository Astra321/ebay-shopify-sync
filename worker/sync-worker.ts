import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { Session } from "@shopify/shopify-api";
import { runSync } from "../app/services/sync-engine.server";

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const db = new PrismaClient();

const worker = new Worker(
  "inventory-sync",
  async (job) => {
    const { shop } = job.data;
    console.log(`[sync] Starting sync for ${shop}`);

    // Load the offline (app-level) session from Prisma session storage
    const row = await db.session.findFirst({ where: { shop, isOnline: false } });
    if (!row) {
      console.warn(`[sync] No session found for ${shop} — skipping`);
      return;
    }

    // Construct a typed Session object from the stored row
    const shopifySession = new Session({
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
      accessToken: row.accessToken,
      scope: row.scope ?? undefined,
      expires: row.expires ?? undefined,
    });

    const log = await db.syncLog.create({ data: { shop, jobId: String(job.id) } });

    try {
      const { synced, errors } = await runSync(shop, shopifySession);

      await db.syncLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          status: errors.length === 0 ? "SUCCESS" : synced > 0 ? "PARTIAL" : "FAILED",
          itemsSynced: synced,
          errors: {
            create: errors.map((e) => ({ ebayItemId: e.ebayItemId, message: e.message })),
          },
        },
      });

      console.log(`[sync] Done: ${synced} synced, ${errors.length} errors`);
    } catch (err: any) {
      await db.syncLog.update({
        where: { id: log.id },
        data: { finishedAt: new Date(), status: "FAILED", errors: { create: [{ message: err.message }] } },
      });
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

worker.on("failed", (job, err) => {
  console.error(`[sync] Job ${job?.id} failed:`, err.message);
});

console.log("[sync] Worker started");
