import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLANS,
  normalizePlan,
  capWithPlan,
  remainingLeads,
  signupBonusLeads,
  SIGNUP_BONUS_LEADS,
  SIGNUP_BONUS_DAYS,
} = await import("../lib/plans.ts");

test("plan ladder is strictly increasing where limits exist", () => {
  const { free, starter, pro } = PLANS;
  assert.ok(free.leadsPerMonth! < starter.leadsPerMonth!);
  assert.ok(starter.leadsPerMonth! < pro.leadsPerMonth!);
  assert.ok(free.emailsPerDay! < starter.emailsPerDay!);
  assert.ok(starter.emailsPerDay! < pro.emailsPerDay!);
  assert.ok(free.aiPerDay! < starter.aiPerDay!);
  assert.equal(pro.aiPerDay, null); // unlimited AI on Pro
  assert.ok(free.priceMonthlyUsd < starter.priceMonthlyUsd);
  assert.ok(starter.priceMonthlyUsd < pro.priceMonthlyUsd);
});

test("normalizePlan collapses unknown values to free", () => {
  assert.equal(normalizePlan("pro"), "pro");
  assert.equal(normalizePlan("starter"), "starter");
  assert.equal(normalizePlan("free"), "free");
  assert.equal(normalizePlan("enterprise"), "free");
  assert.equal(normalizePlan(""), "free");
  assert.equal(normalizePlan(null), "free");
  assert.equal(normalizePlan(undefined), "free");
});

test("capWithPlan bounds the user's cap by the plan ceiling", () => {
  assert.equal(capWithPlan(200, PLANS.free), 10); // plan wins when lower
  assert.equal(capWithPlan(5, PLANS.free), 5); // user's own cap wins when lower
  assert.equal(capWithPlan(9999, PLANS.pro), 500);
  const unlimited = { ...PLANS.pro, emailsPerDay: null };
  assert.equal(capWithPlan(9999, unlimited), 9999);
});

test("remainingLeads never goes negative and null means unlimited", () => {
  assert.equal(remainingLeads(PLANS.free, 0), 50);
  assert.equal(remainingLeads(PLANS.free, 49), 1);
  assert.equal(remainingLeads(PLANS.free, 50), 0);
  assert.equal(remainingLeads(PLANS.free, 999), 0);
  const unlimited = { ...PLANS.pro, leadsPerMonth: null };
  assert.equal(remainingLeads(unlimited, 123456), null);
});

test("remainingLeads includes an active bonus", () => {
  assert.equal(remainingLeads(PLANS.free, 0, 100), 150);
  assert.equal(remainingLeads(PLANS.free, 140, 100), 10);
  assert.equal(remainingLeads(PLANS.free, 150, 100), 0);
});

test("signupBonusLeads: free accounts get it for the first week only", () => {
  const now = new Date("2026-07-31T12:00:00Z");
  const dayAgo = new Date("2026-07-30T12:00:00Z");
  const sixDaysAgo = new Date("2026-07-25T13:00:00Z");
  const eightDaysAgo = new Date("2026-07-23T12:00:00Z");

  assert.equal(signupBonusLeads(PLANS.free, dayAgo, now), SIGNUP_BONUS_LEADS);
  assert.equal(signupBonusLeads(PLANS.free, sixDaysAgo, now), SIGNUP_BONUS_LEADS);
  assert.equal(signupBonusLeads(PLANS.free, eightDaysAgo, now), 0);
  // exactly at the boundary the bonus is over
  const boundary = new Date(now.getTime() - SIGNUP_BONUS_DAYS * 86400000);
  assert.equal(signupBonusLeads(PLANS.free, boundary, now), 0);
  // ISO-string timestamps (what Postgres hands back) work too
  assert.equal(signupBonusLeads(PLANS.free, dayAgo.toISOString(), now), SIGNUP_BONUS_LEADS);
  // paid plans and garbage input get nothing
  assert.equal(signupBonusLeads(PLANS.starter, dayAgo, now), 0);
  assert.equal(signupBonusLeads(PLANS.pro, dayAgo, now), 0);
  assert.equal(signupBonusLeads(PLANS.free, "not-a-date", now), 0);
});
