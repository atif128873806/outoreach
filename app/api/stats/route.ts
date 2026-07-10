import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSettings, isSmtpConfigured, getAiConfig } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();

  const count = (sql: string) =>
    (db.prepare(sql).get() as { n: number }).n;

  const stats = {
    contacts: count("SELECT COUNT(*) n FROM contacts"),
    unsubscribed: count("SELECT COUNT(*) n FROM contacts WHERE unsubscribed = 1"),
    campaigns: count("SELECT COUNT(*) n FROM campaigns"),
    activeCampaigns: count(
      "SELECT COUNT(*) n FROM campaigns WHERE status IN ('scheduled', 'running')"
    ),
    sent: count("SELECT COUNT(*) n FROM emails WHERE status = 'sent'"),
    failed: count("SELECT COUNT(*) n FROM emails WHERE status = 'failed'"),
    pending: count("SELECT COUNT(*) n FROM emails WHERE status = 'pending'"),
    readyDrafts: count("SELECT COUNT(*) n FROM emails WHERE status = 'ready'"),
    opened: count("SELECT COUNT(*) n FROM emails WHERE opened_at IS NOT NULL"),
    clicked: count("SELECT COUNT(*) n FROM emails WHERE clicked_at IS NOT NULL"),
    replies: count("SELECT COUNT(*) n FROM contacts WHERE replied = 1"),
    bounced: count("SELECT COUNT(*) n FROM contacts WHERE bounced = 1"),
  };

  const recentEmails = db
    .prepare(
      `SELECT e.id, e.subject, e.status, e.via, e.sent_at, e.campaign_id,
              c.email AS contact_email, c.business_name,
              cp.name AS campaign_name
       FROM emails e
       JOIN contacts c ON c.id = e.contact_id
       JOIN campaigns cp ON cp.id = e.campaign_id
       WHERE e.status NOT IN ('pending', 'ready')
       ORDER BY e.sent_at DESC, e.id DESC
       LIMIT 10`
    )
    .all();

  const upcoming = db
    .prepare(
      `SELECT id, name, scheduled_at, status FROM campaigns
       WHERE status IN ('scheduled', 'running', 'paused')
       ORDER BY scheduled_at LIMIT 5`
    )
    .all();

  // Daily activity for the dashboard chart — last 14 days (UTC days)
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString().slice(0, 10);
  const perDay = (col: "sent_at" | "opened_at" | "replied_at") =>
    Object.fromEntries(
      (
        db
          .prepare(
            `SELECT substr(${col}, 1, 10) d, COUNT(*) n FROM emails
             WHERE ${col} IS NOT NULL AND ${col} >= ? GROUP BY d`
          )
          .all(sinceIso) as { d: string; n: number }[]
      ).map((r) => [r.d, r.n])
    );
  const sentByDay = perDay("sent_at");
  const openedByDay = perDay("opened_at");
  const repliedByDay = perDay("replied_at");
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

  const settings = getSettings();
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
