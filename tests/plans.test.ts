import { test } from "node:test";
import assert from "node:assert/strict";

const { PLANS, normalizePlan, capWithPlan, remainingLeads } = await import("../lib/plans.ts");

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
  assert.equal(capWithPlan(200, PLANS.free), 50); // plan wins when lower
  assert.equal(capWithPlan(30, PLANS.free), 30); // user's own cap wins when lower
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
