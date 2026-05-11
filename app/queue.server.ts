import { Queue } from "bullmq";
import IORedis from "ioredis";

let _connection: IORedis | null = null;
let _syncQueue: Queue | null = null;

/**
 * Lazily initialize Redis connection. Avoids crashing on startup when
 * Redis is unavailable — the queue will simply be unavailable until
 * Redis connects.
 */
function getConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });
    _connection.connect().catch((err) => {
      console.warn("[queue] Redis connection failed — sync queue unavailable:", err.message);
    });
  }
  return _connection;
}

export function getSyncQueue(): Queue {
  if (!_syncQueue) {
    _syncQueue = new Queue("inventory-sync", {
      connection: getConnection(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return _syncQueue;
}

export async function schedulePeriodicSync(shop: string) {
  try {
    await getSyncQueue().add(
      "sync",
      { shop },
      {
        repeat: { every: 15 * 60 * 1000 },
        jobId: `periodic-${shop}`,
      }
    );
  } catch (err: any) {
    console.error("[queue] Failed to schedule periodic sync:", err.message);
  }
}

export async function triggerImmediateSync(shop: string) {
  try {
    await getSyncQueue().add("sync", { shop }, { priority: 1 });
  } catch (err: any) {
    console.error("[queue] Failed to trigger immediate sync:", err.message);
  }
}
