import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Click tracking: links in sent emails are wrapped through here. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!rateLimit(`track:${clientIp(req)}`, 120, 60_000)) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const { token } = await params;
  const target = req.nextUrl.searchParams.get("u") ?? "";

  // Redirect only for tokens we actually issued — otherwise this endpoint
  // would be an open redirect anyone could abuse in phishing links.
  let known = false;
  if (token && /^[a-f0-9]{16,64}$/.test(token)) {
    try {
      known = Boolean(await q1("SELECT 1 FROM emails WHERE open_token = $1", [token]));
      if (known) {
        // A click implies an open too (pixel may have been blocked)
        await q(
          `UPDATE emails SET clicked_at = COALESCE(clicked_at, now()),
             opened_at = COALESCE(opened_at, now()) WHERE open_token = $1`,
          [token]
        );
      }
    } catch {
      // never block the redirect for a legitimate token
    }
  }

  // Only redirect to plain http(s) targets
  if (known && /^https?:\/\//i.test(target)) {
    return NextResponse.redirect(target, 302);
  }
  return new NextResponse("Invalid link", { status: 400 });
}
