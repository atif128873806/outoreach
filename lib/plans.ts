/**
 * Subscription plans and their limits. Pure data + math — no database access
 * here (lib/usage.ts does the metering), so the test suite can import it.
 *
 * Limits philosophy: hitting a limit never breaks a running campaign — sends
 * pause until tomorrow, AI falls back to templates, lead search asks for an
 * upgrade. Nothing is deleted or lost.
 */

export type PlanId = "free" | "starter" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  /** Lead Finder results per calendar month (search results + owner lookups). null = unlimited */
  leadsPerMonth: number | null;
  /** Real SMTP emails per day (the user's own daily cap still applies below this). null = unlimited */
  emailsPerDay: number | null;
  /** Included-AI generations per day when using the instance's global key. null = unlimited */
  aiPerDay: number | null;
  tagline: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    leadsPerMonth: 150,
    emailsPerDay: 50,
    aiPerDay: 150,
    tagline: "Everything you need to land your first clients.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthlyUsd: 9,
    priceYearlyUsd: 90,
    leadsPerMonth: 400, // ≈100 per week
    emailsPerDay: 150,
    aiPerDay: 500,
    tagline: "For steady weekly outreach on a budget.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 29,
    priceYearlyUsd: 290,
    leadsPerMonth: 2500,
    emailsPerDay: 500,
    aiPerDay: null,
    tagline: "Serious volume for agencies and sales teams.",
  },
};

/** Coerces a stored plan value to a valid PlanId (unknown/legacy → free). */
export function normalizePlan(value: string | null | undefined): PlanId {
  return value === "starter" || value === "pro" ? value : "free";
}

/** The user's effective daily send cap: their own setting bounded by the plan. */
export function capWithPlan(userCap: number, plan: Plan): number {
  if (plan.emailsPerDay == null) return userCap;
  return Math.min(userCap, plan.emailsPerDay);
}

/** Remaining lead-scrape quota given this month's usage. null = unlimited. */
export function remainingLeads(plan: Plan, usedThisMonth: number): number | null {
  if (plan.leadsPerMonth == null) return null;
  return Math.max(0, plan.leadsPerMonth - usedThisMonth);
}
