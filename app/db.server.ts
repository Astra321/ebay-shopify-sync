import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Lazy Prisma client — only connects when a query is actually made.
// In standalone/demo mode, this is never accessed, so no DATABASE_URL needed.
function createPrismaClient() {
  try {
    return new PrismaClient();
  } catch (e) {
    console.warn(
      "[db] PrismaClient creation failed — running in standalone/demo mode.",
      e instanceof Error ? e.message : e
    );
    return null as unknown as PrismaClient;
  }
}

export const db = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
