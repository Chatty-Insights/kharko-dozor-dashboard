import { apiFetch } from "@/api-client/fetch";
import { routes } from "@/api-client/routes";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { userKeys } from "./keys";
import type { UserProfile } from "./schemas";

export const userQueries = {
  profile: () =>
    queryOptions({
      queryKey: userKeys.profile(),
      queryFn: ({ signal }) => apiFetch<UserProfile>(routes.user.me(), { signal }),
      staleTime: 5 * 60_000,
    }),
};

/** Classic — for surfaces that render before profile lands (e.g. shells reading from `useSession()` only). */
export function useUserProfileQuery() {
  return useQuery(userQueries.profile());
}

/** Suspense twin — for shells where the profile is core content. */
export function useUserProfileSuspenseQuery() {
  return useSuspenseQuery(userQueries.profile());
}
