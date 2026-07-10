import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/** Inbound replies with AI classification and suggested responses. */
export async function GET() {
  const db = getDb();
  const replies = db
    .prepare(
      `SELECT r.*, c.business_name, c.category
       FROM replies r JOIN contacts c ON c.id = r.contact_id
       ORDER BY r.handled ASC, r.id DESC
       LIMIT 100`
    )
    .all();
  return NextResponse.json({ replies });
}

export async function PATCH(req: NextRequest) {
  const { id, action } = (await req.json()) as { id?: number; action?: string };
  if (!id || action !== "mark_handled") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = getDb()
    .prepare("UPDATE replies SET handled = 1 WHERE id = ? AND handled = 0")
    .run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Reply not found or already handled" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
