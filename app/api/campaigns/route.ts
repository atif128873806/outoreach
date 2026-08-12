import { NextRequest, NextResponse } from "next/server";
import { q, getDb, type Campaign } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { normalizeHourlyRate } from "@/lib/throttle";
import { getPublicBaseUrl, getSettings, isSmtpConfigured } from "@/lib/settings";

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
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await q<CampaignWithProgress>(
    `SELECT c.*,
      COUNT(e.id)::int AS total,
      COUNT(*) FILTER (WHERE e.status = 'sent')::int AS sent,
      COUNT(*) FILTER (WHERE e.status = 'ready')::int AS ready,
      COUNT(*) FILTER (WHERE e.status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE e.status = 'skipped')::int AS skipped,
      COUNT(*) FILTER (WHERE e.status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE e.opened_at IS NOT NULL)::int AS opened,
      COUNT(*) FILTER (WHERE e.clicked_at IS NOT NULL)::int AS clicked,
      COUNT(*) FILTER (WHERE e.replied_at IS NOT NULL)::int AS replied
     FROM campaigns c
     LEFT JOIN emails e ON e.campaign_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.id DESC`,
    [userId]
  );

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    /** >0 = send this many first, then auto-pause for review */
    test_batch?: number;
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

  if (channel === "email") {
    const settings = await getSettings(userId);
    if (isSmtpConfigured(settings) && !settings.sender_postal_address.trim()) {
      return NextResponse.json(
        {
          error:
            "Add your valid business postal address in Settings before launching a real email campaign",
        },
        { status: 400 }
      );
    }
    if (isSmtpConfigured(settings) && !getPublicBaseUrl(settings)) {
      return NextResponse.json(
        {
          error:
            "Set the Public base URL in Settings before launching a real campaign so unsubscribe links work",
        },
        { status: 400 }
      );
    }
  }

  const category = body.category_filter?.trim() ?? "";

  // Each channel needs its own reachable handle — email campaigns must skip
  // no-email (offline-business) contacts, DM campaigns need a profile.
  const igClause =
    channel === "instagram"
      ? " AND instagram != ''"
      : channel === "linkedin"
        ? " AND linkedin != ''"
        : " AND email != ''";
  const emailSafetyClause =
    channel === "email" ? " AND email_status NOT IN ('invalid', 'risky')" : "";
  const recipients = category
    ? await q<{ id: number }>(
        `SELECT id FROM contacts WHERE user_id = $1 AND unsubscribed = 0
           AND category = $2${emailSafetyClause}${igClause}`,
        [userId, category]
      )
    : await q<{ id: number }>(
        `SELECT id FROM contacts WHERE user_id = $1 AND unsubscribed = 0
           ${emailSafetyClause}${igClause}`,
        [userId]
      );

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

  const db = await getDb();
  const campaignId = await db.transaction(async (tx) => {
    const rows = await tx.query<{ id: number }>(
      `INSERT INTO campaigns
         (user_id, name, description, tone, channel, category_filter, scheduled_at,
          throttle_per_hour, followup_count, followup_interval_days,
          send_window_start, send_window_end, ab_test, test_batch, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [
        userId,
        body.name!.trim(),
        body.description!.trim(),
        body.tone?.trim() || "professional",
        channel,
        category,
        scheduledAt,
        normalizeHourlyRate(body.throttle_per_hour),
        // Follow-up sequences are an email feature; DM drafts are one-shot
        channel === "email" ? Math.min(3, Math.max(0, body.followup_count ?? 0)) : 0,
        Math.min(30, Math.max(1, body.followup_interval_days ?? 3)),
        windowStart,
        windowEnd,
        channel === "email" && body.ab_test ? 1 : 0,
        Math.min(20, Math.max(0, Math.round(body.test_batch ?? 0))),
        body.send_now ? "running" : "scheduled",
      ]
    );
    const id = rows[0].id;
    for (const r of recipients) {
      await tx.query(
        "INSERT INTO emails (user_id, campaign_id, contact_id) VALUES ($1, $2, $3)",
        [userId, id, r.id]
      );
    }
    return id;
  });

  return NextResponse.json({ id: campaignId, recipients: recipients.length });
}
