import type { useTranslations } from "next-intl";

import { isApiError } from "@/api-client/error";
import { assertNever } from "@/lib/assert-never";

/**
 * `ApiErrorKind` → product copy for `error.tsx` boundaries. New kinds
 * compile through every consumer via `assertNever`. `context` is the
 * localised noun owned by the feature; `t` is injected so this module
 * stays free of `"use client"`. `auth` branch fills the slim window
 * before `QueryCache.onError` in {@link src/lib/query-client.ts} lands
 * the hard-redirect.
 */
export type ErrorCopy = {
  title: string;
  description: string;
};

type ErrorsTranslator = ReturnType<typeof useTranslations<"errors">>;

export function getErrorCopy(error: unknown, context: string, t: ErrorsTranslator): ErrorCopy {
  if (!isApiError(error)) {
    return {
      title: t("generic.unknown"),
      description: t("generic.unknownDescription"),
    };
  }

  switch (error.kind) {
    case "not-found":
      return {
        title: t("apiKinds.notFoundTitle", { context }),
        description: t("apiKinds.notFoundDescription"),
      };
    case "permission":
      return {
        title: t("apiKinds.permissionTitle"),
        description: t("apiKinds.permissionDescription"),
      };
    case "auth":
      return {
        title: t("apiKinds.authTitle"),
        description: t("apiKinds.authDescription"),
      };
    case "rate-limit":
      return {
        title: t("apiKinds.rateLimitTitle"),
        description: t("apiKinds.rateLimitDescription"),
      };
    case "validation":
      return {
        title: t("apiKinds.validationTitle"),
        description: error.message || t("apiKinds.validationDescriptionFallback"),
      };
    case "conflict":
      return {
        title: t("apiKinds.conflictTitle"),
        description: t("apiKinds.conflictDescription"),
      };
    case "server":
      return {
        title: t("apiKinds.serverTitle"),
        description: t("apiKinds.serverDescription", { context: context.toLowerCase() }),
      };
    case "network":
      return {
        title: t("apiKinds.networkTitle"),
        description: t("apiKinds.networkDescription"),
      };
    default:
      return assertNever(error.kind);
  }
}
