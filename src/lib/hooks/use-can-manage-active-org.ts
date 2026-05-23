"use client";

import { useSession } from "next-auth/react";

import { useOrganizationsQuery } from "@/api-client/organizations/queries";

/**
 * UI gate for "can edit admin surfaces?" — server twin is
 * `requireMember(..., "ADMIN")` in {@link src/server/auth/permissions.ts}.
 * Returns `false` during initial load (no flicker between hidden/shown);
 * reuses the `useOrganizationsQuery()` cache the global nav already warms.
 */
export function useCanManageActiveOrg(): boolean {
  const { data: session } = useSession();
  const { data: organizations } = useOrganizationsQuery();

  const activeOrgId = session?.user?.activeOrganizationId;
  if (!activeOrgId) return false;

  const activeOrg = organizations?.find((o) => o.id === activeOrgId);
  return activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";
}
