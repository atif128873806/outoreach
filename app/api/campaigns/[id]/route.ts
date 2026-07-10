import { NextRequest, NextResponse } from "next/server";
import { q, q1, type Campaign } from "@/lib/db";
import { getUserId } from "@/lib/auth";

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

  return NextResponse.json({ campaign, emails });
}

const ACTIONS: Record<string, { from: string[]; to: string }> = {
  pause: { from: ["running", "scheduled"], to: "paused" },
  resume: { from: ["paused"], to: "running" },
  cancel: { from: ["running", "scheduled", "paused"], to: "cancelled" },
  start_now: { from: ["scheduled", "paused"], to: "running" },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = (await req.json()) as { action?: string };

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
