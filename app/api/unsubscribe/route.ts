import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

async function applyUnsubscribe(token: string | null): Promise<boolean> {
  if (!token || !/^[a-f0-9]{16,128}$/i.test(token)) return false;
  const rows = await q<{ id: number }>(
    "UPDATE contacts SET unsubscribed = 1 WHERE unsub_token = $1 RETURNING id",
    [token]
  );
  return rows.length > 0;
}

function page(title: string, message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#f6f6f7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:40px;max-width:420px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 12px}p{color:#555;font-size:14px;line-height:1.6;margin:0}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`unsub:${clientIp(req)}`, 30, 60_000)) {
    return page("Slow down", "Too many requests — please try again in a minute.");
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return page("Invalid link", "This unsubscribe link is missing its token.");

  if (!(await applyUnsubscribe(token))) {
    return page("Link not recognized", "We couldn't find a matching subscription. You may already be unsubscribed.");
  }
  return page("You're unsubscribed", "You won't receive any further emails from us. Sorry to see you go.");
}

/** RFC 8058 one-click unsubscribe. Mail providers call this endpoint directly. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`unsub-post:${clientIp(req)}`, 300, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("token");
  const ok = await applyUnsubscribe(token);

  // A provider needs a machine-readable response with no confirmation step.
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
