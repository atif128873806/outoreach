import { test } from "node:test";
import assert from "node:assert/strict";

const { hourInTimeZone, isHourInWindow } = await import("../lib/timewindow.ts");

test("hourInTimeZone matches a known zone offset", () => {
  // 12:00 UTC is 07:00 or 08:00 in New York depending on DST — assert via Intl itself
  const at = new Date("2026-01-15T12:00:00Z"); // winter: EST = UTC-5
  assert.equal(hourInTimeZone("America/New_York", at), 7);
  assert.equal(hourInTimeZone("UTC", at), 12);
  assert.equal(hourInTimeZone("Asia/Karachi", at), 17); // UTC+5, no DST
});

test("hourInTimeZone handles midnight as 0, not 24", () => {
  const at = new Date("2026-01-15T00:30:00Z");
  assert.equal(hourInTimeZone("UTC", at), 0);
});

test("hourInTimeZone falls back to server time for empty or invalid zones", () => {
  const at = new Date("2026-01-15T12:00:00Z");
  assert.equal(hourInTimeZone("", at), at.getHours());
  assert.equal(hourInTimeZone("Not/AZone", at), at.getHours());
});

test("isHourInWindow: normal business-hours window", () => {
  assert.ok(isHourInWindow(9, 9, 17)); // start inclusive
  assert.ok(isHourInWindow(16, 9, 17));
  assert.ok(!isHourInWindow(17, 9, 17)); // end exclusive
  assert.ok(!isHourInWindow(3, 9, 17));
});

test("isHourInWindow: window wrapping midnight (20 → 6)", () => {
  assert.ok(isHourInWindow(23, 20, 6));
  assert.ok(isHourInWindow(2, 20, 6));
  assert.ok(!isHourInWindow(12, 20, 6));
});
