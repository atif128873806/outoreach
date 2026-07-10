import { NextRequest, NextResponse } from "next/server";
import { getDb, type Campaign } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const campaign = db
    .prepare("SELECT * FROM campaigns WHERE id = ?")
    .get(Number(id)) as Campaign | undefined;
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const emails = db
    .prepare(
      `SELECT e.*, c.email AS contact_email, c.business_name, c.category, c.instagram, c.linkedin
       FROM emails e JOIN contacts c ON c.id = e.contact_id
       WHERE e.campaign_id = ?
       ORDER BY e.id`
    )
    .all(Number(id));

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
  const { id } = await params;
  const { action } = (await req.json()) as { action?: string };

  const rule = action ? ACTIONS[action] : undefined;
  if (!rule) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const db = getDb();
  const placeholders = rule.from.map(() => "?").join(", ");
  const result = db
    .prepare(
      `UPDATE campaigns SET status = ? WHERE id = ? AND status IN (${placeholders})`
    )
    .run(rule.to, Number(id), ...rule.from);

  if (result.changes === 0) {
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
  const { id } = await params;
  const db = getDb();
  const result = db
    .prepare(
      "DELETE FROM campaigns WHERE id = ? AND status IN ('completed', 'cancelled', 'scheduled', 'paused')"
    )
    .run(Number(id));
  if (result.changes === 0) {
    return NextResponse.json(
      { error: "Pause or cancel the campaign before deleting it" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
