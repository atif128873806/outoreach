/**
 * One polite crawler, shared by every lead source and by the enrichment pass.
 *
 * Two rules drive the design:
 *
 *  1. Ask permission once per host. robots.txt is fetched, parsed and cached;
 *     a path it disallows is never requested, and a host whose robots.txt
 *     answers with a server error is left alone rather than hammered.
 *  2. Never be the reason a site falls over. Requests are serialized per host
 *     and spaced by at least a second — or the host's own Crawl-delay when it
 *     asks for more — so a 50-lead search walking 50 websites behaves like a
 *     person with a browser, not like a scraper.
 *
 * Deliberately dependency-free: the parsing and the ranking are the parts worth
 * testing, and `node --test` can import this file directly. The audit probe
 * (lib/siteaudit.ts) intentionally does NOT come through here: it makes a
 * single request that mimics one page load by a visitor, which is what its
 * findings describe. Anything that fetches *several* pages of a site does.
 */

/** The identity every request carries. Kept in step with lib/leads.ts. */
export const CRAWLER_UA = "OutreachStudio/1.0 (local lead finder)";

/** Never fetch faster than this to one host, whatever its robots.txt says. */
export const MIN_INTERVAL_MS = 1_000;
/** How long a parsed robots.txt is trusted before it is fetched again. */
const ROBOTS_TTL_MS = 30 * 60 * 1000;
/** Markup this crawler will read from one page. */
export const PAGE_MAX_BYTES = 400_000;
/** Nested sitemaps followed from one index, so a huge site can't run away. */
const MAX_SITEMAPS = 5;

// ---------- robots.txt ----------

export interface RobotsRules {
  allow: string[];
  disallow: string[];
  /** The host's own request for spacing, already floored at MIN_INTERVAL_MS. */
  crawlDelayMs: number;
}

/**
 * The subset of robots.txt that matters to a crawler that only reads pages:
 * which agent group applies to us, and its Allow/Disallow/Crawl-delay lines.
 *
 * Group selection follows the usual convention — the most specific matching
 * user-agent token wins, `*` is the fallback — and an empty group says nothing,
 * so unknown hosts stay fetchable.
 */
export function parseRobots(text: string, userAgent = CRAWLER_UA): RobotsRules {
  const lines = (text ?? "").split(/\r?\n/);
  const groups: { agents: string[]; allow: string[]; disallow: string[]; delay?: number }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastKey = "";

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      // A new User-agent line after rules starts a new group.
      if (lastKey !== "user-agent" || !current) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current) {
      if (key === "allow" && value) current.allow.push(value);
      else if (key === "disallow" && value) current.disallow.push(value);
      else if (key === "crawl-delay") {
        const secs = Number(value);
        if (Number.isFinite(secs) && secs >= 0) current.delay = secs * 1000;
      }
    }
    lastKey = key;
  }

  const ua = userAgent.toLowerCase();
  const specific = groups
    .filter((g) => g.agents.some((a) => a !== "*" && a.length > 1 && ua.includes(a)))
    .sort((a, b) => {
      const len = (g: (typeof groups)[number]) =>
        Math.max(...g.agents.filter((a) => a !== "*").map((a) => a.length), 0);
      return len(b) - len(a);
    })[0];
  const chosen = specific ?? groups.find((g) => g.agents.includes("*"));
  if (!chosen) return { allow: [], disallow: [], crawlDelayMs: MIN_INTERVAL_MS };

  return {
    allow: chosen.allow,
    disallow: chosen.disallow,
    crawlDelayMs: Math.max(chosen.delay ?? 0, MIN_INTERVAL_MS),
  };
}

/** Does a path match a robots pattern? `*` is a wildcard, `$` anchors the end. */
function matchesPattern(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const rx = new RegExp(
    `^${body.replace(/[.+^${}()|[\]\\?]/g, "\\$&").replace(/\*/g, ".*")}${anchored ? "$" : ""}`
  );
  return rx.test(path);
}

/**
 * May we fetch this path? Default yes; the longest matching rule wins, and a
 * tie goes to Allow — the convention every real crawler follows, so a site
 * that carefully allows a path inside a disallowed tree is respected.
 */
export function robotsAllows(rules: RobotsRules, path: string): boolean {
  const target = path || "/";
  let best: { pattern: string; allowed: boolean } | null = null;
  const consider = (pattern: string, allowed: boolean) => {
    if (!matchesPattern(pattern, target)) return;
    if (!best || pattern.length > best.pattern.length) best = { pattern, allowed };
  };
  for (const p of rules.disallow) consider(p, false);
  for (const p of rules.allow) consider(p, true);
  return best ? (best as { allowed: boolean }).allowed : true;
}

// ---------- pacing ----------

/**
 * How long to wait before the next request to a host. Exported for the test
 * that keeps the politeness honest: a crawler that stops spacing its requests
 * is a scraper, however it describes itself.
 */
export function pacingWait(lastAt: number, now: number, minIntervalMs = MIN_INTERVAL_MS): number {
  if (!lastAt) return 0;
  const elapsed = now - lastAt;
  return elapsed >= minIntervalMs ? 0 : minIntervalMs - elapsed;
}

interface RobotsEntry {
  at: number;
  rules: RobotsRules;
  /** The host asked us not to crawl at all (robots.txt errored). */
  blocked: boolean;
  /** How long this verdict may be trusted before it is fetched again. */
  ttlMs: number;
}

/**
 * A verdict reached because the host was unreachable is not a permanent fact —
 * a timeout during someone's outage should not blacklist them for half an hour.
 * Failures are remembered briefly, just long enough to stop retrying in a loop.
 */
const FAILED_ROBOTS_TTL_MS = 60 * 1000;

const robotsCache = new Map<string, RobotsEntry>();
const lastHitAt = new Map<string, number>();
const hostLanes = new Map<string, Promise<unknown>>();

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * One request, spaced and serialized per host.
 *
 * Returns null instead of throwing: every caller here treats a failed fetch as
 * "no data", and a crawler that dies on the first 404 is useless.
 */
export async function politeFetch(
  url: string,
  opts: { timeoutMs?: number; accept?: string } = {}
): Promise<Response | null> {
  const origin = originOf(url);
  if (!origin) return null;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  const previous = hostLanes.get(origin) ?? Promise.resolve();
  const run = previous
    .catch(() => {})
    .then(async () => {
      const entry = await robotsFor(origin);
      const wait = pacingWait(lastHitAt.get(origin) ?? 0, Date.now(), entry.rules.crawlDelayMs);
      if (wait > 0) await sleep(wait);
      lastHitAt.set(origin, Date.now());
      return fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": CRAWLER_UA,
          Accept: opts.accept ?? "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    });

  hostLanes.set(origin, run.catch(() => {}));
  try {
    return await run;
  } catch {
    return null;
  }
}

async function robotsFor(origin: string): Promise<RobotsEntry> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.at < cached.ttlMs) return cached;

  let entry: RobotsEntry;
  // This fetch must never throw. The businesses this product hunts are the ones
  // with broken sites — expired certificates, dead DNS — and a crawler that
  // dies on the first unreachable host would take a whole search down with it.
  const res = await fetch(`${origin}/robots.txt`, {
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": CRAWLER_UA, Accept: "text/plain" },
  }).catch(() => null);
  if (!res) {
    // No rules obtainable. Treat it like a host that cannot serve them: leave
    // it alone rather than walking it without permission.
    entry = { at: Date.now(), rules: parseRobots(""), blocked: true, ttlMs: FAILED_ROBOTS_TTL_MS };
  } else if (res.status >= 500) {
    // A host that cannot even serve its rules is not a host to walk. Better to
    // skip it than to guess.
    entry = { at: Date.now(), rules: parseRobots(""), blocked: true, ttlMs: FAILED_ROBOTS_TTL_MS };
  } else if (!res.ok) {
    // 404 means "no rules", which every convention reads as permission.
    entry = { at: Date.now(), rules: parseRobots(""), blocked: false, ttlMs: ROBOTS_TTL_MS };
  } else {
    entry = { at: Date.now(), rules: parseRobots(await res.text()), blocked: false, ttlMs: ROBOTS_TTL_MS };
  }
  robotsCache.set(origin, entry);
  return entry;
}

export interface CrawlVerdict {
  allowed: boolean;
  /** Why not, phrased for a log line. */
  reason?: string;
}

/** May we fetch this URL at all, per the host's robots.txt? */
export async function crawlVerdict(url: string): Promise<CrawlVerdict> {
  const origin = originOf(url);
  if (!origin) return { allowed: false, reason: "unreadable url" };
  const entry = await robotsFor(origin);
  if (entry.blocked) return { allowed: false, reason: "robots.txt unavailable — host skipped" };
  let path = "/";
  try {
    path = new URL(url).pathname || "/";
  } catch {
    return { allowed: false, reason: "unreadable url" };
  }
  return robotsAllows(entry.rules, path)
    ? { allowed: true }
    : { allowed: false, reason: `disallowed by robots.txt (${path})` };
}

/** For tests and diagnostics: the rules a host is currently judged by. */
export async function rulesForHost(origin: string): Promise<RobotsRules> {
  return (await robotsFor(origin)).rules;
}

// ---------- reading pages ----------

export interface CrawledPage {
  url: string;
  status: number;
  html: string;
  bytes: number;
}

/** Fetches one page, if robots.txt allows it, and only if it is markup. */
export async function crawlPage(url: string): Promise<CrawledPage | null> {
  const verdict = await crawlVerdict(url);
  if (!verdict.allowed) return null;
  const res = await politeFetch(url);
  if (!res) return null;
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.includes("text/html")) return null;
  const raw = await res.text();
  return {
    url: res.url || url,
    status: res.status,
    bytes: raw.length,
    html: raw.slice(0, PAGE_MAX_BYTES),
  };
}

// ---------- sitemaps ----------

/**
 * The `<loc>` entries in a sitemap or sitemap index. Handles CDATA and
 * entity-escaped `&amp;`, which real sitemaps are full of.
 */
export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...(xml ?? "").matchAll(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/gi)]
    .map((m) => m[1].trim().replace(/&amp;/g, "&"))
    .filter(Boolean);
  const isIndex = /<sitemapindex/i.test(xml ?? "");
  return isIndex ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}

/**
 * Page URLs a site publishes about itself. A sitemap is the site telling you
 * what it has, so this is both more complete and more polite than guessing at
 * conventional paths — the contact page of a WordPress site is rarely
 * `/contact`, and asking for the wrong one costs the host a request.
 */
export async function sitemapUrls(origin: string, limit = 50): Promise<string[]> {
  const roots = new Set<string>([`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]);
  // A declared Sitemap: line in robots.txt is the host pointing at the real one.
  const declared = await declaredSitemaps(origin);
  for (const d of declared) roots.add(d);

  const found: string[] = [];
  const seen = new Set<string>();
  let fetched = 0;

  const take = async (url: string) => {
    if (fetched >= MAX_SITEMAPS || found.length >= limit) return;
    fetched++;
    const page = await crawlPageXml(url);
    if (!page) return;
    const parsed = parseSitemap(page);
    for (const u of parsed.urls) {
      if (found.length >= limit) return;
      if (!seen.has(u)) {
        seen.add(u);
        found.push(u);
      }
    }
    for (const nested of parsed.sitemaps.slice(0, MAX_SITEMAPS - fetched)) await take(nested);
  };

  for (const root of roots) {
    if (found.length >= limit) break;
    await take(root);
  }
  return found;
}

async function crawlPageXml(url: string): Promise<string | null> {
  const verdict = await crawlVerdict(url);
  if (!verdict.allowed) return null;
  const res = await politeFetch(url, { accept: "application/xml,text/xml,*/*" });
  if (!res || !res.ok) return null;
  const body = await res.text();
  return body.slice(0, PAGE_MAX_BYTES);
}

async function declaredSitemaps(origin: string): Promise<string[]> {
  const res = await fetch(`${origin}/robots.txt`, {
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": CRAWLER_UA, Accept: "text/plain" },
  }).catch(() => null);
  if (!res || !res.ok) return [];
  const text = await res.text().catch(() => "");
  return [...text.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)].map((m) => m[1]);
}

// ---------- picking the pages worth reading ----------

/**
 * Internal links most likely to carry a phone number, an email or a name,
 * best first. Pure and ranked, because the order is the policy.
 *
 * Two rules make it predictable:
 *
 *  - Only shallow pages count. A site keeps its contact details at the top
 *    (/contact, /about-us, /our-team, or one level under a locale), so a post
 *    that merely says "contact" three directories down is not the contact
 *    page — excluding it by depth beats trying to weight the two against each
 *    other, and it means fewer, more targeted requests to the host.
 *  - Within that, the meaning wins: contact beats about and team, which beat
 *    services, and ties keep the order the site itself chose.
 */
const SKIP_FILE = /\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|pdf|zip|mp4|webm)(\?|$)/i;

/**
 * How promising one internal URL is as a page carrying contact details, or
 * null when it is not a candidate at all. The tiers encode the policy: a
 * contact page beats about/team, which beats services, and a shallow page beats
 * the same word buried in a blog path.
 */
function candidateScore(
  url: URL,
  base: string,
  order: number
): { tier: number; depth: number; order: number } | null {
  if (url.origin !== base) return null;
  if (SKIP_FILE.test(url.pathname)) return null;
  const depth = url.pathname.split("/").filter(Boolean).length;
  if (depth === 0 || depth > 2) return null;
  const label = (url.pathname + url.search).toLowerCase().replace(/[^a-z]+/g, " ").trim();
  let tier = 0;
  if (/\bcontact\b|get in touch|enquir|enquiry|quote/.test(label)) tier = 3;
  else if (/\babout\b|who we are|company/.test(label)) tier = 2;
  else if (/\bteam\b|our people|meet the|staff|directors/.test(label)) tier = 2;
  else if (/\bservices\b|what we do/.test(label)) tier = 1;
  return tier ? { tier, depth, order } : null;
}

function rankCandidates(
  seen: Map<string, { tier: number; depth: number; order: number }>,
  limit: number
): string[] {
  return [...seen.entries()]
    .sort((a, b) => b[1].tier - a[1].tier || a[1].depth - b[1].depth || a[1].order - b[1].order)
    .slice(0, limit)
    .map(([url]) => url);
}

export function contactPageUrls(html: string, baseUrl: string, limit = 3): string[] {
  const base = originOf(baseUrl);
  const seen = new Map<string, { tier: number; depth: number; order: number }>();
  let order = 0;

  for (const m of (html ?? "").matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)) {
    const href = m[1].trim();
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    const score = candidateScore(url, base, order);
    if (!score) continue;
    const key = url.toString();
    const existing = seen.get(key);
    if (!existing || existing.tier < score.tier) {
      seen.set(key, { ...score, order: existing?.order ?? order++ });
    }
  }

  return rankCandidates(seen, limit);
}

/**
 * The same policy applied to a list of URLs the site published itself — its
 * sitemap. A sitemap is the honest inventory of a site, so ranking it beats
 * guessing at conventional paths, and the pages it names are the ones the owner
 * actually maintains.
 */
export function rankContactUrls(urls: string[], baseUrl: string, limit = 3): string[] {
  const base = originOf(baseUrl);
  const seen = new Map<string, { tier: number; depth: number; order: number }>();
  let order = 0;

  for (const raw of urls ?? []) {
    let url: URL;
    try {
      url = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    const score = candidateScore(url, base, order);
    if (!score) continue;
    const key = url.toString();
    const existing = seen.get(key);
    if (!existing || existing.tier < score.tier) {
      seen.set(key, { ...score, order: existing?.order ?? order++ });
    }
  }

  return rankCandidates(seen, limit);
}
