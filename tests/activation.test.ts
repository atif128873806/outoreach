import { test } from "node:test";
import assert from "node:assert/strict";

const { getActivationState } = await import("../lib/activation.ts");

const complete = {
  verified: true,
  contacts: 10,
  campaigns: 1,
  generated: 10,
  sentReal: 10,
  replies: 1,
  smtpConnected: true,
  imapConnected: true,
  postalConfigured: true,
};

test("activation identifies every core funnel stop", () => {
  assert.equal(getActivationState({ ...complete, verified: false }).key, "signed_up");
  assert.equal(getActivationState({ ...complete, contacts: 0 }).key, "verified");
  assert.equal(getActivationState({ ...complete, campaigns: 0 }).key, "has_contacts");
  assert.equal(getActivationState({ ...complete, generated: 0 }).key, "created_campaign");
  assert.equal(getActivationState({ ...complete, sentReal: 0 }).key, "generated");
  assert.equal(getActivationState({ ...complete, replies: 0 }).key, "sent_real");
  assert.equal(getActivationState(complete).key, "got_reply");
});

test("pre-send next action exposes SMTP and compliance blockers", () => {
  const withoutSmtp = getActivationState({ ...complete, sentReal: 0, smtpConnected: false });
  assert.equal(withoutSmtp.nextAction, "Connect and test SMTP");

  const withoutPostal = getActivationState({
    ...complete,
    sentReal: 0,
    postalConfigured: false,
  });
  assert.equal(withoutPostal.nextAction, "Add the sender postal address");
});

test("post-send next action distinguishes reply capture from waiting", () => {
  const withoutImap = getActivationState({
    ...complete,
    replies: 0,
    imapConnected: false,
  });
  assert.equal(withoutImap.nextAction, "Connect IMAP to capture replies");

  const waiting = getActivationState({ ...complete, replies: 0 });
  assert.equal(waiting.nextAction, "Monitor replies and review the pilot");
  assert.equal(waiting.progressPercent, 86);
});

test("a reply is the completed activation milestone", () => {
  const result = getActivationState(complete);
  assert.equal(result.activated, true);
  assert.equal(result.step, result.totalSteps);
  assert.equal(result.progressPercent, 100);
});
