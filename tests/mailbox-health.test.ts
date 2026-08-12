import { test } from "node:test";
import assert from "node:assert/strict";

const { getMailboxHealthStatus } = await import("../lib/mailbox-health.ts");

const now = new Date("2026-08-09T12:00:00.000Z");

test("mailbox health distinguishes setup, first check, and success", () => {
  assert.equal(
    getMailboxHealthStatus({ configured: false, lastCheck: "", lastError: "", now }),
    "not_configured"
  );
  assert.equal(
    getMailboxHealthStatus({ configured: true, lastCheck: "", lastError: "", now }),
    "checking"
  );
  assert.equal(
    getMailboxHealthStatus({
      configured: true,
      lastCheck: "2026-08-09T11:55:00.000Z",
      lastError: "",
      now,
    }),
    "healthy"
  );
});

test("mailbox errors take priority and stale checks are surfaced", () => {
  assert.equal(
    getMailboxHealthStatus({
      configured: true,
      lastCheck: "2026-08-09T11:59:00.000Z",
      lastError: "read ECONNRESET",
      now,
    }),
    "error"
  );
  assert.equal(
    getMailboxHealthStatus({
      configured: true,
      lastCheck: "2026-08-09T11:40:00.000Z",
      lastError: "",
      now,
    }),
    "stale"
  );
});
