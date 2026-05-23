/**
 * One snapshot per locale — translation edits show up in the
 * `__snapshots__/email-template.test.ts.snap` diff alongside the JSON
 * change. Token + `<html lang>` + CSS block stay identical across locales,
 * so a structural tweak that touches every snapshot is loud at review.
 */

import { describe, expect, it } from "vitest";
import type { getTranslations } from "next-intl/server";

import { LOCALES } from "@/i18n/config";

import { realTranslator } from "../../../../tests/helpers/translator";
import { otpEmailHtml } from "./email-template";

type OtpTranslator = Awaited<ReturnType<typeof getTranslations<"emailOtp">>>;

describe("otpEmailHtml", () => {
  it.each(LOCALES)("renders for locale %s", async (locale) => {
    const t = (await realTranslator(locale, "emailOtp")) as unknown as OtpTranslator;
    const html = otpEmailHtml("123456", locale, t);
    expect(html).toMatchSnapshot();
  });

  it("always embeds the provided token verbatim", async () => {
    const t = (await realTranslator("en", "emailOtp")) as unknown as OtpTranslator;
    const html = otpEmailHtml("000111", "en", t);
    expect(html).toContain("000111");
  });

  it("sets <html lang> to the provided locale", async () => {
    const t = (await realTranslator("uk", "emailOtp")) as unknown as OtpTranslator;
    const html = otpEmailHtml("123456", "uk", t);
    expect(html).toMatch(/<html lang="uk">/);
  });
});
