import { NextRequest, NextResponse } from "next/server";
import { checkDomainDns, normalizeDomain } from "@/lib/dnscheck";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Public (no-signup) SPF/DKIM/DMARC checker behind /tools/dns-checker.
 * Rate-limited per IP — it triggers real DNS lookups.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`dnstool-m:${ip}`, 8, 60_000) || !rateLimit(`dnstool-h:${ip}`, 40, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many checks — wait a minute and try again" },
      { status: 429 }
    );
  }

  const { domain: raw } = (await req.json()) as { domain?: string };
  const domain = normalizeDomain(raw ?? "");
  if (!domain) {
    return NextResponse.json(
      { error: "Enter a valid domain, like yourcompany.com" },
      { status: 400 }
    );
  }

  return NextResponse.json(await checkDomainDns(domain));
}
