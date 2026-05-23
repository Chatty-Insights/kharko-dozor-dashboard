import { withAuth } from "@/app/api/_lib/with-auth";
import { updateProjectSchema } from "@/api-client/projects/schemas";
import { requireProjectMember } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { getLogger } from "@/server/logger";

const log = getLogger("api-project-by-id");

type Params = { projectId: string };

/** ADMIN+ — metadata only, not key lifecycle. */
export const PATCH = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "ADMIN");

  const body = updateProjectSchema.parse(await req.json());

  await prisma.project.update({
    where: { id: projectId },
    data: { name: body.name },
  });

  log.info({ projectId, name: body.name, byUserId: user.id }, "project:rename:ok");

  return new Response(null, { status: 204 });
});

/**
 * OWNER-only. Cascades sessions → event batches + markers → tracked users. ADMIN can
 * replace a leaked key (regen) but never wipe history — dataset destruction
 * stays governance-tier.
 */
export const DELETE = withAuth<Params>(async (req, user, { projectId }) => {
  await requireProjectMember(user.id, projectId, "OWNER");

  await prisma.project.delete({ where: { id: projectId } });

  log.info({ projectId, byUserId: user.id }, "project:delete:ok");

  return new Response(null, { status: 204 });
});
