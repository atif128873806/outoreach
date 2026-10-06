import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { isSearchAction, recordSearchAction } from "@/lib/search-actions";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestOrigin = new URL(req.url);
  // Next may construct its internal URL with localhost in development. The
  // Host header is the browser-facing authority (including its port).
  requestOrigin.host = req.headers.get("host") ?? requestOrigin.host;
  if (req.headers.get("origin") !== requestOrigin.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  // Saves are recorded by the contact import transaction, never by the browser.
  if (!isSearchAction(body?.action) || body.action === "saved") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const { id } = await params;
  const recorded = await recordSearchAction(userId, Number(id), body.action);
  return recorded ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No completed search" }, { status: 404 });
}
