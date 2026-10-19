import "server-only";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { getLogger } from "@/server/logger";

const log = getLogger("auth-signin-callback");
import type { NextAuthConfig } from "next-auth";

type SignInCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["signIn"]>;

/**
 * OAuth providers verify the email — backfill `emailVerified` if still null.
 * `updateMany` (not `update`) because the where clause needs `emailVerified: null`,
 * which Prisma's `update` ignores when paired with a unique id filter.
 */
export const signInCallback: SignInCallback = async ({ user, account }) => {
  const allowedDomains = env.ALLOWED_EMAIL_DOMAINS;
  if (allowedDomains?.length) {
    const domain = user?.email?.split("@").pop()?.toLowerCase();
    if (!domain || !allowedDomains.includes(domain)) {
      log.warn(
        { email: user?.email ?? null, provider: account?.provider ?? null },
        "auth:signin:callback:domain-rejected",
      );
      return false;
    }
  }

  if (account?.type === "oidc" || account?.type === "oauth") {
    if (user?.id) {
      await prisma.user.updateMany({
        where: { id: user.id, emailVerified: null },
        data: { emailVerified: new Date() },
      });
    }
  }

  log.info(
    {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      provider: account?.provider ?? null,
      accountType: account?.type ?? null,
    },
    "auth:signin:callback:ok",
  );

  return true;
};
