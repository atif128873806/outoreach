import { NextRequest, NextResponse } from "next/server";
import { q, q1, type Campaign } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { normalizeHourlyRate } from "@/lib/throttle";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await q1<Campaign>(
    "SELECT * FROM campaigns WHERE id = $1 AND user_id = $2",
    [Number(id), userId]
  );
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const emails = await q(
    `SELECT e.*, c.email AS contact_email, c.business_name, c.category, c.instagram, c.linkedin
     FROM emails e JOIN contacts c ON c.id = e.contact_id
     WHERE e.campaign_id = $1
     ORDER BY e.id`,
    [Number(id)]
  );

  // How many messages fell back to the template engine (AI limit/provider
  // hiccup) — surfaced in the UI so custom-brief users aren't left guessing.
  const t = await q1<{ n: string | number }>(
    "SELECT COUNT(*) n FROM emails WHERE campaign_id = $1 AND via LIKE '%+template%'",
    [Number(id)]
  );

  return NextResponse.json({ campaign, emails, templateCount: Number(t?.n ?? 0) });
}

const ACTIONS: Record<string, { from: string[]; to: string }> = {
  pause: { from: ["running", "scheduled"], to: "paused" },
  resume: { from: ["paused"], to: "running" },
  cancel: { from: ["running", "scheduled", "paused"], to: "cancelled" },
  start_now: { from: ["scheduled", "paused"], to: "running" },
};

interface EditFields {
  name?: string;
  description?: string;
  tone?: string;
  throttle_per_hour?: number;
  followup_count?: number;
  followup_interval_days?: number;
  send_window_start?: number | null;
  send_window_end?: number | null;
  scheduled_at?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, fields } = (await req.json()) as { action?: string; fields?: EditFields };

  // Editing: messages are generated at send time, so brief/tone/pace changes
  // apply to every not-yet-sent message. Audience stays fixed (recipients are
  // locked at creation).
  if (action === "edit") {
    const campaign = await q1<Campaign>(
      "SELECT * FROM campaigns WHERE id = $1 AND user_id = $2",
      [Number(id), userId]
    );
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (!["scheduled", "paused", "running"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Completed or cancelled campaigns can't be edited" },
        { status: 409 }
      );
    }
    const f = fields ?? {};
    if (f.name !== undefined && !f.name.trim()) {
      return NextResponse.json({ error: "Campaign name can't be empty" }, { status: 400 });
    }
    if (f.description !== undefined && !f.description.trim()) {
      return NextResponse.json({ error: "The campaign brief can't be empty" }, { status: 400 });
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (f.name !== undefined) push("name", f.name.trim());
    if (f.description !== undefined) push("description", f.description.trim());
    if (f.tone !== undefined) push("tone", f.tone.trim() || "professional");
    if (f.throttle_per_hour !== undefined) {
      push("throttle_per_hour", normalizeHourlyRate(f.throttle_per_hour));
    }
    if (f.followup_count !== undefined && campaign.channel === "email") {
      push("followup_count", Math.min(3, Math.max(0, f.followup_count)));
    }
    if (f.followup_interval_days !== undefined) {
      push("followup_interval_days", Math.min(30, Math.max(1, f.followup_interval_days)));
    }
    if (f.send_window_start !== undefined) {
      push("send_window_start", typeof f.send_window_start === "number" ? f.send_window_start : null);
    }
    if (f.send_window_end !== undefined) {
      push("send_window_end", typeof f.send_window_end === "number" ? f.send_window_end : null);
    }
    if (f.scheduled_at !== undefined && campaign.status === "scheduled") {
      const t = new Date(f.scheduled_at).getTime();
      if (Number.isNaN(t)) {
        return NextResponse.json({ error: "Invalid schedule time" }, { status: 400 });
      }
      push("scheduled_at", new Date(t).toISOString());
    }
    if (!sets.length) return NextResponse.json({ ok: true, unchanged: true });

    vals.push(Number(id), userId);
    await q(
      `UPDATE campaigns SET ${sets.join(", ")} WHERE id = $${vals.length - 1} AND user_id = $${vals.length}`,
      vals
    );
    return NextResponse.json({ ok: true });
  }

  const rule = action ? ACTIONS[action] : undefined;
  if (!rule) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const rows = await q<{ id: number }>(
    `UPDATE campaigns SET status = $1
     WHERE id = $2 AND user_id = $3 AND status = ANY($4) RETURNING id`,
    [rule.to, Number(id), userId, rule.from]
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Action not allowed in the campaign's current state" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await q<{ id: number }>(
    `DELETE FROM campaigns
     WHERE id = $1 AND user_id = $2
       AND status IN ('completed', 'cancelled', 'scheduled', 'paused') RETURNING id`,
    [Number(id), userId]
  );
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Pause or cancel the campaign before deleting it" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
