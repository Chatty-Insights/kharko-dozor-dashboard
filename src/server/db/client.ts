/**
 * Chatty self-host: plain Postgres in our cluster over TCP, so `PrismaPg` instead
 * of the upstream `PrismaNeon` (Neon's serverless driver cannot reach a vanilla Postgres).
 */

import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
