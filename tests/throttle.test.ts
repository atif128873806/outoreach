import { test } from "node:test";
import assert from "node:assert/strict";

const {
  DEFAULT_MESSAGES_PER_HOUR,
  MAX_SINGLE_MAILBOX_PER_HOUR,
  normalizeHourlyRate,
  minimumSendIntervalMs,
  isSendDue,
} = await import("../lib/throttle.ts");

test("single-mailbox hourly rates are normalized conservatively", () => {
  assert.equal(normalizeHourlyRate(undefined), DEFAULT_MESSAGES_PER_HOUR);
  assert.equal(normalizeHourlyRate(0), 1);
  assert.equal(normalizeHourlyRate(10.4), 10);
  assert.equal(normalizeHourlyRate(600), MAX_SINGLE_MAILBOX_PER_HOUR);
});

test("minimum interval preserves low hourly rates", () => {
  assert.equal(minimumSendIntervalMs(10), 6 * 60_000);
  assert.equal(minimumSendIntervalMs(15), 4 * 60_000);
  assert.equal(minimumSendIntervalMs(60), 60_000);
});

test("send becomes due only after the configured interval", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");
  assert.equal(isSendDue(null, 10, now), true);
  assert.equal(isSendDue("2026-08-09T11:55:00.000Z", 10, now), false);
  assert.equal(isSendDue("2026-08-09T11:54:00.000Z", 10, now), true);
});
