import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth";
import { rateLimitDb, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Landing point of the emailed verification link. Redirects into the app. */
export async function GET(req: NextRequest) {
  if (!(await rateLimitDb(`verify:${clientIp(req)}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = await verifyEmailToken(token);

  const dest = new URL(userId ? "/dashboard" : "/login", req.url);
  dest.searchParams.set("verified", userId ? "1" : "0");
  return NextResponse.redirect(dest);
}
