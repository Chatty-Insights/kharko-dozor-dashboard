import { ONE_DAY_MS, SESSION_RETENTION_DAYS } from "@/lib/time";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { getLogger } from "@/server/logger";
import { REAL_SESSION_FILTER } from "@/server/sessions/real-session-filter";
import { NextResponse } from "next/server";
import { z } from "zod";

const log = getLogger("cron-daily-cleanup");

/**
 * Tables reclaimed by step 6. Only the ones the delete steps churn — `EventBatch`
 * carries the gzip blobs (99% of volume), `Session`/`Marker`/`TrackedUser` are its
 * cascade fallout. Hardcoded identifiers (never user input) — safe to interpolate
 * into the `VACUUM FULL` statement, which cannot take bind parameters.
 */
const VACUUM_TABLES = ["EventBatch", "Marker", "Session", "TrackedUser"] as const;

/**
 * Reclaim physical disk space after the delete steps.
 *
 * `DELETE` only marks rows dead — Postgres keeps the bloated table file and reuses
 * its pages for future inserts, but never shrinks the file on disk. Neon's 512 MB
 * cluster-size limit counts that physical size, so a mostly-empty table can still
 * exceed the cap and make every `INSERT` (i.e. ingest) fail with SQLSTATE 53100.
 * `VACUUM FULL` rewrites each table into a fresh, compact file and returns the slack
 * to the OS — the only reclaim that moves the Neon-counted number down.
 *
 * Not wrapped in a transaction: `VACUUM` is illegal inside one. Each table runs in
 * its own `$executeRawUnsafe` and its own try/catch — a lock-timeout or transient
 * failure on one table must not abort the sweep, since the deletes already committed.
 * A failed table just reclaims next run; the failure is logged, not swallowed.
 *
 * `VACUUM FULL` takes an exclusive lock for the rewrite, so a concurrent ingest can
 * stall or 500 during it. Acceptable: the cron runs at 03:30 UTC (low traffic) and
 * the rewrite is seconds on a retention-capped table.
 */
async function reclaimDiskSpace(): Promise<number> {
  let vacuumed = 0;
  for (const table of VACUUM_TABLES) {
    try {
      await prisma.$executeRawUnsafe(`VACUUM (FULL, ANALYZE) "${table}"`);
      vacuumed += 1;
    } catch (err) {
      log.warn({ table, err: err instanceof Error ? err.message : String(err) }, "cron:cleanup:vacuum:failed");
    }
  }
  return vacuumed;
}

/**
 * Inline — Vercel Cron reads status codes + stdout, not the JSON body, so
 * api-client doesn't need this. The parse still runs as a drift sentinel.
 */
const cronCleanupSummarySchema = z.object({
  throwawaySessions: z.number().int().nonnegative(),
  invites: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  trackedUsers: z.number().int().nonnegative(),
  organizations: z.number().int().nonnegative(),
  vacuumedTables: z.number().int().nonnegative(),
});

/**
 * Ordered steps — each frees records for the next:
 *   1. Throwaway sessions (below the `MIN_REAL_SESSION_*` floor — SDK
 *      init+immediate-close artifacts hidden from every user-facing list).
 *      Cascades EventBatches + Markers, freeing TrackedUser rows for step 4.
 *   2. Invites past TTL (PENDING/EXPIRED).
 *   3. Sessions older than `SESSION_RETENTION_DAYS` (7 days — cascades EventBatches + Markers).
 *   4. TrackedUsers with zero sessions (orphans after steps 1 + 3).
 *   5. Memberless orgs. Active-org pointers MUST be nulled FIRST — schema
 *      doesn't declare `onDelete: SetNull` for `User.activeOrganizationId`,
 *      so Postgres would block the delete on referenced rows.
 *   6. `VACUUM FULL` the churned tables to return the freed disk space to the OS
 *      (steps 1-5 only mark rows dead; the file stays bloated otherwise). Runs
 *      last so it compacts exactly the space the deletes just freed. See
 *      `reclaimDiskSpace` for why this is required against Neon's size limit.
 *
 * Auth — Bearer matches `CRON_SECRET`. Prod with unset secret denies every
 * call (misconfigured deploy stays safe); dev/test with unset secret opens
 * the endpoint for curl.
 *
 * `GET` because Vercel Cron issues GET — destructive-on-GET is ugly but
 * fighting the contract isn't worth a wrapper.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !env.CRON_SECRET) {
    log.warn("cron:cleanup:unauthorized:secret_unconfigured");
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      log.warn({ hasHeader: Boolean(auth) }, "cron:cleanup:unauthorized");
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  log.info("cron:cleanup:start");

  const now = new Date();
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * ONE_DAY_MS);

  // Below-floor sessions get hidden from every user-facing surface immediately;
  // this step purges them so they don't keep blocking the orphan-TU sweep below.
  // `NOT REAL_SESSION_FILTER` = `eventCount < min OR duration < min`.
  const throwawaySessions = await prisma.session.deleteMany({
    where: { NOT: REAL_SESSION_FILTER },
  });

  const invites = await prisma.invite.deleteMany({
    where: {
      expiresAt: { lt: now },
      status: { in: ["PENDING", "EXPIRED"] },
    },
  });

  const sessions = await prisma.session.deleteMany({
    where: { createdAt: { lt: sessionCutoff } },
  });

  const trackedUsers = await prisma.trackedUser.deleteMany({
    where: { sessions: { none: {} } },
  });

  const emptyOrgs = await prisma.organization.findMany({
    where: { memberships: { none: {} } },
    select: { id: true },
  });
  const emptyOrgIds = emptyOrgs.map((o) => o.id);

  let orgsDeleted = 0;
  if (emptyOrgIds.length > 0) {
    await prisma.user.updateMany({
      where: { activeOrganizationId: { in: emptyOrgIds } },
      data: { activeOrganizationId: null },
    });
    const result = await prisma.organization.deleteMany({
      where: { id: { in: emptyOrgIds } },
    });
    orgsDeleted = result.count;
  }

  // Step 6 — reclaim disk space last, once every delete above has committed.
  const vacuumedTables = await reclaimDiskSpace();

  const summary = cronCleanupSummarySchema.parse({
    throwawaySessions: throwawaySessions.count,
    invites: invites.count,
    sessions: sessions.count,
    trackedUsers: trackedUsers.count,
    organizations: orgsDeleted,
    vacuumedTables,
  });

  log.info({ summary }, "cron:cleanup:summary");

  return NextResponse.json(summary);
}
