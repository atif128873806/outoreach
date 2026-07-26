import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";

/** Instagram/LinkedIn drafts awaiting manual send. */
export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drafts = await q(
    `SELECT e.id, e.body, e.via, e.created_at, e.campaign_id, e.step, e.contact_id,
            c.business_name, c.instagram, c.linkedin, c.email AS contact_email, c.category,
            cp.name AS campaign_name, cp.channel, cp.followup_count
     FROM emails e
     JOIN contacts c ON c.id = e.contact_id
     JOIN campaigns cp ON cp.id = e.campaign_id
     WHERE e.user_id = $1 AND e.status = 'ready'
     ORDER BY e.id`,
    [userId]
  );
  return NextResponse.json({ drafts });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action } = (await req.json()) as { id?: number; action?: string };
  if (!id || !["mark_sent", "skip", "got_reply"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "got_reply") {
    // The contact answered on the platform — stop their sequence everywhere:
    // flag the contact (the runner skips follow-up generation for replied
    // contacts) and drop every draft still queued for them in this campaign.
    const rows = await q<{ contact_id: number; campaign_id: number }>(
      `SELECT contact_id, campaign_id FROM emails WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    const { contact_id, campaign_id } = rows[0];
    await q("UPDATE contacts SET replied = 1 WHERE id = $1 AND user_id = $2", [
      contact_id,
      userId,
    ]);
    await q(
      `UPDATE emails SET status = 'skipped', error = 'contact replied — sequence stopped'
       WHERE user_id = $1 AND campaign_id = $2 AND contact_id = $3
         AND status IN ('pending', 'ready')`,
      [userId, campaign_id, contact_id]
    );
    return NextResponse.json({ ok: true });
  }

  const rows =
    action === "mark_sent"
      ? await q<{ id: number; campaign_id: number; contact_id: number; step: number }>(
          `UPDATE emails SET status = 'sent', via = 'manual-dm', sent_at = now()
           WHERE id = $1 AND user_id = $2 AND status = 'ready'
           RETURNING id, campaign_id, contact_id, step`,
          [id, userId]
        )
      : await q<{ id: number; campaign_id: number; contact_id: number; step: number }>(
          `UPDATE emails SET status = 'skipped', error = 'skipped from message center'
           WHERE id = $1 AND user_id = $2 AND status = 'ready'
           RETURNING id, campaign_id, contact_id, step`,
          [id, userId]
        );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Draft not found or already handled" }, { status: 404 });
  }

  if (action === "mark_sent") {
    // Manual channels mirror the email sequence: sending step N queues step
    // N+1 after the follow-up interval. The runner generates the draft when
    // it comes due (and skips it if the contact has replied by then).
    const sent = rows[0];
    const campaign = await q1<{ followup_count: number; followup_interval_days: number }>(
      "SELECT followup_count, followup_interval_days FROM campaigns WHERE id = $1",
      [sent.campaign_id]
    );
    if (campaign && sent.step <= campaign.followup_count) {
      const dueAt = new Date(
        Date.now() + campaign.followup_interval_days * 24 * 60 * 60 * 1000
      ).toISOString();
      await q(
        `INSERT INTO emails (user_id, campaign_id, contact_id, step, scheduled_for)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, sent.campaign_id, sent.contact_id, sent.step + 1, dueAt]
      );
      // The campaign completes once all drafts are generated, which usually
      // happens before the user marks them sent — revive it so the runner
      // picks up the queued follow-up.
      await q(
        "UPDATE campaigns SET status = 'running' WHERE id = $1 AND status = 'completed'",
        [sent.campaign_id]
      );
    }
  }

  return NextResponse.json({ ok: true });
}
