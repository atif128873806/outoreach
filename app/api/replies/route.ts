import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";

/** Inbound replies with AI classification and suggested responses. */
export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const replies = await q(
    `SELECT r.*, c.business_name, c.category
     FROM replies r JOIN contacts c ON c.id = r.contact_id
     WHERE r.user_id = $1
     ORDER BY r.handled ASC, r.id DESC
     LIMIT 100`,
    [userId]
  );
  return NextResponse.json({ replies });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action } = (await req.json()) as { id?: number; action?: string };
  if (!id || action !== "mark_handled") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const rows = await q<{ id: number }>(
    "UPDATE replies SET handled = 1 WHERE id = $1 AND user_id = $2 AND handled = 0 RETURNING id",
    [id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Reply not found or already handled" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
