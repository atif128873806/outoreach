import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/** Open tracking: the pixel in each sent email points here. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (
    rateLimit(`track:${clientIp(_req)}`, 120, 60_000) &&
    token &&
    /^[a-f0-9]{16,64}$/.test(token)
  ) {
    try {
      const db = getDb();
      db.prepare(
        "UPDATE emails SET opened_at = ? WHERE open_token = ? AND opened_at IS NULL"
      ).run(new Date().toISOString(), token);
    } catch {
      // never fail the pixel
    }
  }
  return new NextResponse(PIXEL as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
