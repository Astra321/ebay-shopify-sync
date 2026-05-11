import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { runSync } from "../app/services/sync-engine.server";

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const db = new PrismaClient();

const worker = new Worker(
  "inventory-sync",
  async (job) => {
    const { shop } = job.data;
    console.log(`[sync] Starting sync for ${shop}`);

    const session = await db.session.findFirst({ where: { shop, isOnline: false } });
    if (!session) {
      console.warn(`[sync] No session found for ${shop} — skipping`);
      return;
    }

    const log = await db.syncLog.create({ data: { shop, jobId: String(job.id) } });

    try {
      const { synced, errors } = await runSync(shop, session.accessToken);

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
