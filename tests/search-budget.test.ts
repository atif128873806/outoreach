import { test } from "node:test";
import assert from "node:assert/strict";

const budget = await import("../lib/search-budget.ts");
const {
  SearchAllowanceSpentError,
  allowanceResetFrom,
  allowanceResumesAt,
  utcClock,
} = budget;

/**
 * These rules were written against one real 429 from the search endpoint:
 *
 *   HTTP/2 429
 *   retry-after: 15076
 *   x-ratelimit-limit: 0
 *   x-ratelimit-reset: 1790035200000
 *
 * That reset value is exactly 2026-09-22T00:00:00Z, which is what makes this
 * worth pinning: the shared free allowance is a DAILY budget, so telling a user
 * to "try again in a minute" would have them retrying all evening. Both header
 * shapes are checked here because only one of them was in the spec this code was
 * written from.
 */

/** Minimal stand-in for a `Response`-style header lookup. */
function headers(map: Record<string, string>): { get(name: string): string | null } {
  return { get: (name) => map[name.toLowerCase()] ?? null };
}

test("the allowance reset is read from retry-after, in seconds", () => {
  const now = Date.UTC(2026, 8, 21, 19, 48, 44);
  const at = allowanceResetFrom(headers({ "retry-after": "15076" }), now);
  assert.equal(at, now + 15_076_000);
  // …which is midnight UTC the next day, the real behaviour.
  assert.equal(new Date(at).toISOString(), "2026-09-22T00:00:00.000Z");
});

test("an epoch-millisecond reset header is read as a moment, not a duration", () => {
  const now = Date.UTC(2026, 8, 21, 19, 48, 44);
  const at = allowanceResetFrom(headers({ "x-ratelimit-reset": "1790035200000" }), now);
  assert.equal(new Date(at).toISOString(), "2026-09-22T00:00:00.000Z");
  // The same value in seconds is not ten-thousand-fold shorter than intended.
  assert.equal(
    new Date(allowanceResetFrom(headers({ "x-ratelimit-reset": "1790035200" }), now)).toISOString(),
    "2026-09-22T00:00:00.000Z"
  );
});

test("retry-after wins when both headers are present", () => {
  const now = Date.UTC(2026, 8, 21, 12, 0, 0);
  const at = allowanceResetFrom(
    headers({ "retry-after": "60", "x-ratelimit-reset": "1790035200000" }),
    now
  );
  assert.equal(at, now + 60_000);
});

test("an unusable header still resets at the end of the UTC day", () => {
  const now = Date.UTC(2026, 8, 21, 19, 48, 44);
  // Guessing late is the safe direction: retrying a spent allowance only makes
  // the wait longer, so an unknown reset must never come back sooner than the
  // real one did.
  const unusable: Record<string, string>[] = [{}, { "retry-after": "0" }, { "retry-after": "abc" }];
  for (const h of unusable) {
    const at = allowanceResetFrom(headers(h), now);
    assert.equal(new Date(at).toISOString(), "2026-09-22T00:00:00.000Z");
  }
  // Just after midnight, the end of the UTC day is the coming midnight.
  const early = Date.UTC(2026, 8, 22, 0, 30, 0);
  assert.equal(
    new Date(allowanceResetFrom(headers({}), early)).toISOString(),
    "2026-09-23T00:00:00.000Z"
  );
});

test("a spent allowance is remembered until it is actually available again", () => {
  const now = 1_000_000;
  const spentUntil = now + 3_600_000;
  // Spent: reported, so callers refuse without another request.
  assert.equal(allowanceResumesAt(spentUntil, now), spentUntil);
  assert.equal(allowanceResumesAt(spentUntil, spentUntil - 1), spentUntil);
  // Available: 0, so a call goes through.
  assert.equal(allowanceResumesAt(spentUntil, spentUntil), 0);
  assert.equal(allowanceResumesAt(spentUntil, spentUntil + 1), 0);
  // Nothing recorded means nothing is blocked.
  assert.equal(allowanceResumesAt(0, now), 0);
});

test("the clock a user reads is UTC, and says so", () => {
  assert.equal(utcClock(Date.UTC(2026, 8, 22, 0, 0, 0)), "00:00 UTC");
  assert.equal(utcClock(Date.UTC(2026, 8, 22, 9, 5, 0)), "09:05 UTC");
  assert.equal(utcClock(Date.UTC(2026, 8, 22, 17, 30, 0)), "17:30 UTC");
});

test("a spent allowance is its own error, not a busy minute", () => {
  const resumesAt = Date.UTC(2026, 8, 22, 0, 0, 0);
  const err = new SearchAllowanceSpentError(resumesAt);
  assert.equal(err.resumesAt, resumesAt);
  // The timestamp has to survive into the message the formatter sees, since the
  // friendly text is built from the error by identity, and the raw text is what
  // shows up in logs and support tickets.
  assert.match(err.message, /2026-09-22T00:00:00\.000Z/);
  assert.equal(err.name, "SearchAllowanceSpentError");
});
