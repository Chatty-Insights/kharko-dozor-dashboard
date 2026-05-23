import "server-only";
import { orgAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/server/db/client";
import { getLogger } from "@/server/logger";
import type { NextAuthConfig } from "next-auth";
import { randomUUID } from "node:crypto";

const log = getLogger("auth-events");

/**
 * `createUser` provisions a Personal Space org so the JWT callback's active-org
 * fallback always has somewhere to land. Idempotent — early-return if a Personal
 * Space already exists (handles a retried failed sign-up).
 */
export const authEvents: NextAuthConfig["events"] = {
  async createUser({ user }) {
    const userId = user.id;
    if (!userId) return;

    const existing = await prisma.organization.findFirst({
      where: { createdById: userId, type: "PERSONAL" },
    });
    if (existing) {
      log.debug({ userId }, "auth:create_user:personal_space_exists");
      return;
    }

    const personalOrg = await prisma.organization.create({
      data: {
        name: "Personal Space",
        type: "PERSONAL",
        image: orgAvatarUrl(randomUUID()),
        createdById: userId,
        memberships: {
          create: { userId, role: "OWNER" },
        },
      },
    });

    log.info(
      {
        userId,
        personalOrgId: personalOrg.id,
        email: user.email ?? null,
      },
      "auth:create_user:ok",
    );
  },
};
