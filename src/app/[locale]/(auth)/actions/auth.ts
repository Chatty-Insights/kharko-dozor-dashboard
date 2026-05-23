"use server";

/**
 * Error codes are string sentinels (`"ACCOUNT_EXISTS"`, `"RATE_LIMITED"`) so
 * the client owns the copy — wording changes without re-deploying the server.
 */

import { signInSchema, signUpSchema } from "@/app/[locale]/(auth)/validators";
import { queryOtpRateLimit } from "@/server/auth/otp";
import { prisma } from "@/server/db/client";
import { env } from "@/server/env";
import { getLogger } from "@/server/logger";
import { cookies } from "next/headers";

const log = getLogger("auth-actions");

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

type CheckEmailResult = {
  exists: boolean;
  hasPasskey: boolean;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
};

export async function checkEmailExists(email: string): Promise<ActionResult<CheckEmailResult>> {
  const parsed = signInSchema.safeParse({ email });
  if (!parsed.success) {
    log.info({ email }, "auth:email_check:validation_failed");
    return { ok: false, error: "Invalid email" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: {
      authenticators: { select: { credentialID: true }, take: 1 },
    },
  });

  const result = {
    exists: !!user,
    hasPasskey: (user?.authenticators?.length ?? 0) > 0,
  };

  log.info({ email: parsed.data.email, ...result }, "auth:email_check:ok");

  return { ok: true, data: result };
}

export async function checkOtpRateLimit(email: string): Promise<ActionResult<RateLimitResult>> {
  const status = await queryOtpRateLimit(email);

  if (!status.allowed) {
    const reason = status.retryAfter ? "cooldown" : "daily_limit";
    log.warn({ email, retryAfter: status.retryAfter }, `auth:otp:${reason}_blocked`);
  } else {
    log.info({ email }, "auth:otp:rate_limit_ok");
  }

  return { ok: true, data: status };
}

export async function prepareSignUp(name: string, email: string): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({ name, email });
  if (!parsed.success) {
    log.info(
      { name, email, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      "auth:signup:validation_failed",
    );
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [existing, rateLimit] = await Promise.all([
    prisma.user.findUnique({ where: { email: parsed.data.email } }),
    queryOtpRateLimit(parsed.data.email),
  ]);

  if (existing) {
    log.info({ email: parsed.data.email }, "auth:signup:account_exists");
    return { ok: false, error: "ACCOUNT_EXISTS" };
  }

  if (!rateLimit.allowed) {
    log.warn({ email: parsed.data.email }, "auth:signup:rate_limited");
    return { ok: false, error: "RATE_LIMITED" };
  }

  const cookieStore = await cookies();
  cookieStore.set("pending_name", parsed.data.name, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
  });

  log.info({ name: parsed.data.name, email: parsed.data.email }, "auth:signup:ready");
  return { ok: true, data: undefined };
}

export async function prepareSignIn(email: string): Promise<ActionResult<{ hasPasskey: boolean }>> {
  const parsed = signInSchema.safeParse({ email });
  if (!parsed.success) {
    log.info({ email, error: parsed.error.issues[0]?.message ?? "Invalid input" }, "auth:signin:validation_failed");
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [emailResult, rateLimit] = await Promise.all([
    checkEmailExists(parsed.data.email),
    queryOtpRateLimit(parsed.data.email),
  ]);

  if (!emailResult.ok) return emailResult;

  if (!emailResult.data.exists) {
    log.info({ email: parsed.data.email }, "auth:signin:account_not_found");
    return { ok: false, error: "ACCOUNT_NOT_FOUND" };
  }

  if (!rateLimit.allowed) {
    log.warn({ email: parsed.data.email }, "auth:signin:rate_limited");
    return { ok: false, error: "RATE_LIMITED" };
  }

  log.info({ email: parsed.data.email, hasPasskey: emailResult.data.hasPasskey }, "auth:signin:ready");
  return { ok: true, data: { hasPasskey: emailResult.data.hasPasskey } };
}
