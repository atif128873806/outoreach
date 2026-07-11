import { q1 } from "./db";
import { isEmailVerified } from "./auth";
import { getUserPlan } from "./usage";

/**
 * Abuse guard for the instance's global AI key (ANTHROPIC_API_KEY /
 * GROQ_API_KEY env). Users with their own key in Settings are never limited.
 *
 * The daily limit comes from the user's plan (see lib/plans.ts). The
 * GLOBAL_AI_DAILY_LIMIT env var, when set, is a hard instance-wide ceiling
 * that applies to every plan — the operator's cost brake.
 */

export type GlobalAiGate = { ok: true } | { ok: false; reason: string };

/**
 * Checks verification + the daily plan quota and consumes one generation when
 * allowed. Counts in the ai_usage table so the quota survives restarts.
 */
export async function consumeGlobalAi(userId: number): Promise<GlobalAiGate> {
  if (!(await isEmailVerified(userId))) {
    return {
      ok: false,
      reason: "Verify your email address to use the included AI writing",
    };
  }

  const plan = await getUserPlan(userId);
  const envCeiling = parseInt(process.env.GLOBAL_AI_DAILY_LIMIT || "", 10);
  const limit = Math.min(
    plan.aiPerDay ?? Infinity,
    Number.isFinite(envCeiling) && envCeiling > 0 ? envCeiling : Infinity
  );

  const day = new Date().toISOString().slice(0, 10);
  const row = await q1<{ count: number }>(
    `INSERT INTO ai_usage (user_id, day, count) VALUES ($1, $2, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1
     RETURNING count`,
    [userId, day]
  );
  if ((row?.count ?? 1) > limit) {
    return {
      ok: false,
      reason: `Daily included-AI limit reached (${limit} generations/day on the ${plan.name} plan). It resets tomorrow — upgrade for more, or add your own API key in Settings for unlimited use.`,
    };
  }
  return { ok: true };
}
