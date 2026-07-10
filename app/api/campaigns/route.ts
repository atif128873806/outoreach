import { NextRequest, NextResponse } from "next/server";
import { getDb, type Campaign } from "@/lib/db";

export const runtime = "nodejs";

export interface CampaignWithProgress extends Campaign {
  total: number;
  sent: number;
  ready: number;
  failed: number;
  skipped: number;
  pending: number;
  opened: number;
  clicked: number;
  replied: number;
}

export async function GET() {
  const db = getDb();
  const campaigns = db
    .prepare(
      `SELECT c.*,
        COUNT(e.id) AS total,
        SUM(CASE WHEN e.status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN e.status = 'ready' THEN 1 ELSE 0 END) AS ready,
        SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN e.status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
        SUM(CASE WHEN e.status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN e.opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opened,
        SUM(CASE WHEN e.clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS clicked,
        SUM(CASE WHEN e.replied_at IS NOT NULL THEN 1 ELSE 0 END) AS replied
       FROM campaigns c
       LEFT JOIN emails e ON e.campaign_id = c.id
       GROUP BY c.id
       ORDER BY c.id DESC`
    )
    .all() as CampaignWithProgress[];

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string;
    description?: string;
    tone?: string;
    channel?: string;
    category_filter?: string;
    scheduled_at?: string;
    throttle_per_hour?: number;
    followup_count?: number;
    followup_interval_days?: number;
    send_window_start?: number | null;
    send_window_end?: number | null;
    ab_test?: boolean;
    send_now?: boolean;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (!body.description?.trim()) {
    return NextResponse.json(
      { error: "Describe what the campaign is offering — messages are written from this" },
      { status: 400 }
    );
  }
  if (!body.send_now && !body.scheduled_at) {
    return NextResponse.json(
      { error: "Pick a send time or choose Send now" },
      { status: 400 }
    );
  }
  const channel =
    body.channel === "instagram" || body.channel === "linkedin"
      ? body.channel
      : "email";

  const db = getDb();
  const category = body.category_filter?.trim() ?? "";

  // DM campaigns need a profile to link to; email campaigns just need an address.
  const igClause =
    channel === "instagram"
      ? " AND instagram != ''"
      : channel === "linkedin"
        ? " AND linkedin != ''"
        : "";
  const recipients = (
    category
      ? db
          .prepare(
            `SELECT id FROM contacts WHERE unsubscribed = 0 AND category = ?${igClause}`
          )
          .all(category)
      : db
          .prepare(`SELECT id FROM contacts WHERE unsubscribed = 0${igClause}`)
          .all()
  ) as { id: number }[];

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          channel === "instagram"
            ? "No subscribed contacts with an Instagram handle match this audience — add handles to your contacts first"
            : channel === "linkedin"
              ? "No subscribed contacts with a LinkedIn profile match this audience — add LinkedIn URLs to your contacts first"
              : "No subscribed contacts match this audience — import contacts first",
      },
      { status: 400 }
    );
  }

  const scheduledAt = body.send_now
    ? new Date().toISOString()
    : new Date(body.scheduled_at!).toISOString();

  const windowStart =
    typeof body.send_window_start === "number" ? body.send_window_start : null;
  const windowEnd =
    typeof body.send_window_end === "number" ? body.send_window_end : null;

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO campaigns
           (name, description, tone, channel, category_filter, scheduled_at,
            throttle_per_hour, followup_count, followup_interval_days,
            send_window_start, send_window_end, ab_test, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.name!.trim(),
        body.description!.trim(),
        body.tone?.trim() || "professional",
        channel,
        category,
        scheduledAt,
        Math.min(600, Math.max(1, body.throttle_per_hour || 60)),
        // Follow-up sequences are an email feature; DM drafts are one-shot
        channel === "email" ? Math.min(3, Math.max(0, body.followup_count ?? 0)) : 0,
        Math.min(30, Math.max(1, body.followup_interval_days ?? 3)),
        windowStart,
        windowEnd,
        channel === "email" && body.ab_test ? 1 : 0,
        body.send_now ? "running" : "scheduled"
      );
    const campaignId = info.lastInsertRowid as number;

    const insertEmail = db.prepare(
      "INSERT INTO emails (campaign_id, contact_id) VALUES (?, ?)"
    );
    for (const r of recipients) insertEmail.run(campaignId, r.id);
    return campaignId;
  });

  const campaignId = tx();
  return NextResponse.json({ id: campaignId, recipients: recipients.length });
}
