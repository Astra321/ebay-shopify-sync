import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const syncQueue = new Queue("inventory-sync", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export async function schedulePeriodicSync(shop: string) {
  await syncQueue.add(
    "sync",
    { shop },
    {
      repeat: { every: 15 * 60 * 1000 },
      jobId: `periodic-${shop}`,
    }
  );
}

export async function triggerImmediateSync(shop: string) {
  await syncQueue.add("sync", { shop }, { priority: 1 });
}
