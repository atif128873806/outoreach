/**
 * Lead Finder — discovers business leads by niche + location.
 *
 * Sources:
 *  - OpenStreetMap (Overpass API): free, no key, open data (ODbL).
 *  - The official UK register (Companies House), for companies with no site.
 *  - AI web search, via lib/exa.ts.
 *
 * No source includes email addresses, so leads with a website go through an
 * enrichment pass that reads the site — homepage first, then its contact and
 * about pages through the shared crawler in lib/crawl.ts — extracting emails,
 * phone numbers, socials, published business details and the owner's name. The
 * same visit produces a scored website audit (lib/siteaudit.ts) — the evidence
 * the user pitches with.
 */

import {
  analyzeSite,
  checkBrokenLinks,
  probeSite,
  type SiteAudit,
} from "./siteaudit";
import { contactPageUrls, crawlPage, rankContactUrls, sitemapUrls } from "./crawl";
import { nicheAlias } from "./niches";
import {
  detectTech,
  extractEmails,
  extractLocalBusiness,
  extractOwnerName,
  extractPhone,
  pagePhone,
  reconcilePhone,
} from "./scrape";

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
  /**
   * Named directors from an official register, when the source publishes them.
   *
   * For a lead with no website, no phone and no email, this is the only human
   * attached to the company — and it is a name from a public record rather than
   * a guess, which is what makes it worth searching for the person behind it.
   */
  directors?: string[];
  /**
   * The human attached to this lead, once one has been confirmed.
   *
   * A business is not reachable; a person is. When the source published
   * directors, the person finder looks for them by name and only accepts a
   * profile matching a name on the record, so this is a checked identity rather
   * than "whoever ranks for the company". `contact_profile` is their own
   * LinkedIn or X page, whichever network they were found on.
   */
  contact_name?: string;
  contact_profile?: string;
  /**
   * The register's own identity for this company, when it came from there:
   * the number (unique for ever) and the incorporation date. The number is what
   * lets a company be recognised as one already reported — the alternative is
   * comparing names, and "A B C Roofing Ltd" and "ABC Roofing Limited" are two
   * spellings of one business. It is also the id in a public register URL.
   */
  company_number?: string;
  incorporated_on?: string;
  source: string;
  /** Pitch-worthy website problems (critical/high only) — safe to quote to the prospect. */
  site_flags?: string[];
  /** Scored audit of the lead's homepage: grade, score, and every finding with its evidence. */
  site_audit?: SiteAudit;
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

export function extractInstagram(html: string): string {
  const matches = html.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})/g);
  for (const m of matches) {
    const handle = normalizeInstagram(m[1]);
    if (handle && !IG_JUNK.has(handle.toLowerCase())) return handle;
  }
  return "";
}

// ---------- geocoding (Nominatim) ----------

/**
 * The coordinates of a place, for comparing how far a lead is from the city the
 * user asked about. Cached, and spaced to Nominatim's 1 request/second policy
 * so a search with several unplaceable leads can't be rate-limited into
 * silence. Returns null rather than throwing: a lookup that fails leaves the
 * stricter locality verdict in place.
 */
let lastPointLookup = 0;
const pointCache = new Map<string, { lat: number; lon: number } | null>();

export async function geocodePoint(
  query: string
): Promise<{ lat: number; lon: number } | null> {
  const key = (query ?? "").trim().toLowerCase();
  if (!key) return null;
  const cached = pointCache.get(key);
  if (cached !== undefined) return cached;

  const wait = 1_100 - (Date.now() - lastPointLookup);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastPointLookup = Date.now();

  let point: { lat: number; lon: number } | null = null;
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(key)}`,
      10_000
    );
    if (res.ok) {
      const data = (await res.json()) as { lat?: string; lon?: string }[];
      const hit = data[0];
      const lat = parseFloat(hit?.lat ?? "");
      const lon = parseFloat(hit?.lon ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lon)) point = { lat, lon };
    }
  } catch {
    point = null;
  }
  pointCache.set(key, point);
  return point;
}

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

  // "Dental Clinics" → matches tag values like "dentist"/"dental_clinic". The
  // vocabulary itself lives in lib/niches.ts, where it is unit-tested — a niche
  // that silently maps to no tag looks like an empty city, not a bug.
  const lower = niche.trim().toLowerCase();
  const alias = nicheAlias(niche);
  const base = escapeRegex(lower.replace(/s$/, ""));
  const tagRegex = alias?.re ?? base.replace(/\s+/g, "[_ ]?");
  const bb = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;

  // Known niches hit only their real tag keys with exact-case values (OSM tag
  // values are lowercase) — far cheaper than 8 case-insensitive regex scans.
  // A trade alias goes further and matches the tag value whole, so
  // craft=car_painter is not returned for "painters" (see lib/niches.ts).
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

// Google Places used to live here (searchGooglePlaces, the Places API "New"
// text search, keyed per customer). It was removed with the rest of the
// user-keyed path; lib/sources/meta.ts records why and what re-adding it takes.

// Website auditing lives in lib/siteaudit.ts: probeSite records the network
// facts (status, timing, size, TLS) and analyzeSite turns them into scored,
// quotable findings the UI and the outreach notes are built on.

// ---------- website enrichment ----------

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
 * Visits a lead's website: audits the homepage, reads its tech stack and
 * marketing tags, and hunts for contact details across the site's own pages. The audit runs for every lead
 * with a website — in this product the audit is the deliverable, not a side
 * effect — while `deep` adds the homepage broken-link check (a few extra
 * requests, so it's reserved for the deliberate "outdated website" search).
 */
async function enrichLead(lead: Lead, deep = false, uk = false): Promise<Lead> {
  if (!lead.website) return lead;
  const url = lead.website.startsWith("http") ? lead.website : `https://${lead.website}`;
  const siteHost = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return undefined;
    }
  })();

  const addNote = (bit: string) => {
    if (!bit || (lead.notes ?? "").includes(bit)) return;
    lead.notes = [lead.notes, bit].filter(Boolean).join(" | ");
  };

  /**
   * Reads one page for everything it can contribute to the lead. Phone numbers
   * come through the page's `tel:` links and its visible words, never its raw
   * markup: an inline SVG's coordinates are not a phone number (see
   * lib/scrape.ts, pagePhone).
   */
  const scan = (text: string, opts: { html?: boolean } = {}) => {
    if (!lead.email) lead.email = extractEmails(text, siteHost)[0] ?? "";
    if (!lead.instagram) lead.instagram = extractInstagram(text);
    if (!lead.linkedin) lead.linkedin = extractLinkedin(text);
    const phone = opts.html ? pagePhone(text, { uk }) : extractPhone(text, { uk });
    lead.phone = reconcilePhone(lead.phone, phone, { uk });
  };

  /**
   * What the page publishes about itself in structured data, which outranks
   * anything scraped from footer markup: the owner typed it for Google.
   */
  const applyStructured = (html: string) => {
    const business = extractLocalBusiness(html);
    if (business.phone) {
      const phone = extractPhone(business.phone, { uk });
      if (phone) lead.phone = reconcilePhone(lead.phone, phone, { uk });
    }
    if (!lead.email && business.email) lead.email = business.email;
    if (!lead.address && business.address) lead.address = business.address;
    if (!lead.instagram) {
      const insta = business.socials.find((s) => /instagram\.com/i.test(s));
      if (insta) lead.instagram = extractInstagram(insta);
    }
    if (!lead.linkedin) {
      const li = business.socials.find((s) => /linkedin\.com/i.test(s));
      if (li) lead.linkedin = extractLinkedin(li);
    }
  };

  try {
    const probe = await probeSite(url);
    const html = probe.html;

    const tech = detectTech(html);
    lead.tech = tech.stack;
    lead.pixels = tech.pixels;

    // Link checking costs extra requests, so it stays opt-in per search.
    const linkCheck = deep && html ? await checkBrokenLinks(probe.finalUrl, html) : null;
    const audit = analyzeSite(probe, {
      stack: tech.stack,
      pixels: tech.pixels,
      brokenLinks: linkCheck?.links ?? [],
      brokenLinksTruncated: linkCheck?.truncated,
    });
    lead.site_audit = audit;
    lead.site_flags = audit.flags;

    if (html) {
      scan(html, { html: true });
      applyStructured(html);

      // A business keeps its phone number, its email and the owner's name on
      // its contact, about or team page, almost never on the homepage. Read
      // those pages through the shared crawler: robots.txt is respected, one
      // request a second per host, and the site's own sitemap decides which
      // pages are worth reading instead of guessing at /contact-us.
      await crawlForContact(url, html, {
        take: (pageHtml) => {
          scan(pageHtml, { html: true });
          applyStructured(pageHtml);
          const owner = extractOwnerName(pageHtml);
          if (owner) addNote(`Site names ${owner.name} as ${owner.role}`);
        },
        // An email is the reason to read more pages; a phone found along the
        // way is a bonus, not a reason to keep costing the host requests.
        satisfied: () => Boolean(lead.email),
      });
    }

    // Still no email — the site is likely JS-rendered or blocking plain
    // fetches. Let Jina Reader render it and scan the text instead.
    if (!lead.email) {
      const text = await fetchPageViaJina(url);
      if (text) scan(text);
    }
  } catch {
    // probeSite never throws, so this only guards odd markup/URL edge cases —
    // keep whatever we already have rather than failing the whole lead.
  }
  return lead;
}

export async function enrichLeads(
  leads: Lead[],
  concurrency = 5,
  deep = false,
  opts: { uk?: boolean } = {}
): Promise<Lead[]> {
  const out: Lead[] = [...leads];
  for (let i = 0; i < out.length; i += concurrency) {
    const batch = out.slice(i, i + concurrency);
    const enriched = await Promise.all(batch.map((l) => enrichLead(l, deep, opts.uk ?? false)));
    for (let j = 0; j < enriched.length; j++) out[i + j] = enriched[j];
  }
  return out;
}

/** How many extra pages one lead's contact hunt may cost a host. */
const CONTACT_PAGES = 3;

/**
 * Reads the pages a site keeps its contact details on, cheapest first.
 *
 * Order matters because every page costs the host a request and the search a
 * second: the page the site itself links as its contact page is tried first and
 * usually ends the hunt. Only when that fails is the sitemap fetched, and only
 * for the pages worth adding on top. `satisfied` is checked between pages, so a
 * lead that already yielded an email stops costing anyone anything.
 */
async function crawlForContact(
  url: string,
  homeHtml: string,
  opts: { take: (html: string) => void; satisfied: () => boolean }
): Promise<void> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  const tried = new Set<string>();
  let fetched = 0;

  const visit = async (target: string): Promise<void> => {
    if (fetched >= CONTACT_PAGES || opts.satisfied() || tried.has(target)) return;
    tried.add(target);
    fetched++;
    const page = await crawlPage(target);
    // crawlPage returns null when robots.txt refuses the path or nothing came
    // back; a 4xx/5xx body is not page content either.
    if (page && page.status < 400 && page.html) opts.take(page.html);
  };

  for (const target of contactPageUrls(homeHtml, url, 2)) await visit(target);
  if (opts.satisfied()) return;

  const published = await sitemapUrls(origin, 60).catch(() => [] as string[]);
  for (const target of rankContactUrls(published, url, CONTACT_PAGES)) await visit(target);
}
