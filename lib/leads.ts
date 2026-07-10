/**
 * Lead Finder — discovers business leads by niche + location.
 *
 * Sources:
 *  - OpenStreetMap (Overpass API): free, no key, open data (ODbL).
 *  - Google Places API (official): higher quality, needs a key from the user.
 *
 * Neither source includes email addresses, so leads with a website go through
 * an enrichment pass that fetches the site (and its contact page) and extracts
 * email addresses and Instagram handles.
 */

export interface Lead {
  business_name: string;
  category: string;
  website: string;
  phone: string;
  email: string;
  instagram: string;
  /** LinkedIn path, e.g. "company/acme" or "in/janedoe" */
  linkedin: string;
  address: string;
  /** Short company intel (what they do, size, founding) — feeds AI personalization. */
  notes: string;
  source: string;
}

const UA = "OutreachStudio/1.0 (local lead finder)";

// ---------- helpers ----------

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(ms),
    headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
  });
}

function normalizeInstagram(v: string): string {
  return v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}

const IG_JUNK = new Set([
  "p", "reel", "reels", "explore", "stories", "accounts", "share", "direct", "about", "developer", "legal",
]);

/** "https://www.linkedin.com/company/acme/" | "company/acme" | "acme" → "company/acme" */
export function normalizeLinkedin(v: string): string {
  const path = v
    .trim()
    .replace(/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i, "")
    .replace(/^\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
  if (!path) return "";
  if (/^(company|in|school|showcase)\//i.test(path)) return path;
  if (path.includes("/")) return ""; // some other linkedin path (feed, posts, …)
  return `company/${path}`; // bare handle — business contacts are company pages
}

export function extractLinkedin(html: string): string {
  const m = html.match(/linkedin\.com\/(company|in|school|showcase)\/([a-zA-Z0-9\-_.%]{2,60})/i);
  return m ? `${m[1].toLowerCase()}/${m[2]}` : "";
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function extractEmails(html: string): string[] {
  const found = html.match(EMAIL_RE) ?? [];
  const clean = new Set<string>();
  for (const raw of found) {
    const e = raw.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/.test(e)) continue;
    if (e.includes("example.") || e.includes("sentry") || e.includes("wixpress") || e.includes("your-email") || e.includes("email@")) continue;
    clean.add(e);
  }
  return [...clean];
}

export function extractInstagram(html: string): string {
  const matches = html.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})/g);
  for (const m of matches) {
    const handle = normalizeInstagram(m[1]);
    if (handle && !IG_JUNK.has(handle.toLowerCase())) return handle;
  }
  return "";
}

// ---------- geocoding (Nominatim) ----------

async function geocode(
  location: string
): Promise<{ south: number; west: number; north: number; east: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
  const res = await fetchWithTimeout(url, 10_000);
  if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
  const data = (await res.json()) as {
    lat?: string;
    lon?: string;
    boundingbox?: string[];
  }[];
  const hit = data[0];
  if (!hit?.boundingbox) return null;

  let south = parseFloat(hit.boundingbox[0]);
  let north = parseFloat(hit.boundingbox[1]);
  let west = parseFloat(hit.boundingbox[2]);
  let east = parseFloat(hit.boundingbox[3]);

  // City boundaries can be huge (whole states). Clamp the search area to
  // ~0.3° (~33 km) around the center so Overpass queries stay fast.
  const MAX = 0.3;
  const lat = parseFloat(hit.lat ?? String((south + north) / 2));
  const lon = parseFloat(hit.lon ?? String((west + east) / 2));
  if (north - south > MAX) {
    south = lat - MAX / 2;
    north = lat + MAX / 2;
  }
  if (east - west > MAX) {
    west = lon - MAX / 2;
    east = lon + MAX / 2;
  }
  return { south, west, north, east };
}

// ---------- OpenStreetMap (Overpass) ----------

interface OsmElement {
  tags?: Record<string, string>;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Common niche words → the OSM tag values actually used for them
const NICHE_ALIASES: Record<string, string> = {
  gym: "fitness_centre|fitness|gym",
  fitness: "fitness_centre|fitness|gym",
  dentist: "dentist|dental",
  dental: "dentist|dental",
  "dental clinic": "dentist|dental",
  doctor: "doctors|clinic",
  clinic: "clinic|doctors",
  "hair salon": "hairdresser|beauty",
  barber: "hairdresser|barber",
  salon: "hairdresser|beauty",
  "beauty salon": "beauty|hairdresser|cosmetics",
  lawyer: "lawyer|notary",
  "real estate": "estate_agent",
  realtor: "estate_agent",
  mechanic: "car_repair",
  "car repair": "car_repair",
  "auto repair": "car_repair",
  coffee: "cafe|coffee",
  "coffee shop": "cafe|coffee",
  hotel: "hotel|guest_house|hostel",
  florist: "florist",
  vet: "veterinary",
  veterinarian: "veterinary",
  pharmacy: "pharmacy|chemist",
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function runOverpass(query: string): Promise<{ elements?: OsmElement[] }> {
  let lastErr: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint, 45_000, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!res.ok) {
        lastErr = new Error(`OpenStreetMap search failed (${res.status})`);
        continue; // busy server — try the mirror
      }
      return (await res.json()) as { elements?: OsmElement[] };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new Error(
    `${lastErr?.message ?? "OpenStreetMap search failed"} — the free OSM servers are busy, try again in a minute`
  );
}

export async function searchOsm(
  niche: string,
  location: string,
  count: number
): Promise<Lead[]> {
  const bbox = await geocode(location);
  if (!bbox) throw new Error(`Couldn't find the location "${location}" — try "City, Country"`);

  // "Dental Clinics" → matches tag values like "dentist"/"dental_clinic"
  const lower = niche.trim().toLowerCase();
  const base = escapeRegex(lower.replace(/s$/, ""));
  const tagRegex = NICHE_ALIASES[lower] ?? NICHE_ALIASES[lower.replace(/s$/, "")] ?? base.replace(/\s+/g, "[_ ]?");
  const bb = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;

  const keys = ["amenity", "shop", "cuisine", "craft", "office", "leisure", "healthcare", "tourism"];
  const clauses = keys
    .map((k) => `nwr["${k}"~"${tagRegex}",i]["name"]${bb};`)
    .join("\n  ");

  const query = `[out:json][timeout:40];
(
  ${clauses}
);
out center tags ${Math.min(count * 6, 200)};`;

  const data = await runOverpass(query);

  const seen = new Set<string>();
  const leads: Lead[] = [];
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    const name = t.name?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const address = [
      [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
      t["addr:city"],
    ]
      .filter(Boolean)
      .join(", ");

    leads.push({
      business_name: name,
      category: niche.trim(),
      website: (t.website || t["contact:website"] || "").trim(),
      phone: (t.phone || t["contact:phone"] || "").trim(),
      email: (t.email || t["contact:email"] || "").trim().toLowerCase(),
      instagram: normalizeInstagram(t["contact:instagram"] || ""),
      linkedin: normalizeLinkedin(t["contact:linkedin"] || ""),
      address,
      notes: "",
      source: "openstreetmap",
    });
  }

  // Businesses that already have contact info first — they enrich/import best.
  leads.sort(
    (a, b) =>
      Number(Boolean(b.email)) * 4 + Number(Boolean(b.website)) * 2 + Number(Boolean(b.instagram)) -
      (Number(Boolean(a.email)) * 4 + Number(Boolean(a.website)) * 2 + Number(Boolean(a.instagram)))
  );
  return leads;
}

// ---------- Google Places (official API) ----------

interface GPlace {
  displayName?: { text?: string };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
}

export async function searchGooglePlaces(
  niche: string,
  location: string,
  count: number,
  apiKey: string
): Promise<Lead[]> {
  const res = await fetchWithTimeout("https://places.googleapis.com/v1/places:searchText", 15_000, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: `${niche} in ${location}`,
      pageSize: Math.min(count, 20),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { places?: GPlace[] };

  return (data.places ?? []).map((p) => ({
    business_name: p.displayName?.text?.trim() ?? "",
    category: niche.trim(),
    website: p.websiteUri ?? "",
    phone: p.nationalPhoneNumber ?? "",
    email: "",
    instagram: "",
    linkedin: "",
    address: p.formattedAddress ?? "",
    notes: "",
    source: "google_places",
  }));
}

// ---------- website enrichment ----------

async function fetchPageText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, 8_000, {
    headers: { Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) return "";
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return "";
  return (await res.text()).slice(0, 500_000);
}

/**
 * Jina Reader (r.jina.ai) renders a page — including JS-heavy sites the plain
 * fetch above gets nothing from — and returns it as clean text. Free without a
 * key; a JINA_API_KEY env var raises its rate limits. Used only when the
 * direct fetch found no email, to stay well inside the keyless rate limit.
 */
async function fetchPageViaJina(url: string): Promise<string> {
  const key = process.env.JINA_API_KEY;
  const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, 20_000, {
    headers: {
      Accept: "text/plain",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
  });
  if (!res.ok) return "";
  return (await res.text()).slice(0, 500_000);
}

/** Visits a lead's website (and its contact page) to find email + Instagram. */
async function enrichLead(lead: Lead): Promise<Lead> {
  if (!lead.website || (lead.email && lead.instagram)) return lead;
  const url = lead.website.startsWith("http") ? lead.website : `https://${lead.website}`;

  try {
    const html = await fetchPageText(url);

    if (html) {
      if (!lead.email) lead.email = extractEmails(html)[0] ?? "";
      if (!lead.instagram) lead.instagram = extractInstagram(html);
      if (!lead.linkedin) lead.linkedin = extractLinkedin(html);

      // No email on the homepage? Try the contact page.
      if (!lead.email) {
        const linkMatch = html.match(/href=["']([^"']*contact[^"']*)["']/i);
        if (linkMatch) {
          const contactUrl = new URL(linkMatch[1], url).toString();
          const contactHtml = await fetchPageText(contactUrl);
          if (contactHtml) {
            lead.email = extractEmails(contactHtml)[0] ?? "";
            if (!lead.instagram) lead.instagram = extractInstagram(contactHtml);
            if (!lead.linkedin) lead.linkedin = extractLinkedin(contactHtml);
          }
        }
      }
    }

    // Still no email — the site is likely JS-rendered or blocking plain
    // fetches. Let Jina Reader render it and scan the text instead.
    if (!lead.email) {
      const text = await fetchPageViaJina(url);
      if (text) {
        lead.email = extractEmails(text)[0] ?? "";
        if (!lead.instagram) lead.instagram = extractInstagram(text);
        if (!lead.linkedin) lead.linkedin = extractLinkedin(text);
      }
    }
  } catch {
    // site unreachable/slow — keep whatever we already have
  }
  return lead;
}

export async function enrichLeads(leads: Lead[], concurrency = 5): Promise<Lead[]> {
  const out: Lead[] = [...leads];
  for (let i = 0; i < out.length; i += concurrency) {
    const batch = out.slice(i, i + concurrency);
    const enriched = await Promise.all(batch.map(enrichLead));
    for (let j = 0; j < enriched.length; j++) out[i + j] = enriched[j];
  }
  return out;
}
