import { NextRequest, NextResponse } from "next/server";
import { searchOsm, searchGooglePlaces, enrichLeads, type Lead } from "@/lib/leads";
import { searchExaCompanies } from "@/lib/exa";
import { getSettings } from "@/lib/settings";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
// Search + enrichment can take a while for larger lead counts
export const maxDuration = 180;

export async function POST(req: NextRequest) {
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

  const niche = body.niche?.trim();
  const location = body.location?.trim();
  const count = Math.min(50, Math.max(1, body.count ?? 10));
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
      const key = getSettings().google_places_api_key;
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

    // Contactable leads first, then trim to the requested amount.
    enriched.sort(
      (a, b) =>
        Number(Boolean(b.email)) * 2 + Number(Boolean(b.instagram)) -
        (Number(Boolean(a.email)) * 2 + Number(Boolean(a.instagram)))
    );
    const result = enriched.slice(0, count);

    return NextResponse.json({
      leads: result,
      meta: {
        found: result.length,
        withEmail: result.filter((l) => l.email).length,
        withInstagram: result.filter((l) => l.instagram).length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lead search failed" },
      { status: 500 }
    );
  }
}
