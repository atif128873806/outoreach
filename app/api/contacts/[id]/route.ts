import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeInstagram(v: string): string {
  return v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?].*$/, "");
}

const EDITABLE = [
  "business_name",
  "category",
  "website",
  "instagram",
  "linkedin",
  "phone",
  "notes",
  "replied",
  "unsubscribed",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    let v = body[key];
    if (key === "replied" || key === "unsubscribed") v = v ? 1 : 0;
    else if (key === "instagram") v = normalizeInstagram(String(v ?? ""));
    else v = String(v ?? "").trim();
    sets.push(`${key} = $${idx++}`);
    values.push(v);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const rows = await q<{ id: number }>(
    `UPDATE contacts SET ${sets.join(", ")} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING id`,
    [...values, Number(id), userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
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
    "DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id",
    [Number(id), userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
