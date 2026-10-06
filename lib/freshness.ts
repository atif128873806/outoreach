/**
 * How old is this fact?
 *
 * Deliberately its own module with no imports: the search UI is a client
 * component and has to answer "when was this site actually checked", while the
 * cache (lib/search-cache.ts) answers the same question server-side. Importing
 * the cache into a browser bundle would drag `node:async_hooks` with it, and
 * having two different ideas of what "3 days ago" means is exactly the sort of
 * drift that turns a date on a screen into a lie.
 */

/** Parses whatever the database or JSON handed us into epoch milliseconds. */
export function asEpochMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Whether a cached row is still usable. An unreadable timestamp counts as
 * expired — a value whose age cannot be established cannot claim to be current,
 * and going back to the source is always a correct answer.
 */
export function isFresh(refreshedAt: unknown, ttlSeconds: number, now = Date.now()): boolean {
  const at = asEpochMs(refreshedAt);
  if (at <= 0) return false;
  return now - at < ttlSeconds * 1000;
}

/** True when a fact was fetched longer ago than `seconds`. No date = too old. */
export function isOlderThan(
  at: string | number | Date | null | undefined,
  seconds: number,
  now = Date.now()
): boolean {
  const ms = asEpochMs(at);
  if (ms <= 0) return true;
  return now - ms > seconds * 1000;
}

/**
 * How old a checked fact is, in words.
 *
 * Coarse on purpose: "checked 3 days ago" is what someone needs before quoting
 * a finding at a prospect, not a stopwatch. Say "check date unknown" rather than
 * implying freshness we cannot prove.
 */
export function describeFreshness(
  at: string | number | Date | null | undefined,
  now = Date.now()
): string {
  const ms = asEpochMs(at);
  if (ms <= 0) return "check date unknown";
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 90) return "checked just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `checked ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `checked ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 45) return `checked ${days} day${days === 1 ? "" : "s"} ago`;
  return `checked ${Math.round(days / 30)} months ago`;
}

/**
 * What a re-check should say to the person who asked for it.
 *
 * The point of a re-check is to learn whether the audit they were shown still
 * holds, so the answer is the comparison, not the word "updated": "82 → 74/100
 * (worse) since 3 days ago" tells them to lead with the finding, and "still
 * 82/100 after 3 days" tells them the cache was right and they can stop
 * worrying. Both are useful; "updated" is neither.
 */
export function describeRecheck(
  previous: { ageSeconds: number; score: number | null } | null,
  scoreAfter: number | null,
  now = Date.now()
): string {
  if (!previous) return "checked for the first time";
  const when = describeFreshness(now - previous.ageSeconds * 1000, now).replace(/^checked /, "");
  if (previous.score === null || scoreAfter === null) return `checked again, ${when}`;
  if (previous.score === scoreAfter) return `still ${scoreAfter}/100, ${when}`;
  const direction = scoreAfter < previous.score ? "worse" : "better";
  return `${previous.score} → ${scoreAfter}/100 (${direction}), ${when}`;
}
