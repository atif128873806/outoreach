import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { q1 } from "@/lib/db";
import {
  getSettings,
  getEffectiveDailyCap,
  getAiConfig,
  startOfTodayIso,
} from "@/lib/settings";
import { getLeadQuota } from "@/lib/usage";
import { capWithPlan, PLANS } from "@/lib/plans";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

/** Plan & usage snapshot for the signed-in user (drives /billing). */
export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, leadQuota] = await Promise.all([
    getSettings(userId),
    getLeadQuota(userId),
  ]);
  const plan = leadQuota.plan;

  // Real (SMTP) emails sent today vs. the effective cap (user cap ∩ plan cap)
  const sentRow = await q1<{ n: string | number }>(
    `SELECT COUNT(*) n FROM emails
     WHERE user_id = $1 AND status = 'sent' AND via LIKE 'smtp%' AND sent_at >= $2`,
    [userId, startOfTodayIso()]
  );
  const emailsUsed = Number(sentRow?.n ?? 0);
  const emailsLimit = capWithPlan(getEffectiveDailyCap(settings), plan);

  // Included-AI generations today (only global-key usage is metered)
  const day = new Date().toISOString().slice(0, 10);
  const aiRow = await q1<{ count: number }>(
    "SELECT count FROM ai_usage WHERE user_id = $1 AND day = $2",
    [userId, day]
  );
  const cfg = getAiConfig(settings);
  const ownKey = Boolean(cfg && !cfg.global);
  const envCeiling = parseInt(process.env.GLOBAL_AI_DAILY_LIMIT || "", 10);
  const rawAiLimit = Math.min(
    plan.aiPerDay ?? Infinity,
    Number.isFinite(envCeiling) && envCeiling > 0 ? envCeiling : Infinity
  );

  return NextResponse.json({
    plan: {
      id: plan.id,
      name: plan.name,
      priceMonthlyUsd: plan.priceMonthlyUsd,
      tagline: plan.tagline,
    },
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      priceMonthlyUsd: p.priceMonthlyUsd,
      leadsPerMonth: p.leadsPerMonth,
      emailsPerDay: p.emailsPerDay,
      aiPerDay: p.aiPerDay,
    })),
    leads: { used: leadQuota.used, limit: leadQuota.limit, bonus: leadQuota.bonus },
    emails: { used: emailsUsed, limit: emailsLimit },
    ai: {
      used: Number(aiRow?.count ?? 0),
      limit: Number.isFinite(rawAiLimit) ? rawAiLimit : null,
      ownKey,
    },
    supportEmail: SITE.supportEmail,
  });
}
