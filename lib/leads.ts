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
  /** Website-quality problems found by the outdated-site audit (redesign prospects). */
  site_flags?: string[];
  /** Detected site platform (WordPress, Shopify, …) — pitch-targeting data. */
  tech?: string;
  /** Marketing tags found on the site (Facebook Pixel, Google Analytics, …). */
  pixels?: string[];
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

/** Undo the common ways sites hide emails from scrapers: entities and [at]/[dot]. */
function deobfuscate(text: string): string {
  return text
    .replace(/&#0?64;|&commat;/gi, "@")
    .replace(/&#0?46;|&period;/gi, ".")
    .replace(/\s*[[(]\s*(?:at|@)\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*(?:dot|\.)\s*[\])]\s*/gi, ".");
}

const JUNK_EMAIL =
  /example\.|sentry|wixpress|your-email|email@|no-?reply|donotreply|godaddy|\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/;

/**
 * All plausible emails in a page, best first. When `siteHost` is given,
 * addresses on the business's own domain outrank gmail/hotmail catch-alls.
 */
export function extractEmails(html: string, siteHost?: string): string[] {
  const found = deobfuscate(html).match(EMAIL_RE) ?? [];
  const clean = new Set<string>();
  for (const raw of found) {
    const e = raw.toLowerCase();
    if (JUNK_EMAIL.test(e)) continue;
    clean.add(e);
  }
  const list = [...clean];
  if (siteHost) {
    const root = siteHost.replace(/^www\./, "");
    list.sort((a, b) => Number(b.endsWith(root)) - Number(a.endsWith(root)));
  }
  return list;
}

const PHONE_RE = /\+?\d[\d\s().\-]{7,}\d/g;

/**
 * Best plausible phone number in a blob of text. Prefers international
 * (+…) formats; 9–13 digits keeps real numbers and drops the long numeric
 * IDs (Facebook, tracking) that lurk in search results.
 */
export function extractPhone(text: string): string {
  const candidates = (text.match(PHONE_RE) ?? [])
    .map((raw) => ({ raw: raw.trim().replace(/\s+/g, " "), digits: raw.replace(/\D/g, "") }))
    .filter(
      ({ raw, digits }) =>
        digits.length >= 9 && digits.length <= 13 && !/^(19|20)\d{2}/.test(raw)
    );
  candidates.sort(
    (a, b) =>
      Number(b.raw.startsWith("+")) - Number(a.raw.startsWith("+")) ||
      Number(/[ ().-]/.test(b.raw)) - Number(/[ ().-]/.test(a.raw))
  );
  return candidates[0]?.raw ?? "";
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

// Common niche words → the OSM tag values used for them. When `keys` is set,
// the query targets only those tag keys — dramatically faster on Overpass
// than scanning every key with a case-insensitive regex.
const NICHE_ALIASES: Record<string, { re: string; keys?: string[] }> = {
  gym: { re: "fitness_centre|fitness|gym", keys: ["leisure", "amenity"] },
  fitness: { re: "fitness_centre|fitness|gym", keys: ["leisure", "amenity"] },
  dentist: { re: "dentist|dental", keys: ["amenity", "healthcare"] },
  dental: { re: "dentist|dental", keys: ["amenity", "healthcare"] },
  "dental clinic": { re: "dentist|dental", keys: ["amenity", "healthcare"] },
  doctor: { re: "doctors|clinic", keys: ["amenity", "healthcare"] },
  clinic: { re: "clinic|doctors", keys: ["amenity", "healthcare"] },
  "hair salon": { re: "hairdresser|beauty", keys: ["shop"] },
  barber: { re: "hairdresser|barber", keys: ["shop"] },
  salon: { re: "hairdresser|beauty", keys: ["shop"] },
  "beauty salon": { re: "beauty|hairdresser|cosmetics", keys: ["shop"] },
  lawyer: { re: "lawyer|notary", keys: ["office"] },
  "real estate": { re: "estate_agent", keys: ["office", "shop"] },
  "real estate agency": { re: "estate_agent", keys: ["office", "shop"] },
  "estate agent": { re: "estate_agent", keys: ["office", "shop"] },
  realtor: { re: "estate_agent", keys: ["office", "shop"] },
  mechanic: { re: "car_repair", keys: ["shop"] },
  "car repair": { re: "car_repair", keys: ["shop"] },
  "auto repair": { re: "car_repair", keys: ["shop"] },
  coffee: { re: "cafe|coffee", keys: ["amenity", "shop", "cuisine"] },
  "coffee shop": { re: "cafe|coffee", keys: ["amenity", "shop", "cuisine"] },
  restaurant: { re: "restaurant|fast_food", keys: ["amenity"] },
  cafe: { re: "cafe", keys: ["amenity"] },
  hotel: { re: "hotel|guest_house|hostel", keys: ["tourism"] },
  florist: { re: "florist", keys: ["shop"] },
  vet: { re: "veterinary", keys: ["amenity"] },
  veterinarian: { re: "veterinary", keys: ["amenity"] },
  pharmacy: { re: "pharmacy|chemist", keys: ["amenity", "shop", "healthcare"] },
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function runOverpass(query: string): Promise<{ elements?: OsmElement[] }> {
  let lastErr: Error | null = null;
  // Fail fast per mirror (30s) so a busy server costs seconds, not a minute.
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint, 30_000, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!res.ok) {
        lastErr = new Error(`OpenStreetMap search failed (${res.status})`);
        continue; // busy server — try the next mirror
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
  const alias = NICHE_ALIASES[lower] ?? NICHE_ALIASES[lower.replace(/s$/, "")];
  const base = escapeRegex(lower.replace(/s$/, ""));
  const tagRegex = alias?.re ?? base.replace(/\s+/g, "[_ ]?");
  const bb = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;

  // Known niches hit only their real tag keys with exact-case values (OSM tag
  // values are lowercase) — far cheaper than 8 case-insensitive regex scans.
  const keys = alias?.keys ?? [
    "amenity", "shop", "cuisine", "craft", "office", "leisure", "healthcare", "tourism",
  ];
  const flags = alias ? "" : ",i";
  const clauses = keys
    .map((k) => `nwr["${k}"~"${tagRegex}"${flags}]["name"]${bb};`)
    .join("\n  ");

  const query = `[out:json][timeout:25];
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

// ---------- website quality audit (redesign prospects) ----------

/** Hosts that mean "no real website" — free builders and social pages used as a site. */
const BUILDER_HOSTS =
  /(\.|^)(wixsite\.com|weebly\.com|blogspot\.\w+|wordpress\.com|sites\.google\.com|business\.site|webnode\.\w+|jimdofree\.com|000webhostapp\.com|neocities\.org|facebook\.com|instagram\.com|linktr\.ee)$/i;

/**
 * Scores a homepage for "this business needs a new website" signals.
 * Pure and heuristic by design: every flag is a concrete, checkable fact the
 * user can mention in their outreach email.
 */
export function auditWebsiteHtml(html: string, url: string): string[] {
  const flags: string[] = [];

  if (/^http:\/\//i.test(url.trim())) flags.push("no HTTPS (browser shows 'Not secure')");

  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    if (BUILDER_HOSTS.test(host)) flags.push(`hosted on a free builder / social page (${host.replace(/^www\./, "")})`);
  } catch {
    /* unparseable url — no host flag */
  }

  if (html && !/name=["']?viewport/i.test(html)) {
    flags.push("not mobile-friendly (no responsive viewport)");
  }

  if (/<frameset|<marquee|<blink|\.swf\b/i.test(html)) {
    flags.push("built with 2000s-era web technology");
  }

  const years = [...html.matchAll(/(?:©|&copy;|&#169;|copyright)[^\d]{0,20}(\d{4})/gi)]
    .map((m) => parseInt(m[1], 10))
    .filter((y) => y >= 1995 && y <= new Date().getFullYear());
  if (years.length) {
    const latest = Math.max(...years);
    if (latest <= new Date().getFullYear() - 3) {
      flags.push(`site last touched around ${latest} (copyright notice)`);
    }
  }

  if (html && html.length < 1800) flags.push("barely any content on the homepage");

  return flags;
}

// ---------- tech-stack & marketing-tag detection ----------

/** Platform fingerprints, checked in order — first match wins. */
const STACK_SIGNATURES: [string, RegExp][] = [
  ["WordPress", /wp-content\/|wp-includes\/|content=["']WordPress/i],
  ["Shopify", /cdn\.shopify\.com|\.myshopify\.com|Shopify\.theme/i],
  ["Wix", /wixstatic\.com|parastorage\.com|X-Wix-/i],
  ["Squarespace", /squarespace\.com|squarespace-cdn\.com/i],
  ["Webflow", /website-files\.com|data-wf-page/i],
  ["GoDaddy Builder", /wsimg\.com|websitebuilder\.godaddy/i],
  ["Weebly", /weebly\.com\/uploads|_weebly/i],
  ["Joomla", /content=["']Joomla/i],
  ["Drupal", /Drupal\.settings|content=["']Drupal/i],
  ["Blogger", /content=["']blogger["']/i],
];

const PIXEL_SIGNATURES: [string, RegExp][] = [
  ["Facebook Pixel", /connect\.facebook\.net|fbq\s*\(/i],
  ["Google Analytics", /googletagmanager\.com|google-analytics\.com|gtag\s*\(/i],
  ["Google Ads tag", /googleadservices\.com|googleads\.g\.doubleclick/i],
  ["TikTok Pixel", /analytics\.tiktok\.com/i],
];

export interface TechProfile {
  /** Detected platform, or undefined when unrecognized/custom. */
  stack?: string;
  /** Marketing/tracking tags present — a "this business invests in marketing" signal. */
  pixels: string[];
}

/** Reads what a site is built with and which marketing tags it runs — pure. */
export function detectTech(html: string): TechProfile {
  if (!html) return { pixels: [] };
  const stack = STACK_SIGNATURES.find(([, re]) => re.test(html))?.[0];
  const pixels = PIXEL_SIGNATURES.filter(([, re]) => re.test(html)).map(([name]) => name);
  return { stack, pixels };
}

// ---------- website enrichment ----------

async function fetchPageText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, 12_000, {
    headers: {
      Accept: "text/html",
      // Some sites (WAFs, WordPress security plugins) refuse UA-less requests
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    },
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

/**
 * Visits a lead's website to find email + socials, read its tech stack and
 * marketing tags, and (optionally) audit its quality. The homepage is always
 * fetched when a website exists — the tech profile applies to every lead.
 */
async function enrichLead(lead: Lead, audit = false): Promise<Lead> {
  if (!lead.website) return lead;
  const url = lead.website.startsWith("http") ? lead.website : `https://${lead.website}`;
  const siteHost = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return undefined;
    }
  })();

  const scan = (text: string) => {
    if (!lead.email) lead.email = extractEmails(text, siteHost)[0] ?? "";
    if (!lead.instagram) lead.instagram = extractInstagram(text);
    if (!lead.linkedin) lead.linkedin = extractLinkedin(text);
  };

  try {
    const html = await fetchPageText(url);
    if (audit) {
      lead.site_flags = auditWebsiteHtml(html, lead.website);
      // A listed website that doesn't load is the hottest redesign signal there is.
      if (!html) lead.site_flags.push("website doesn't load at all");
    }
    if (html) {
      const t = detectTech(html);
      lead.tech = t.stack;
      lead.pixels = t.pixels;
      scan(html);

      // No email on the homepage? Follow its contact link, or probe the
      // usual paths when the homepage doesn't link one.
      if (!lead.email) {
        const linkMatch = html.match(/href=["']([^"']*(?:contact|about)[^"']*)["']/i);
        const candidates = linkMatch
          ? [new URL(linkMatch[1], url).toString()]
          : [new URL("/contact", url).toString(), new URL("/contact-us", url).toString()];
        for (const candidate of candidates) {
          const pageHtml = await fetchPageText(candidate);
          if (pageHtml) scan(pageHtml);
          if (lead.email) break;
        }
      }
    }

    // Still no email — the site is likely JS-rendered or blocking plain
    // fetches. Let Jina Reader render it and scan the text instead.
    if (!lead.email) {
      const text = await fetchPageViaJina(url);
      if (text) scan(text);
    }
  } catch {
    // site unreachable/slow — keep whatever we already have
    if (audit) {
      lead.site_flags = [...(lead.site_flags ?? []), "website doesn't load at all"];
    }
  }
  return lead;
}

export async function enrichLeads(
  leads: Lead[],
  concurrency = 5,
  audit = false
): Promise<Lead[]> {
  const out: Lead[] = [...leads];
  for (let i = 0; i < out.length; i += concurrency) {
    const batch = out.slice(i, i + concurrency);
    const enriched = await Promise.all(batch.map((l) => enrichLead(l, audit)));
    for (let j = 0; j < enriched.length; j++) out[i + j] = enriched[j];
  }
  return out;
}
