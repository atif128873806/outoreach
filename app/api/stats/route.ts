import { NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { getSettings, isSmtpConfigured, getAiConfig } from "@/lib/settings";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = async (sql: string, params: unknown[] = []) =>
    Number((await q1<{ n: string | number }>(sql, [userId, ...params]))?.n ?? 0);

  const stats = {
    contacts: await count("SELECT COUNT(*) n FROM contacts WHERE user_id = $1"),
    unsubscribed: await count(
      "SELECT COUNT(*) n FROM contacts WHERE user_id = $1 AND unsubscribed = 1"
    ),
    campaigns: await count("SELECT COUNT(*) n FROM campaigns WHERE user_id = $1"),
    activeCampaigns: await count(
      "SELECT COUNT(*) n FROM campaigns WHERE user_id = $1 AND status IN ('scheduled', 'running')"
    ),
    sent: await count("SELECT COUNT(*) n FROM emails WHERE user_id = $1 AND status = 'sent'"),
    failed: await count("SELECT COUNT(*) n FROM emails WHERE user_id = $1 AND status = 'failed'"),
    pending: await count("SELECT COUNT(*) n FROM emails WHERE user_id = $1 AND status = 'pending'"),
    readyDrafts: await count("SELECT COUNT(*) n FROM emails WHERE user_id = $1 AND status = 'ready'"),
    opened: await count("SELECT COUNT(*) n FROM emails WHERE user_id = $1 AND opened_at IS NOT NULL"),
    clicked: await count("SELECT COUNT(*) n FROM emails WHERE user_id = $1 AND clicked_at IS NOT NULL"),
    replies: await count("SELECT COUNT(*) n FROM contacts WHERE user_id = $1 AND replied = 1"),
    bounced: await count("SELECT COUNT(*) n FROM contacts WHERE user_id = $1 AND bounced = 1"),
  };

  const recentEmails = await q(
    `SELECT e.id, e.subject, e.status, e.via, e.sent_at, e.campaign_id,
            c.email AS contact_email, c.business_name,
            cp.name AS campaign_name
     FROM emails e
     JOIN contacts c ON c.id = e.contact_id
     JOIN campaigns cp ON cp.id = e.campaign_id
     WHERE e.user_id = $1 AND e.status NOT IN ('pending', 'ready')
     ORDER BY e.sent_at DESC NULLS LAST, e.id DESC
     LIMIT 10`,
    [userId]
  );

  const upcoming = await q(
    `SELECT id, name, scheduled_at, status FROM campaigns
     WHERE user_id = $1 AND status IN ('scheduled', 'running', 'paused')
     ORDER BY scheduled_at LIMIT 5`,
    [userId]
  );

  // Daily activity for the dashboard chart — last 14 days (UTC days)
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString().slice(0, 10);
  const perDay = async (col: "sent_at" | "opened_at" | "replied_at") =>
    Object.fromEntries(
      (
        await q<{ d: string; n: string | number }>(
          `SELECT to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD') d, COUNT(*) n FROM emails
           WHERE user_id = $1 AND ${col} IS NOT NULL AND ${col} >= $2::date GROUP BY d`,
          [userId, sinceIso]
        )
      ).map((r) => [r.d, Number(r.n)])
    );
  const sentByDay = await perDay("sent_at");
  const openedByDay = await perDay("opened_at");
  const repliedByDay = await perDay("replied_at");
  const daily = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(since.getTime() + i * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      sent: sentByDay[date] ?? 0,
      opened: openedByDay[date] ?? 0,
      replied: repliedByDay[date] ?? 0,
    };
  });

  const settings = await getSettings(userId);
  return NextResponse.json({
    stats,
    recentEmails,
    upcoming,
    daily,
    setup: {
      aiConfigured: Boolean(getAiConfig(settings)),
      smtpConfigured: isSmtpConfigured(settings),
      hasContacts: stats.contacts > 0,
    },
  });
}
