import { q, q1 } from "./db";
import {
  PLANS,
  normalizePlan,
  remainingLeads,
  upgradeBonusLeads,
  type Plan,
} from "./plans";

/** The user's current plan (from users.plan; unknown values collapse to free). */
export async function getUserPlan(userId: number): Promise<Plan> {
  const row = await q1<{ plan: string }>("SELECT plan FROM users WHERE id = $1", [userId]);
  return PLANS[normalizePlan(row?.plan)];
}

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** First day of the current calendar month, YYYY-MM-DD. */
function monthStart(): string {
  return today().slice(0, 8) + "01";
}

/** Adds `n` to a usage counter for today. */
export async function recordUsage(userId: number, kind: string, n: number): Promise<void> {
  if (n <= 0) return;
  await q(
    `INSERT INTO usage_daily (user_id, day, kind, count) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, day, kind) DO UPDATE SET count = usage_daily.count + EXCLUDED.count`,
    [userId, today(), kind, n]
  );
}

/** Total usage of `kind` in the current calendar month. */
export async function usedThisMonth(userId: number, kind: string): Promise<number> {
  const row = await q1<{ n: string | number }>(
    "SELECT COALESCE(SUM(count), 0) n FROM usage_daily WHERE user_id = $1 AND kind = $2 AND day >= $3",
    [userId, kind, monthStart()]
  );
  return Number(row?.n ?? 0);
}

export interface LeadQuota {
  plan: Plan;
  used: number;
  limit: number | null;
  remaining: number | null;
  /** Active upgrade-bonus leads included in `limit` (0 once the first paid week ends). */
  bonus: number;
}

/** Lead Finder quota status for this user this month (incl. upgrade bonus). */
export async function getLeadQuota(userId: number): Promise<LeadQuota> {
  const row = await q1<{ plan: string; created_at: string; plan_changed_at: string | null }>(
    "SELECT plan, created_at, plan_changed_at FROM users WHERE id = $1",
    [userId]
  );
  const plan = PLANS[normalizePlan(row?.plan)];
  const bonus = row ? upgradeBonusLeads(plan, row.plan_changed_at ?? row.created_at) : 0;
  const used = await usedThisMonth(userId, "leads");
  const limit = plan.leadsPerMonth == null ? null : plan.leadsPerMonth + bonus;
  return { plan, used, limit, remaining: remainingLeads(plan, used, bonus), bonus };
}

/** Standard message when the lead quota is exhausted. */
export function leadQuotaMessage(quota: LeadQuota): string {
  const next = quota.plan.id === "free" ? "Starter" : quota.plan.id === "starter" ? "Pro" : null;
  return `You've used all ${quota.limit} Lead Finder results included in the ${quota.plan.name} plan this month.${
    next ? ` Upgrade to ${next} for more, or wait until next month.` : " The counter resets next month."
  }`;
}
