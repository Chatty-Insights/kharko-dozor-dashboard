import { infiniteQueryOptions, type QueryKey } from "@tanstack/react-query";
import { z } from "zod";

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export function cursorPageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** Renamed for the call site — pairs with `cursorPageSchema` so all cursor knobs travel under one import. */
export { keepPreviousData as cursorPlaceholderData } from "@tanstack/react-query";

type FetchPage<T> = (args: { cursor: string | undefined; signal: AbortSignal }) => Promise<CursorPage<T>>;

type CursorInfiniteOptions<T> = {
  queryKey: QueryKey;
  fetchPage: FetchPage<T>;
} & Partial<{
  staleTime: number;
  refetchInterval: number;
  refetchIntervalInBackground: boolean;
}>;

/**
 * `infiniteQueryOptions` wrapper for the dashboard's cursor-pagination
 * contract (`{ data, nextCursor }`) — feature factories declare key +
 * fetcher only. Pairs with `useSuspense{Infinite}Query` in shells so
 * `fetchNextPage()` never trips the closest Suspense boundary.
 */
export function cursorInfiniteQueryOptions<T>({ queryKey, fetchPage, ...rest }: CursorInfiniteOptions<T>) {
  return infiniteQueryOptions({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage({ cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: CursorPage<T>) => lastPage.nextCursor ?? undefined,
    ...rest,
  });
}

/** Flatten the `pages[]` shape returned by `useInfiniteQuery` into a single item list. */
export function flattenCursorPages<T>(pages: CursorPage<T>[]): T[] {
  return pages.flatMap((page) => page.data);
}
