/**
 * Subscription plans and their limits. Pure data + math — no database access
 * here (lib/usage.ts does the metering), so the test suite can import it.
 *
 * The product is sold as lead intelligence, so this ladder has exactly two
 * sellable dials:
 *
 *   1. how many audited leads a month, and
 *   2. which Lead Finder filters are unlocked — the filters ARE the product,
 *      because each one is a different problem to sell against.
 *
 * Sending is deliberately absent. Nothing here is advertised as an email
 * promise any more (see `emailsPerDay` below, which is kept only because the
 * dormant outreach half still needs a ceiling).
 *
 * Limits philosophy: hitting a limit never breaks anything — lead search asks
 * for an upgrade, AI falls back to templates, sends pause until tomorrow.
 * Nothing is deleted or lost.
 */

export type PlanId = "free" | "starter" | "pro";

/**
 * The Lead Finder filters. Each is a problem the user can sell against, and
 * they are ordered cheapest-to-run first in `FILTER_ORDER`.
 */
export type WebsiteFilter = "any" | "with" | "outdated" | "without";

export const FILTER_LABELS: Record<WebsiteFilter, string> = {
  any: "Any business",
  with: "Has a website",
  outdated: "Outdated or broken site",
  without: "No website",
};

/** Display order: the two cheap filters, then the two premium hunts. */
export const FILTER_ORDER: WebsiteFilter[] = ["any", "with", "outdated", "without"];

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  /** Audited Lead Finder results per calendar month (incl. owner lookups). null = unlimited */
  leadsPerMonth: number | null;
  /** Which filters this plan unlocks — the second half of the value ladder. */
  filters: WebsiteFilter[];
  /**
   * Included-AI generations per day when using the instance's global key.
   * Powers the (currently hidden) outreach half, so it is not sold on any plan
   * page — kept only so metering keeps working. null = unlimited
   */
  aiPerDay: number | null;
  /**
   * Internal ceiling for daily real SMTP sends in the dormant outreach half
   * (lib/runner.ts bounds every send with it). NOT a selling point: no public
   * page advertises sending any more. null = unlimited
   */
  emailsPerDay: number | null;
  tagline: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    leadsPerMonth: 50,
    filters: ["any", "with"],
    aiPerDay: 50,
    emailsPerDay: 25,
    tagline: "Audited leads every month — no card, no trial clock.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthlyUsd: 9,
    priceYearlyUsd: 90,
    leadsPerMonth: 400, // ≈100 per week
    // The filter that makes the product useful: only sites with a real,
    // checkable defect, ranked worst first.
    filters: ["any", "with", "outdated"],
    aiPerDay: 500,
    emailsPerDay: 40,
    tagline: "Filter down to the businesses whose sites actually need work.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 29,
    priceYearlyUsd: 290,
    leadsPerMonth: 2500,
    // The most expensive search to run — every business with no website gets
    // its own web lookup for a phone, Instagram or email.
    filters: ["any", "with", "outdated", "without"],
    aiPerDay: null,
    emailsPerDay: 50,
    tagline: "The whole net, including businesses with no website at all.",
  },
};

/** Coerces a stored plan value to a valid PlanId (unknown/legacy → free). */
export function normalizePlan(value: string | null | undefined): PlanId {
  return value === "starter" || value === "pro" ? value : "free";
}

/** Coerces a requested filter to a valid one (unknown → "any"). */
export function normalizeFilter(value: string | null | undefined): WebsiteFilter {
  return value === "with" || value === "outdated" || value === "without" ? value : "any";
}

/**
 * Can this plan watch a search for new businesses?
 *
 * Paid tiers only, and for two reasons that point the same way. The digest is
 * built from the UK register, which is itself the Pro source — handing its
 * records out weekly on the free tier would make the paid tier's own source
 * unnecessary. And an email that arrives every week is the reason a subscriber
 * keeps paying, which is worth nothing to someone who is not one.
 */
export function planAllowsWatches(plan: Plan): boolean {
  return plan.id !== "free";
}

/** What to tell a free user who tries to watch a search. */
export function watchesUpgradeMessage(plan: Plan): string {
  const next = nextPlan(plan) ?? PLANS.starter;
  return `Watching a search for new businesses is part of ${next.name} ($${next.priceMonthlyUsd}/month). Upgrade to be told what has registered in your niche each week.`;
}

/** The plan a user needs before this filter will run. */
export function planForFilter(filter: WebsiteFilter): PlanId {
  for (const id of ["free", "starter", "pro"] as PlanId[]) {
    if (PLANS[id].filters.includes(filter)) return id;
  }
  return "free";
}

export function planAllowsFilter(plan: Plan, filter: WebsiteFilter): boolean {
  return plan.filters.includes(filter);
}

/** The plan above this one, or null on the top tier. */
export function nextPlan(plan: Plan): Plan | null {
  const order: PlanId[] = ["free", "starter", "pro"];
  const next = order[order.indexOf(plan.id) + 1];
  return next ? PLANS[next] : null;
}

/**
 * What to tell a user who asked for a filter their plan doesn't include.
 * Says which filter, which plan, and what they'd get — no dead ends.
 */
export function filterUpgradeMessage(plan: Plan, filter: WebsiteFilter): string {
  const needed = PLANS[planForFilter(filter)];
  return `The “${FILTER_LABELS[filter]}” filter is part of ${needed.name} ($${needed.priceMonthlyUsd}/month). The ${plan.name} plan includes ${plan.filters
    .map((f) => `“${FILTER_LABELS[f]}”`)
    .join(" and ")} — upgrade to unlock it.`;
}

/** The user's effective daily send cap: their own setting bounded by the plan. */
export function capWithPlan(userCap: number, plan: Plan): number {
  if (plan.emailsPerDay == null) return userCap;
  return Math.min(userCap, plan.emailsPerDay);
}

/** Remaining lead-scrape quota given this month's usage. null = unlimited. */
export function remainingLeads(
  plan: Plan,
  usedThisMonth: number,
  bonus = 0
): number | null {
  if (plan.leadsPerMonth == null) return null;
  return Math.max(0, plan.leadsPerMonth + bonus - usedThisMonth);
}

// ---------- upgrade bonus ----------
// A thank-you for going paid: the first week on Starter or Pro comes with
// extra Lead Finder results so the upgrade feels immediately worth it.

export const UPGRADE_BONUS_LEADS = 100;
export const UPGRADE_BONUS_DAYS = 7;

/**
 * Extra Lead Finder results this user gets right now. Paid plans only,
 * during the first UPGRADE_BONUS_DAYS after the plan was assigned
 * (users.plan_changed_at; account creation for legacy rows without it).
 */
export function upgradeBonusLeads(
  plan: Plan,
  planSince: string | Date,
  now: Date = new Date()
): number {
  if (plan.id === "free") return 0;
  const since = new Date(planSince).getTime();
  if (Number.isNaN(since)) return 0;
  const age = now.getTime() - since;
  return age >= 0 && age < UPGRADE_BONUS_DAYS * 24 * 60 * 60 * 1000
    ? UPGRADE_BONUS_LEADS
    : 0;
}
