import { withAuth } from "@/app/api/_lib/with-auth";
import { userAvatarResponseSchema } from "@/api-client/user/schemas";
import { userAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/server/db/client";
import { getLogger } from "@/server/logger";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const log = getLogger("api-user-avatar");

/** Returns the new URL so the client updates its avatar slot without a full profile refetch. */
export const POST = withAuth(async (req, user) => {
  const newImage = userAvatarUrl(randomUUID());

  await prisma.user.update({
    where: { id: user.id },
    data: { image: newImage },
  });

  log.info({ userId: user.id }, "user:avatar:regenerate:ok");

  return NextResponse.json(userAvatarResponseSchema.parse({ image: newImage }));
});
