import { NextRequest, NextResponse } from "next/server";
import { searchExaPeople } from "@/lib/exa";
import { getUserId } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getLeadQuota, leadQuotaMessage, recordUsage } from "@/lib/usage";
import { friendlyProviderError } from "@/lib/friendly-error";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Decision-maker finder: the people (LinkedIn) behind a business. */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Owner lookups draw from the same monthly Lead Finder allowance (1 each).
  const quota = await getLeadQuota(userId);
  if (quota.remaining !== null && quota.remaining <= 0) {
    return NextResponse.json({ error: leadQuotaMessage(quota) }, { status: 403 });
  }

  try {
    const candidates = await searchExaPeople(businessName, body.location?.trim() ?? "");
    await recordUsage(userId, "leads", 1);
    return NextResponse.json({ candidates });
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err, "search") }, { status: 500 });
  }
}
