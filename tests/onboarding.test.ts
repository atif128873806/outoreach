import { test } from "node:test";
import assert from "node:assert/strict";

const { getOnboardingProgress } = await import("../lib/onboarding.ts");

const complete = {
  emailVerified: true,
  senderProfileConfigured: true,
  contacts: 10,
  previewed: true,
  postalConfigured: true,
  smtpTested: true,
  imapHealthy: true,
  realSent: 10,
};

test("onboarding always selects the first incomplete step", () => {
  const start = getOnboardingProgress({
    ...complete,
    emailVerified: false,
    senderProfileConfigured: false,
  });
  assert.equal(start.next?.id, "verify_email");

  const prospects = getOnboardingProgress({ ...complete, contacts: 9 });
  assert.equal(prospects.next?.id, "prospects");
  assert.match(prospects.next?.detail ?? "", /9\/10/);
});

test("users experience value before mailbox setup", () => {
  const steps = getOnboardingProgress(complete).steps.map((step) => step.id);
  assert.ok(steps.indexOf("preview") < steps.indexOf("postal_address"));
  assert.ok(steps.indexOf("preview") < steps.indexOf("smtp_test"));
});

test("real SMTP delivery credits the SMTP test milestone", () => {
  const progress = getOnboardingProgress({ ...complete, smtpTested: false, realSent: 10 });
  assert.equal(progress.steps.find((step) => step.id === "smtp_test")?.done, true);
});

test("ten real sends and every safety step complete onboarding", () => {
  const progress = getOnboardingProgress(complete);
  assert.equal(progress.complete, true);
  assert.equal(progress.next, null);
  assert.equal(progress.completedCount, progress.totalSteps);
  assert.equal(progress.progressPercent, 100);
});

test("fewer than ten real sends keeps the pilot in progress", () => {
  const progress = getOnboardingProgress({ ...complete, realSent: 9 });
  assert.equal(progress.next?.id, "pilot");
  assert.match(progress.next?.detail ?? "", /9\/10/);
});
