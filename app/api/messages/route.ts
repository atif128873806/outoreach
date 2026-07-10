import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";

/** Instagram/LinkedIn drafts awaiting manual send. */
export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drafts = await q(
    `SELECT e.id, e.body, e.via, e.created_at, e.campaign_id,
            c.business_name, c.instagram, c.linkedin, c.email AS contact_email, c.category,
            cp.name AS campaign_name, cp.channel
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
  if (!id || !["mark_sent", "skip"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rows =
    action === "mark_sent"
      ? await q<{ id: number }>(
          `UPDATE emails SET status = 'sent', via = 'manual-dm', sent_at = now()
           WHERE id = $1 AND user_id = $2 AND status = 'ready' RETURNING id`,
          [id, userId]
        )
      : await q<{ id: number }>(
          `UPDATE emails SET status = 'skipped', error = 'skipped from message center'
           WHERE id = $1 AND user_id = $2 AND status = 'ready' RETURNING id`,
          [id, userId]
        );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Draft not found or already handled" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
