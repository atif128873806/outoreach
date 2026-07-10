import { NextResponse } from "next/server";
import { q1 } from "@/lib/db";

export const runtime = "nodejs";

/** Liveness + database connectivity, for load balancers and uptime monitors. */
export async function GET() {
  try {
    await q1("SELECT 1");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "db unreachable" },
      { status: 503 }
    );
  }
}
