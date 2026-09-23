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

  const body = (await req.json()) as {
    business_name?: string;
    location?: string;
    /**
     * Names of the people behind the business, when the source already knows
     * them (register directors). The lookup becomes a search for those
     * individuals and refuses anyone else, instead of answering with whoever
     * ranks for the company.
     *
     * `person` (one name) is still accepted so older callers keep working.
     */
    people?: string[];
    person?: string;
  };
  const businessName = body.business_name?.trim();
  if (!businessName) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  // Owner lookups draw from the same monthly Lead Finder allowance (1 each).
  const quota = await getLeadQuota(userId);
  if (quota.remaining !== null && quota.remaining <= 0) {
    return NextResponse.json({ error: leadQuotaMessage(quota) }, { status: 403 });
  }

  const people = (body.people ?? [])
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  if (body.person?.trim()) people.push(body.person.trim());

  try {
    const candidates = await searchExaPeople(businessName, body.location?.trim() ?? "", {
      people,
    });
    await recordUsage(userId, "leads", 1);
    return NextResponse.json({ candidates });
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err, "search") }, { status: 500 });
  }
}
