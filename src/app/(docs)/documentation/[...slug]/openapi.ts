import "server-only";

import { createAPIPage } from "fumadocs-openapi/ui";

import { openapi } from "@/lib/openapi";

/**
 * `playground.enabled: false` — Fumadocs's playground panel requires the
 * optional peer `@scalar/api-client-react`, which we don't ship. Auth-gated
 * endpoints would need a live session anyway; deferring playground until
 * there's a concrete use case (e.g. self-hoster sandboxing `/api/ingest`
 * with their own public key).
 *
 * `github-light` + `vesper` matches Fumadocs's prose code-block pairing so
 * the API panes don't look like a different product.
 */
export const APIPage = createAPIPage(openapi, {
  playground: { enabled: false },
  shikiOptions: {
    themes: {
      light: "github-light",
      dark: "vesper",
    },
  },
});
