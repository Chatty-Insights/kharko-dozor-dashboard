import { loader } from "fumadocs-core/source";
import { openapiPlugin, openapiSource } from "fumadocs-openapi/server";

import { openapi } from "@/lib/openapi";
import { docs } from "../../.source/server";

/**
 * Two-source Fumadocs loader. `baseUrl: "/documentation"` mounts both at the
 * same docs zone; the Record-form sets `page.type` to the source key, so the
 * `[...slug]/page.tsx` handler branches via `page.type === "openapi"` (the
 * MDX branch falls through to `page.type === "docs"`).
 *
 * MDX pages live under `src/app/(docs)/documentation/_content/` (`_` prefix
 * opts the dir out of routing); virtual OpenAPI pages are generated from the
 * Zod snapshot. `openapiPlugin()` decorates the sidebar with HTTP method
 * badges. `.source/` is gitignored — Fumadocs MDX plugin regenerates it on
 * each `next dev` / `next build`.
 */
export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      per: "operation",
      groupBy: "tag",
      baseDir: "api",
      meta: { folderStyle: "folder" },
      // Strip the literal `/api/` route prefix to avoid `api/<tag>/api/<route>/<method>.mdx`
      // paths — keeps URLs at `/documentation/api/<tag>/<method>-<route-slug>`. No webhooks
      // in our spec, so the webhook branch falls back to a safe `<method>-<name>` slug.
      name(output) {
        if (output.type === "operation") {
          const route = output.item.path
            .replace(/^\/api\//, "")
            .replace(/[{}]/g, "")
            .replace(/\//g, "-");
          return `${output.item.method.toLowerCase()}-${route}`;
        }
        return `${output.item.method.toLowerCase()}-${output.item.name}`;
      },
    }),
  },
  {
    baseUrl: "/documentation",
    plugins: [openapiPlugin()],
  },
);
