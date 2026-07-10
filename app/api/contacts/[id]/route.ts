import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
  "phone",
  "notes",
  "replied",
  "unsubscribed",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    let v = body[key];
    if (key === "replied" || key === "unsubscribed") v = v ? 1 : 0;
    else if (key === "instagram") v = normalizeInstagram(String(v ?? ""));
    else v = String(v ?? "").trim();
    sets.push(`${key} = ?`);
    values.push(v);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values, Number(id));
  if (result.changes === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare("DELETE FROM contacts WHERE id = ?").run(Number(id));
  if (result.changes === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
