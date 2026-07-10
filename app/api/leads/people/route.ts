import { NextRequest, NextResponse } from "next/server";
import { searchExaPeople } from "@/lib/exa";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Decision-maker finder: the people (LinkedIn) behind a business. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`people:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Too many lookups — wait a minute and try again" },
      { status: 429 }
    );
  }

  const body = (await req.json()) as { business_name?: string; location?: string };
  const businessName = body.business_name?.trim();
  if (!businessName) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  try {
    const candidates = await searchExaPeople(businessName, body.location?.trim() ?? "");
    return NextResponse.json({ candidates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "People search failed" },
      { status: 500 }
    );
  }
}
