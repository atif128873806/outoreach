import { NextRequest, NextResponse } from "next/server";
import { searchOsm, searchGooglePlaces, enrichLeads, type Lead } from "@/lib/leads";
import { searchExaCompanies } from "@/lib/exa";
import { getSettings } from "@/lib/settings";
import { getUserId } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getLeadQuota, leadQuotaMessage, recordUsage } from "@/lib/usage";
import { q } from "@/lib/db";
import { friendlyProviderError } from "@/lib/friendly-error";

export const runtime = "nodejs";
// Search + enrichment can take a while for larger lead counts
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lead searches hit free third-party services — keep the pace neighborly.
  if (!rateLimit(`leads:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many searches — wait a minute and try again" },
      { status: 429 }
    );
  }

  const body = (await req.json()) as {
    source?: string;
    niche?: string;
    location?: string;
    count?: number;
  };

  // Plan quota: each returned lead counts against the monthly allowance.
  const quota = await getLeadQuota(userId);
  if (quota.remaining !== null && quota.remaining <= 0) {
    return NextResponse.json({ error: leadQuotaMessage(quota) }, { status: 403 });
  }

  const niche = body.niche?.trim();
  const location = body.location?.trim();
  let count = Math.min(50, Math.max(1, body.count ?? 10));
  if (quota.remaining !== null) count = Math.min(count, quota.remaining);
  const source =
    body.source === "google" ? "google" : body.source === "osm" ? "osm" : "web";

  if (!niche) {
    return NextResponse.json({ error: "Enter a niche (e.g. restaurants, dentists)" }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: "Enter a location (e.g. Lahore, Pakistan)" }, { status: 400 });
  }

  try {
    let leads: Lead[];
    if (source === "google") {
      const key = (await getSettings(userId)).google_places_api_key;
      if (!key) {
        return NextResponse.json(
          { error: "Add a Google Places API key in Settings to use the Google source, or switch to OpenStreetMap (free)" },
          { status: 400 }
        );
      }
      leads = await searchGooglePlaces(niche, location, count, key);
    } else if (source === "osm") {
      leads = await searchOsm(niche, location, count);
    } else {
      leads = await searchExaCompanies(niche, location, count);
    }

    if (leads.length === 0) {
      return NextResponse.json({
        leads: [],
        meta: { found: 0, withEmail: 0, withInstagram: 0 },
        note: "No businesses found. Try a broader niche (e.g. 'restaurant' instead of 'vegan bistro') or a bigger location.",
      });
    }

    // Enrich a few more than requested so missing emails don't shrink the result.
    const toEnrich = leads.slice(0, Math.min(leads.length, count + 10));
    const enriched = await enrichLeads(toEnrich);

    // Hide leads that are already in this user's Contacts (matched by email or
    // website host) — re-running the same search shouldn't show old finds or
    // charge quota for them.
    const existing = await q<{ email: string; website: string }>(
      "SELECT email, website FROM contacts WHERE user_id = $1",
      [userId]
    );
    const knownEmails = new Set(existing.map((c) => c.email.toLowerCase()));
    const host = (u: string) =>
      u.toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split("/")[0];
    const knownHosts = new Set(existing.filter((c) => c.website).map((c) => host(c.website)));
    const fresh = enriched.filter(
      (l) =>
        !(l.email && knownEmails.has(l.email.toLowerCase())) &&
        !(l.website && knownHosts.has(host(l.website)))
    );
    const skippedExisting = enriched.length - fresh.length;

    // Contactable leads first, then trim to the requested amount.
    fresh.sort(
      (a, b) =>
        Number(Boolean(b.email)) * 2 + Number(Boolean(b.instagram)) -
        (Number(Boolean(a.email)) * 2 + Number(Boolean(a.instagram)))
    );
    const result = fresh.slice(0, count);

    await recordUsage(userId, "leads", result.length);
    const remaining =
      quota.remaining === null ? null : Math.max(0, quota.remaining - result.length);

    // Be honest when we deliver fewer than asked — and say why.
    const notes: string[] = [];
    if (skippedExisting > 0) {
      notes.push(
        `${skippedExisting} result${skippedExisting > 1 ? "s" : ""} already in your Contacts ${skippedExisting > 1 ? "were" : "was"} hidden (not counted against your quota).`
      );
    }
    if (result.length < count) {
      notes.push(
        `Found ${result.length} new ${result.length === 1 ? "match" : "matches"} for this search — sources have limits per area. Try another source (OpenStreetMap or Google), a broader niche, or a nearby city for more.`
      );
    }

    return NextResponse.json({
      leads: result,
      note: notes.length ? notes.join(" ") : undefined,
      meta: {
        found: result.length,
        withEmail: result.filter((l) => l.email).length,
        withInstagram: result.filter((l) => l.instagram).length,
        skippedExisting,
        quota: { plan: quota.plan.id, limit: quota.limit, remaining },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err, "search") }, { status: 500 });
  }
}
