import { SESSION_RETENTION_MS } from "@/lib/time";

/**
 * `retention` is the widest preset (not "All time") because sessions older than
 * `SESSION_RETENTION_DAYS` are hard-deleted by the nightly cron — advertising
 * "All time" while the DB physically can't hold older data was a UX lie. Its
 * lower bound AND its label both track `SESSION_RETENTION_DAYS` (via
 * `dateRangeToFrom`'s `SESSION_RETENTION_MS` anchor and the ICU `{days}` arg),
 * so changing retention in `lib/time.ts` reshapes the preset with no edit here.
 * Only `today` and the retention-wide window are offered: fixed presets like
 * "Last 30 days" are meaningless at a 7-day retention (they'd show a range the
 * DB can't hold), so the set stays honest rather than padded.
 */
export const SESSION_DATE_RANGES = ["today", "retention"] as const;
export type SessionDateRange = (typeof SESSION_DATE_RANGES)[number];

export const DEFAULT_SESSION_DATE_RANGE: SessionDateRange = "retention";

export function dateRangeToFrom(range: SessionDateRange, now = new Date()): Date {
  switch (range) {
    case "today": {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case "retention":
      return new Date(now.getTime() - SESSION_RETENTION_MS);
  }
}

export function parseSessionDateRange(raw: string | null | undefined): SessionDateRange {
  if (raw && (SESSION_DATE_RANGES as readonly string[]).includes(raw)) {
    return raw as SessionDateRange;
  }
  return DEFAULT_SESSION_DATE_RANGE;
}
