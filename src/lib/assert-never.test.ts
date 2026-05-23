/**
 * Smoke test — proves the Vitest + TS-paths pipeline runs colocated
 * `*.test.ts` files without DB involvement. `assertNever`'s body is
 * intentionally trivial; this is the pipeline health check.
 */

import { describe, expect, it } from "vitest";

import { assertNever } from "./assert-never";

describe("assertNever", () => {
  it("throws at runtime when called with a non-never value (type-asserted)", () => {
    // Force a call through an `unknown` → `never` cast to exercise the
    // runtime branch. In real code, a type-safe caller would get a compile
    // error long before this throw matters.
    const rogue = "unexpected" as unknown as never;
    expect(() => assertNever(rogue)).toThrow(/Exhaustiveness check failed/);
  });
});
