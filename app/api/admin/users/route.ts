import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { getUserId, isAdmin } from "@/lib/auth";
import { isSystemMailerConfigured } from "@/lib/system-mailer";
import { getAiConfig } from "@/lib/settings";
import { normalizePlan } from "@/lib/plans";

export const runtime = "nodejs";

/** Admin-only: all accounts with basic usage counts, plus instance status. */
export async function GET() {
  const uid = await getUserId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(uid))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const users = await q(
    `SELECT u.id, u.email, u.name, u.is_admin, u.plan, u.created_at,
        (SELECT COUNT(*) FROM contacts c WHERE c.user_id = u.id)::int AS contacts,
        (SELECT COUNT(*) FROM campaigns cp WHERE cp.user_id = u.id)::int AS campaigns,
        (SELECT COUNT(*) FROM emails e WHERE e.user_id = u.id AND e.status = 'sent')::int AS sent
     FROM users u
     ORDER BY u.id`
  );

  // AI is provided instance-wide when a global key is set (env), regardless of per-user settings.
  const globalAi = getAiConfig({
    ai_provider: "",
    anthropic_api_key: "",
    groq_api_key: "",
    groq_model: "",
  } as never);

  // Activation funnel — every stage a user must cross between signing up and
  // getting value. One aggregate pass over existing data; nothing is tracked
  // client-side, so the numbers can't lie.
  const funnel = await q1<{
    signed_up: number;
    verified: number;
    used_leads: number;
    has_contacts: number;
    created_campaign: number;
    generated: number;
    sent_real: number;
    got_reply: number;
    smtp_connected: number;
    imap_connected: number;
  }>(
    `SELECT
       COUNT(*)::int AS signed_up,
       COUNT(*) FILTER (WHERE u.email_verified = 1)::int AS verified,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM usage_daily ud WHERE ud.user_id = u.id AND ud.kind = 'leads'))::int AS used_leads,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM contacts c WHERE c.user_id = u.id))::int AS has_contacts,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM campaigns cp WHERE cp.user_id = u.id))::int AS created_campaign,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM emails e WHERE e.user_id = u.id AND e.status IN ('sent','ready')))::int AS generated,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM emails e WHERE e.user_id = u.id AND e.status = 'sent' AND e.via LIKE 'smtp%'))::int AS sent_real,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM replies r WHERE r.user_id = u.id))::int AS got_reply,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM settings s WHERE s.user_id = u.id AND s.key = 'smtp_host' AND s.value <> ''))::int AS smtp_connected,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM settings s WHERE s.user_id = u.id AND s.key IN ('imap_host','imap_user') AND s.value <> ''))::int AS imap_connected
     FROM users u`
  );

  return NextResponse.json({
    users,
    funnel,
    instance: {
      signupsDisabled: process.env.SIGNUPS_DISABLED === "true",
      systemMailer: isSystemMailerConfigured(),
      globalAi: globalAi ? globalAi.provider : null,
    },
  });
}

/**
 * Admin-only: change an account's plan — { userId, plan }. Until Paddle
 * checkout is wired in, this is how paid plans are assigned after purchase.
 */
export async function PATCH(req: NextRequest) {
  const uid = await getUserId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(uid))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = (await req.json()) as { userId?: number; plan?: string };
  const targetId = Number(body.userId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (body.plan !== "free" && body.plan !== "starter" && body.plan !== "pro") {
    return NextResponse.json({ error: "plan must be free, starter, or pro" }, { status: 400 });
  }

  const target = await q1<{ id: number }>("SELECT id FROM users WHERE id = $1", [targetId]);
  if (!target) return NextResponse.json({ error: "No such user" }, { status: 404 });

  // Stamp plan_changed_at only on a real change — re-saving the same plan
  // must not restart the first-week upgrade bonus.
  await q(
    `UPDATE users SET
       plan_changed_at = CASE WHEN plan = $1 THEN plan_changed_at ELSE now() END,
       plan = $1
     WHERE id = $2`,
    [normalizePlan(body.plan), targetId]
  );
  return NextResponse.json({ ok: true });
}
