import { NextRequest, NextResponse } from "next/server";
import { recheckSiteLead } from "@/lib/leads";
import { locationTerms } from "@/lib/geo";
import { normalizeFilter } from "@/lib/plans";
import { getUserId } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { safeFetchUrlReject } from "@/lib/safe-url";
import { friendlyProviderError } from "@/lib/friendly-error";
import { recordRecheckEvent } from "@/lib/search-cache";

/**
 * Re-check one lead's website, now.
 *
 * The website visit behind every audit is cached by site (see
 * lib/search-cache.ts), which is what makes a search fast — but it also means an
 * audit can be days old, and a user is about to quote it at a stranger. This
 * endpoint is the honest escape hatch: it ignores both cache layers, visits the
 * site, answers with the fresh audit, and **writes the fresh facts back** so the
 * correction outlives one page load.
 *
 * Logged to `recheck_events` — its own table, not `search_events`: a re-check is
 * not a search, and folding one into the other would corrupt the funnel numbers
 * that log exists to report. What this log is *for* is the number that decides
 * the site cache's TTL: when someone checks again, how old was the audit they
 * were shown, and did the fresh visit agree with it? "Of the audits over three
 * days old that were re-checked, 40% had moved" is a decision; a guess is not.
 * Refusals are logged too — this endpoint takes a URL from a user, so somebody
 * will eventually point it at the server's own network, and that should be
 * visible to the operator rather than silently swallowed.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // One site per call, and each call asks that site's own server for a page or
  // two. Keep the pace courteous even for a user clicking down a long list.
  if (!rateLimit(`recheck:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "That's a lot of re-checks at once — wait a minute and try again." },
      { status: 429 }
    );
  }

  const body = (await req.json()) as {
    website?: string;
    /** The search's location, so the market rule matches the one the lead came from. */
    location?: string;
    /** The filter the user is browsing with: "outdated" means the deep audit. */
    filter?: string;
    lead?: {
      business_name?: string;
      email?: string;
      phone?: string;
      instagram?: string;
      linkedin?: string;
      address?: string;
      notes?: string;
    };
  };

  const website = (body.website ?? "").trim();
  const refusal = safeFetchUrlReject(website);
  if (refusal) {
    await recordRecheckEvent({
      userId,
      website,
      ageSeconds: null,
      scoreBefore: null,
      scoreAfter: null,
      outcome: "refused",
      detail: refusal,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: refusal }, { status: 400 });
  }

  const filter = normalizeFilter(body.filter);
  const terms = locationTerms(body.location ?? "");

  try {
    const report = await recheckSiteLead(website, body.lead ?? {}, {
      deep: filter === "outdated",
      uk: terms.country === "GB",
    });
    if (!report) {
      await recordRecheckEvent({
        userId,
        website,
        ageSeconds: null,
        scoreBefore: null,
        scoreAfter: null,
        outcome: "failed",
        detail: "the site did not load",
        latencyMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error:
            "We couldn't load that site just now — it may be down, or blocking automated checks. The audit below is unchanged.",
        },
        { status: 502 }
      );
    }
    await recordRecheckEvent({
      userId,
      website,
      ageSeconds: report.replaced?.ageSeconds ?? null,
      scoreBefore: report.replaced?.score ?? null,
      scoreAfter: report.score,
      outcome: "ok",
      // Free text for the operator's eye, not a metric — the dashboard counts
      // `changed` from the two scores so nothing depends on this string.
      detail: report.changed ? "the score moved" : "unchanged",
      latencyMs: Date.now() - startedAt,
    });
    const lead = report.lead;
    // Only the fields a fresh visit can change. Echoing the whole lead back
    // would let this route quietly overwrite the row it was asked to update.
    return NextResponse.json({
      checkedAt: lead.site_audited_at,
      changed: report.changed,
      note: report.note,
      lead: {
        website: lead.website,
        email: lead.email,
        phone: lead.phone,
        instagram: lead.instagram,
        linkedin: lead.linkedin,
        address: lead.address,
        notes: lead.notes,
        tech: lead.tech,
        pixels: lead.pixels,
        site_audit: lead.site_audit,
        site_flags: lead.site_flags,
        site_audited_at: lead.site_audited_at,
      },
    });
  } catch (err) {
    await recordRecheckEvent({
      userId,
      website,
      ageSeconds: null,
      scoreBefore: null,
      scoreAfter: null,
      outcome: "failed",
      detail: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: friendlyProviderError(err, "search") }, { status: 502 });
  }
}
