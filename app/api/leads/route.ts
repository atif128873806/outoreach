import { NextRequest, NextResponse } from "next/server";
import { searchOsm, searchGooglePlaces, enrichLeads, type Lead } from "@/lib/leads";
import { searchExaCompanies, findOfflineContact } from "@/lib/exa";
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
    /** "any" (default) | "with" | "without" — offline businesses are prime
     *  prospects for web/digital-service freelancers */
    websiteFilter?: string;
  };
  const websiteFilter =
    body.websiteFilter === "with" ||
    body.websiteFilter === "without" ||
    body.websiteFilter === "outdated"
      ? body.websiteFilter
      : "any";

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
    if (websiteFilter === "without") {
      // Offline-business pipeline: web search can't find businesses that
      // aren't on the web, so this mode always uses map data — OSM, merged
      // with Google Places when the user has a key (best phone coverage).
      leads = await searchOsm(niche, location, Math.max(count, 20));
      const key = (await getSettings(userId)).google_places_api_key;
      if (key) {
        try {
          const gp = await searchGooglePlaces(niche, location, count, key);
          const names = new Set(leads.map((l) => l.business_name.toLowerCase()));
          for (const g of gp) if (!names.has(g.business_name.toLowerCase())) leads.push(g);
        } catch {
          // Google being down must not break the OSM results
        }
      }
      leads = leads.filter((l) => !l.website);
    } else {
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
      if (websiteFilter === "with" || websiteFilter === "outdated") {
        leads = leads.filter((l) => l.website);
      }
    }

    if (leads.length === 0) {
      return NextResponse.json({
        leads: [],
        meta: { found: 0, withEmail: 0, withInstagram: 0 },
        note:
          websiteFilter === "without"
            ? "No businesses without a website found here. OpenStreetMap and Google Places are the best sources for offline businesses — or try a bigger area."
            : websiteFilter === "outdated"
              ? "No businesses with websites found for this search — try a broader niche or bigger area, then the audit can look for outdated sites."
              : "No businesses found. Try a broader niche (e.g. 'restaurant' instead of 'vegan bistro') or a bigger location.",
      });
    }

    let enriched: Lead[];
    if (websiteFilter === "without") {
      // No site to visit — instead, hunt each business's public footprint on
      // the web. Offline businesses usually DO have an Instagram page or a
      // directory listing with a phone; one targeted search per business
      // turns "name and address only" into an actually reachable lead.
      const pool = leads.slice(0, Math.min(leads.length, count + 8));
      const CONCURRENCY = 4;
      for (let i = 0; i < pool.length; i += CONCURRENCY) {
        await Promise.all(
          pool.slice(i, i + CONCURRENCY).map(async (l) => {
            if (l.instagram && l.phone) return; // already reachable
            const found = await findOfflineContact(l.business_name, location);
            if (!l.instagram) l.instagram = found.instagram;
            if (!l.phone) l.phone = found.phone;
            if (!l.email) l.email = found.email;
          })
        );
      }
      enriched = pool;
    } else {
      // Enrich a few more than requested so missing emails don't shrink the
      // result; outdated mode gets extra headroom since modern sites drop out.
      const headroom = websiteFilter === "outdated" ? count + 15 : count + 10;
      enriched = await enrichLeads(
        leads.slice(0, Math.min(leads.length, headroom)),
        5,
        websiteFilter === "outdated"
      );
      if (websiteFilter === "outdated") {
        // Keep only sites with concrete problems, and put those problems in
        // the notes — they become the AI's personalization material AND the
        // user's talking points ("I noticed your site isn't mobile-friendly…").
        enriched = enriched.filter((l) => (l.site_flags?.length ?? 0) > 0);
        for (const l of enriched) {
          l.notes = [l.notes, `Website issues: ${l.site_flags!.join("; ")}`]
            .filter(Boolean)
            .join(" | ");
        }
      }
    }

    // Hide leads that are already in this user's Contacts (matched by email,
    // website host, or — for no-email offline contacts — business name) so a
    // re-run doesn't show old finds or charge quota for them.
    const existing = await q<{ email: string; website: string; business_name: string }>(
      "SELECT email, website, business_name FROM contacts WHERE user_id = $1",
      [userId]
    );
    const knownEmails = new Set(existing.map((c) => c.email.toLowerCase()));
    const host = (u: string) =>
      u.toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split("/")[0];
    const knownHosts = new Set(existing.filter((c) => c.website).map((c) => host(c.website)));
    const knownNames = new Set(
      existing.filter((c) => !c.email && c.business_name).map((c) => c.business_name.toLowerCase())
    );
    const fresh = enriched.filter(
      (l) =>
        !(l.email && knownEmails.has(l.email.toLowerCase())) &&
        !(l.website && knownHosts.has(host(l.website))) &&
        !(l.business_name && knownNames.has(l.business_name.toLowerCase()))
    );
    const skippedExisting = enriched.length - fresh.length;

    // Most reachable first, then trim to the requested amount. Offline mode
    // ranks Instagram highest (DM campaigns work without an email address).
    fresh.sort((a, b) => {
      const score = (l: (typeof fresh)[number]) =>
        websiteFilter === "without"
          ? Number(Boolean(l.instagram)) * 4 + Number(Boolean(l.email)) * 2 + Number(Boolean(l.phone))
          : websiteFilter === "outdated"
            ? (l.site_flags?.length ?? 0) * 2 + Number(Boolean(l.email))
            : Number(Boolean(l.email)) * 2 + Number(Boolean(l.instagram));
      return score(b) - score(a);
    });
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
        websiteFilter === "outdated"
          ? `${result.length} of the sites audited showed real problems — the rest look modern. Ask for more leads or try another niche/city to widen the net.`
          : `Found ${result.length} new ${result.length === 1 ? "match" : "matches"} for this search — sources have limits per area. Try another source (OpenStreetMap or Google), a broader niche, or a nearby city for more.`
      );
    }
    if (websiteFilter === "outdated" && result.length > 0) {
      notes.push(
        "Each lead's notes list exactly what's wrong with their site — the AI uses them to personalize your pitch."
      );
    }
    if (websiteFilter === "without" && result.length > 0) {
      notes.push(
        "These businesses have no website — ideal prospects for web/digital services. Most have no email either: reach them by phone, or import them and run an Instagram DM campaign."
      );
    }

    return NextResponse.json({
      leads: result,
      note: notes.length ? notes.join(" ") : undefined,
      meta: {
        found: result.length,
        withEmail: result.filter((l) => l.email).length,
        withInstagram: result.filter((l) => l.instagram).length,
        withPhone: result.filter((l) => l.phone).length,
        skippedExisting,
        quota: { plan: quota.plan.id, limit: quota.limit, remaining },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err, "search") }, { status: 500 });
  }
}
