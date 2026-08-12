import { test } from "node:test";
import assert from "node:assert/strict";

const { inspectEmailSyntax, verificationNeedsRefresh } = await import(
  "../lib/email-validation.ts"
);

test("email syntax inspection rejects malformed and disposable addresses", () => {
  assert.equal(inspectEmailSyntax("not-an-email").status, "invalid");
  assert.equal(inspectEmailSyntax("person@mailinator.com").status, "risky");
  assert.equal(inspectEmailSyntax("hello@example.com").status, "unchecked");
});

test("email domain checks refresh when missing, temporary, or stale", () => {
  const now = new Date("2026-08-09T12:00:00Z");
  assert.equal(verificationNeedsRefresh("unchecked", null, now), true);
  assert.equal(verificationNeedsRefresh("unknown", now.toISOString(), now), true);
  assert.equal(
    verificationNeedsRefresh("valid", "2026-08-01T12:00:00Z", now),
    false
  );
  assert.equal(
    verificationNeedsRefresh("valid", "2026-06-01T12:00:00Z", now),
    true
  );
});
