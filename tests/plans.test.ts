import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PLANS,
  FILTER_ORDER,
  FILTER_LABELS,
  normalizePlan,
  normalizeFilter,
  planForFilter,
  planAllowsFilter,
  nextPlan,
  filterUpgradeMessage,
  capWithPlan,
  remainingLeads,
  upgradeBonusLeads,
  UPGRADE_BONUS_LEADS,
  UPGRADE_BONUS_DAYS,
} = await import("../lib/plans.ts");

test("the ladder climbs on both sold dials: leads per month and filters", () => {
  const { free, starter, pro } = PLANS;
  assert.ok(free.leadsPerMonth! < starter.leadsPerMonth!);
  assert.ok(starter.leadsPerMonth! < pro.leadsPerMonth!);
  // Filters are the second dial — every tier strictly adds capability.
  assert.ok(free.filters.length < starter.filters.length);
  assert.ok(starter.filters.length < pro.filters.length);
  assert.deepEqual(pro.filters, FILTER_ORDER);
  assert.ok(free.priceMonthlyUsd < starter.priceMonthlyUsd);
  assert.ok(starter.priceMonthlyUsd < pro.priceMonthlyUsd);
});

test("filter gating: cheap filters are free, the two hunts are paid", () => {
  assert.equal(planAllowsFilter(PLANS.free, "any"), true);
  assert.equal(planAllowsFilter(PLANS.free, "with"), true);
  assert.equal(planAllowsFilter(PLANS.free, "outdated"), false);
  assert.equal(planAllowsFilter(PLANS.free, "without"), false);
  assert.equal(planAllowsFilter(PLANS.starter, "outdated"), true);
  assert.equal(planAllowsFilter(PLANS.starter, "without"), false);
  assert.equal(planAllowsFilter(PLANS.pro, "without"), true);
});

test("every filter is unlocked by some plan, and its labels are complete", () => {
  for (const f of FILTER_ORDER) {
    assert.equal(planAllowsFilter(PLANS[planForFilter(f)], f), true, `${f} is locked everywhere`);
    assert.ok(FILTER_LABELS[f].length > 0);
  }
});

test("normalizeFilter collapses anything unknown to any", () => {
  assert.equal(normalizeFilter("outdated"), "outdated");
  assert.equal(normalizeFilter("without"), "without");
  assert.equal(normalizeFilter("with"), "with");
  assert.equal(normalizeFilter("any"), "any");
  assert.equal(normalizeFilter("whatever"), "any");
  assert.equal(normalizeFilter(null), "any");
  assert.equal(normalizeFilter(undefined), "any");
});

test("nextPlan walks the ladder and stops at the top", () => {
  assert.equal(nextPlan(PLANS.free)?.id, "starter");
  assert.equal(nextPlan(PLANS.starter)?.id, "pro");
  assert.equal(nextPlan(PLANS.pro), null);
});

test("the upgrade message names the filter, the plan and the price", () => {
  const msg = filterUpgradeMessage(PLANS.free, "outdated");
  assert.match(msg, /Outdated or broken site/);
  assert.match(msg, /Starter/);
  assert.match(msg, /\$9/);
  // It also says what the user already has, so the prompt isn't a dead end.
  assert.match(msg, /Free plan includes/);
  assert.match(filterUpgradeMessage(PLANS.starter, "without"), /\$29/);
});

test("sending is not part of the ladder any more", () => {
  // The internal send ceiling survives only for the dormant outreach half, so
  // it must not be presented as a plan feature. If a plan ever starts
  // advertising it, this is the tripwire.
  for (const plan of Object.values(PLANS)) {
    assert.ok(!/email|send/i.test(plan.tagline), `${plan.name} tagline sells sending`);
  }
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
  // A dormant-half concern: the outreach scheduler still asks for this.
  assert.equal(capWithPlan(200, PLANS.free), 25); // plan wins when lower
  assert.equal(capWithPlan(20, PLANS.free), 20); // user's own cap wins when lower
  assert.equal(capWithPlan(9999, PLANS.pro), 50);
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
  assert.equal(remainingLeads(PLANS.starter, 0, 100), 500);
  assert.equal(remainingLeads(PLANS.starter, 490, 100), 10);
  assert.equal(remainingLeads(PLANS.starter, 500, 100), 0);
});

test("upgradeBonusLeads: paid plans get it for their first week only", () => {
  const now = new Date("2026-07-31T12:00:00Z");
  const dayAgo = new Date("2026-07-30T12:00:00Z");
  const sixDaysAgo = new Date("2026-07-25T13:00:00Z");
  const eightDaysAgo = new Date("2026-07-23T12:00:00Z");

  assert.equal(upgradeBonusLeads(PLANS.starter, dayAgo, now), UPGRADE_BONUS_LEADS);
  assert.equal(upgradeBonusLeads(PLANS.pro, sixDaysAgo, now), UPGRADE_BONUS_LEADS);
  assert.equal(upgradeBonusLeads(PLANS.starter, eightDaysAgo, now), 0);
  // exactly at the boundary the bonus is over
  const boundary = new Date(now.getTime() - UPGRADE_BONUS_DAYS * 86400000);
  assert.equal(upgradeBonusLeads(PLANS.pro, boundary, now), 0);
  // ISO-string timestamps (what Postgres hands back) work too
  assert.equal(upgradeBonusLeads(PLANS.starter, dayAgo.toISOString(), now), UPGRADE_BONUS_LEADS);
  // the free plan and garbage input get nothing
  assert.equal(upgradeBonusLeads(PLANS.free, dayAgo, now), 0);
  assert.equal(upgradeBonusLeads(PLANS.starter, "not-a-date", now), 0);
});
