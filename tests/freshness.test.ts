import { test } from "node:test";
import assert from "node:assert/strict";

const { asEpochMs, describeFreshness, describeRecheck, isFresh, isOlderThan } = await import(
  "../lib/freshness.ts"
);

const NOW = Date.parse("2026-09-29T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

test("describeFreshness words an audit's age the way a person reads it", () => {
  assert.equal(describeFreshness(ago(5), NOW), "checked just now");
  assert.equal(describeFreshness(ago(89), NOW), "checked just now");
  assert.equal(describeFreshness(ago(60 * 4), NOW), "checked 4 minutes ago");
  assert.equal(describeFreshness(ago(3600), NOW), "checked 1 hour ago");
  assert.equal(describeFreshness(ago(3600 * 5), NOW), "checked 5 hours ago");
  assert.equal(describeFreshness(ago(86_400), NOW), "checked 1 day ago");
  assert.equal(describeFreshness(ago(86_400 * 3), NOW), "checked 3 days ago");
  assert.equal(describeFreshness(ago(86_400 * 60), NOW), "checked 2 months ago");
});

test("an unknown check date says so rather than implying freshness", () => {
  // A missing date is the one case where the honest answer is not a duration:
  // it is that we cannot tell, which must never read as "just now".
  assert.equal(describeFreshness(undefined, NOW), "check date unknown");
  assert.equal(describeFreshness(null, NOW), "check date unknown");
  assert.equal(describeFreshness("not a date", NOW), "check date unknown");
  assert.equal(describeFreshness("", NOW), "check date unknown");
  assert.equal(describeFreshness(0, NOW), "check date unknown");
});

test("a site audit older than three days is flagged as worth re-checking", () => {
  const THREE_DAYS = 3 * 86_400;
  assert.ok(!isOlderThan(ago(86_400), THREE_DAYS, NOW));
  assert.ok(isOlderThan(ago(86_400 * 4), THREE_DAYS, NOW));
  // No date is never treated as fresh: unknown age is not a reason to trust it.
  assert.ok(isOlderThan(undefined, THREE_DAYS, NOW));
});

test("asEpochMs accepts what the database and JSON actually hand back", () => {
  assert.equal(asEpochMs(new Date(NOW)), NOW);
  assert.equal(asEpochMs("2026-09-29T12:00:00Z"), NOW);
  assert.equal(asEpochMs(NOW), NOW);
  assert.equal(asEpochMs(undefined), 0);
  assert.equal(asEpochMs("nonsense"), 0);
  assert.equal(asEpochMs(NaN), 0);
});

test("a re-check reports the comparison, not the word 'updated'", () => {
  const threeDays = 3 * 86_400;
  // The finding moved, and the user needs to know which way and how long we
  // were quoting the old one.
  assert.equal(
    describeRecheck({ ageSeconds: threeDays, score: 82 }, 74, NOW),
    "82 → 74/100 (worse), 3 days ago"
  );
  assert.equal(
    describeRecheck({ ageSeconds: 7200, score: 40 }, 65, NOW),
    "40 → 65/100 (better), 2 hours ago"
  );
  // Nothing moved: say so, because that is what the user pressed the button to
  // find out — the cached audit was still the truth.
  assert.equal(describeRecheck({ ageSeconds: threeDays, score: 82 }, 82, NOW), "still 82/100, 3 days ago");
  assert.equal(describeRecheck(null, 91, NOW), "checked for the first time");
  // A first look at a site we had no audit for, and a visit with no score: both
  // must avoid inventing a comparison.
  assert.equal(
    describeRecheck({ ageSeconds: 600, score: null }, 88, NOW),
    "checked again, 10 minutes ago"
  );
  assert.equal(
    describeRecheck({ ageSeconds: 600, score: 70 }, null, NOW),
    "checked again, 10 minutes ago"
  );
});

test("isFresh compares against the row's own age, not the clock alone", () => {
  assert.ok(isFresh(ago(60), 300, NOW));
  assert.ok(!isFresh(ago(600), 300, NOW));
  assert.ok(!isFresh(null, 300, NOW));
});
