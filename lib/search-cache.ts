/**
 * Search cache + search activity log.
 *
 * Two different jobs live here, and keeping them apart is the design:
 *
 *  - **`search_cache` is the payload store.** Mutable, evictable, shared by
 *    every account. Its job is to stop us re-fetching what a source already
 *    told us. That is three things at once: the latency fix (a repeat search
 *    answers in milliseconds instead of a minute), the quota fix (every source
 *    here has a deployment-wide budget — Overpass mirrors, the register's 600
 *    requests per 5 minutes, Exa's daily keyless allowance), and a licence
 *    obligation, since Nominatim's usage policy requires results to be cached
 *    rather than re-queried. It is only ever an optimization: nothing the user
 *    sees is computed *from* the cache rather than from a live audit.
 *
 *  - **`search_events` is the activity log.** One append-only row per search
 *    attempt — never updated, never evicted. Its job is to answer questions the
 *    product could not answer at all before: what is being searched for, where
 *    do businesses come back empty, and where do people stop. That is the
 *    "metadata doubles as analytics" half of the advisory session, and it is a
 *    separate table from the cache on purpose: if the log were a column on the
 *    cache row, expiring an entry would erase the history of everyone who ever
 *    searched it — and that history is the thing worth keeping.
 *
 * Nothing in this module may break a search. Every database call is
 * best-effort: a cache that throws is worse than no cache, so a failure falls
 * through to the live path and is reported on stderr rather than to the user.
 *
 * Why not Redis: the deployment is a single Node process on one VPS (see
 * ROADMAP.md), which is exactly the case where a cache server buys nothing —
 * its value is sharing state *across* processes. The cache also has to be
 * durable and queryable (a "last updated" timestamp the UI shows is data, not
 * a cache, and the analytics half needs SQL to group by), and it has to survive
 * on a nightly `pg_dump` like everything else. See UK-PIVOT-STUDY.md §14.
 */

import { AsyncLocalStorage } from "node:async_hooks";

// This module deliberately imports nothing of ours: the test runner loads pure
// modules directly with Node's type stripping, which does not resolve
// extensionless relative imports, and the repo's rule is that a module under
// test stays dependency-free. The browser-side freshness *wording* lives in
// lib/freshness.ts, which is dependency-free for the same reason.

/** What kind of thing is being cached — decides the TTL below. */
export type CacheKind = "source" | "site" | "geo" | "contact";

/**
 * How long each kind of fact stays usable, in seconds.
 *
 * These are deliberately different, because the underlying facts change at
 * completely different speeds:
 *
 *  - **geo** — a city's coordinates do not move. Longest TTL by far.
 *  - **source** — directory-style records (OpenStreetMap, the register) change
 *    slowly; a business's name, address and website are stable for months.
 *    Overridden per source by `sourceTtl()`.
 *  - **contact** — a business's public footprint (Instagram, phone) changes on
 *    the order of months.
 *  - **site** — shortest, and the one that matters most. Company facts are
 *    slow, but *whether a website is broken* changes week to week, and a stale
 *    audit is the one thing this product must never quote at a prospect. A week
 *    is the compromise: still a large saving on the most expensive step (the
 *    probe, the crawl and the audit), short enough that "we checked recently"
 *    stays true.
 */
export const CACHE_TTL_SECONDS: Record<CacheKind, number> = {
  geo: 180 * 86400,
  source: 14 * 86400,
  contact: 30 * 86400,
  site: 7 * 86400,
};

/**
 * The register publishes newly incorporated companies every working day, so a
 * month-old answer there is a worse answer than a week-old one. OpenStreetMap
 * is the opposite: it is community-maintained and moves slowly, and re-asking
 * it should be rare — the Overpass mirrors are the flakiest dependency we have.
 */
export function sourceTtl(source: string): number {
  if (source === "companies_house") return 7 * 86400;
  if (source === "osm") return 30 * 86400;
  return CACHE_TTL_SECONDS.source;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * One spelling per search term, so "Roofers, Leeds" and "roofers  leeds" are
 * one cache entry rather than two. Case, surrounding whitespace and runs of
 * whitespace are the variations people actually type; accents and punctuation
 * are left alone, because a place called "St. John's" is not "st johns".
 */
export function normalizeTerm(value: string): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Location separators have one spelling; meaningful place punctuation stays intact. */
export function normalizeLocation(value: string): string {
  return normalizeTerm(value).replace(/\s*,\s*/g, ", ").trim();
}

/**
 * Rounds a wanted-count up to a step, so neighbouring searches share an entry.
 *
 * A user who asks for 10 leads and one who asks for 12 put the same question to
 * Overpass and should not pay for it twice. Exact counts would make every user
 * a separate cache entry; this makes the count part of the key at a granularity
 * where the difference is not worth another fetch.
 */
export function countBucket(count: number, step = 25): number {
  const n = Math.max(1, Math.floor(count));
  return Math.ceil(n / step) * step;
}

export function sourceKey(source: string, niche: string, location: string, needed: number): string {
  return `src|${source}|${normalizeTerm(niche)}|${normalizeLocation(location)}|${countBucket(needed)}`;
}

/**
 * A site's facts are keyed by its address, not by the search that found it.
 *
 * This is the highest-leverage key in the cache: the same business is found by
 * a different niche, a different city's neighbouring search, or a different
 * account, and every one of those would otherwise re-probe and re-audit the
 * same site. `deep` (the broken-link sweep) and `uk` (the trunk-0 phone rule)
 * change what we record, so they belong in the key. Preserve all URL parts
 * that can change the response; only fragments are excluded.
 */
export function siteKey(url: string, opts: { deep: boolean; uk: boolean }): string {
  let identity = (url ?? "").trim();
  try {
    const parsed = new URL(/^https?:\/\//i.test(identity) ? identity : `https://${identity}`);
    // URL normalizes host/default ports but preserves case-sensitive paths.
    // Keep query parameters: they can select a different page, not just track it.
    parsed.hash = "";
    identity = parsed.href;
  } catch {
    identity = identity.split("#")[0];
  }
  // Versioned so earlier colliding keys can never supply the wrong audit.
  return `site:v2|${identity}|${opts.deep ? "deep" : "quick"}|${opts.uk ? "uk" : "intl"}`;
}

export function geoKey(query: string): string {
  return `geo|${normalizeLocation(query)}`;
}

/** The market is part of the key: the same name in another country is another business. */
export function contactKey(businessName: string, location: string, country?: string | null): string {
  return `contact|${normalizeTerm(businessName)}|${normalizeLocation(location)}|${country ?? "any"}`;
}

// ---------------------------------------------------------------------------
// Freshness — the server's own view of it
// ---------------------------------------------------------------------------

/**
 * Parses whatever the driver handed back into epoch milliseconds.
 *
 * Mirrors `asEpochMs` in lib/freshness.ts, which is the browser-safe copy. The
 * two exist separately because neither module may import the other: this one
 * carries `node:async_hooks`, and the UI cannot. What must never diverge is the
 * *wording* the user reads, and that lives in exactly one place (freshness.ts).
 */
function toMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Whether a cached row is still usable. An unreadable timestamp counts as
 * expired — a value whose age cannot be established cannot claim to be current,
 * and going back to the source is always a correct answer.
 */
export function isFresh(refreshedAt: unknown, ttlSeconds: number, now = Date.now()): boolean {
  const at = toMs(refreshedAt);
  if (at <= 0) return false;
  return now - at < ttlSeconds * 1000;
}

// ---------------------------------------------------------------------------
// In-process layer (the hot path)
// ---------------------------------------------------------------------------

/**
 * A tiny LRU in front of the database.
 *
 * Two users running the same search seconds apart, or one user pressing the
 * button twice, should not each cost a database round trip and a
 * JSON.parse of a few hundred kilobytes. Short TTL because durability is the
 * database's job — this layer only has to survive the burst.
 */
const MEMORY_MAX = 250;
const MEMORY_TTL_MS = 60_000;

interface MemoryEntry {
  /** When this process stored it — decides the LRU's own 60-second life. */
  at: number;
  /**
   * When the data was fetched from its source.
   *
   * Kept separately from `at` because they are different questions, and the
   * difference is the whole point of an honest audit: a value read back from
   * disk two seconds ago was still *fetched* three days ago, and a UI that says
   * "checked just now" about it would be lying to the person who is about to
   * quote it at a prospect.
   */
  fetchedAt: number;
  value: unknown;
}

const globalForSearchCache = globalThis as unknown as {
  __outreachSearchCache?: Map<string, MemoryEntry>;
  __outreachCacheFlights?: Map<string, Promise<CacheResult<unknown>>>;
};

const memoryCache = (globalForSearchCache.__outreachSearchCache ??= new Map());
const flights = (globalForSearchCache.__outreachCacheFlights ??= new Map());

function memoryEntry(key: string, now: number): MemoryEntry | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (now - entry.at > MEMORY_TTL_MS) {
    memoryCache.delete(key);
    return undefined;
  }
  // Refresh recency: Map preserves insertion order, so delete + set is the LRU
  // touch — the oldest untouched key is then the one at the front.
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry;
}

function memorySet(key: string, entry: MemoryEntry): void {
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  // Map iteration order is insertion order, so the first keys are the least
  // recently used ones.
  while (memoryCache.size > MEMORY_MAX) {
    const oldest = memoryCache.keys().next();
    if (oldest.done) break;
    memoryCache.delete(oldest.value);
  }
}

/** Clears the in-process layer. For tests and for `resetSearchCache`. */
export function clearMemoryCache(): void {
  memoryCache.clear();
}

// ---------------------------------------------------------------------------
// Tracing what a search actually did
// ---------------------------------------------------------------------------

/**
 * Per-search counters for the activity log (how many cache hits it earned).
 *
 * These are collected through `AsyncLocalStorage` rather than threaded through
 * function signatures, because the cache is consulted deep inside the source
 * registry and the site reader — passing a counter down through every one of
 * those calls would put bookkeeping parameters on functions that have no
 * business knowing about it. Node runs each request in its own async context,
 * so two searches in flight at once keep their own counts.
 */
export interface SearchTrace {
  hits: number;
  misses: number;
}

const traceStore = new AsyncLocalStorage<SearchTrace>();

/**
 * Runs `fn` with fresh counters, handing it the (live) counter object so the
 * same numbers can be written to the activity log, and returning them too.
 */
export async function withSearchTrace<T>(
  fn: (trace: SearchTrace) => Promise<T>
): Promise<{ value: T; trace: SearchTrace }> {
  const trace: SearchTrace = { hits: 0, misses: 0 };
  const value = await traceStore.run(trace, () => fn(trace));
  return { value, trace };
}

// ---------------------------------------------------------------------------
// The cache itself
// ---------------------------------------------------------------------------

export interface CachedOptions<T> {
  key: string;
  kind: CacheKind;
  ttlSeconds: number;
  /**
   * Is a cached value good enough for this call? A source answer fetched for a
   * 25-lead search cannot satisfy one asking for 100, and it is not "stale" —
   * it is simply too small. When this returns false the entry is re-produced
   * and overwritten rather than replaced by a second row.
   */
  usable?: (value: T) => boolean;
}

interface CacheRow {
  payload: string;
  refreshed_at: string | Date;
}

/**
 * Reads a cached row whatever its age, without counting a hit or refreshing it.
 *
 * This exists for the re-check: to report honestly on what it replaced, it has to
 * look at the *old* value — including one so old the cache would no longer serve
 * it — before overwriting it.
 */
export async function peekCached<T>(
  key: string
): Promise<{ value: T; fetchedAt: number } | null> {
  try {
    const { q1 } = await import("./db");
    const row = await q1<CacheRow>(
      "SELECT payload, refreshed_at FROM search_cache WHERE cache_key = $1",
      [key]
    );
    if (!row) return null;
    return { value: JSON.parse(row.payload) as T, fetchedAt: toMs(row.refreshed_at) };
  } catch (err) {
    console.error("[search-cache] peek failed:", err);
    return null;
  }
}

async function readRow<T>(
  key: string,
  ttlSeconds: number
): Promise<{ value: T; fetchedAt: number } | null> {
  try {
    const { q1 } = await import("./db");
    const row = await q1<CacheRow>(
      "SELECT payload, refreshed_at FROM search_cache WHERE cache_key = $1",
      [key]
    );
    if (!row || !isFresh(row.refreshed_at, ttlSeconds)) return null;
    const parsed = JSON.parse(row.payload) as T;
    // The hit counter is bookkeeping, not part of the answer: it must never
    // delay the search it is counting.
    void q1("UPDATE search_cache SET hits = hits + 1, last_hit_at = now() WHERE cache_key = $1", [
      key,
    ]).catch(() => {});
    return { value: parsed, fetchedAt: toMs(row.refreshed_at) || Date.now() };
  } catch (err) {
    console.error("[search-cache] read failed:", err);
    return null;
  }
}

async function writeRow(key: string, kind: CacheKind, value: unknown): Promise<void> {
  try {
    const { q } = await import("./db");
    await q(
      `INSERT INTO search_cache (cache_key, kind, payload, refreshed_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (cache_key) DO UPDATE SET
         kind = EXCLUDED.kind,
         payload = EXCLUDED.payload,
         refreshed_at = EXCLUDED.refreshed_at`,
      [key, kind, JSON.stringify(value)]
    );
  } catch (err) {
    console.error("[search-cache] write failed:", err);
  }
}

/**
 * Reads through both layers, and on a miss runs `produce` once and stores what
 * it returned.
 *
 * A `null`/`undefined` result is never cached: those mean "the fetch failed",
 * and caching a failure would turn one bad minute at Overpass into a week of
 * empty searches. An empty *array* is a different thing and is cached — "there
 * are no roofers in this village" is an answer, and it is one the source should
 * not be asked for again on every visit.
 */
export interface CacheResult<T> {
  value: T;
  /** When the data was actually fetched from its source (epoch ms). */
  fetchedAt: number;
  /** True when this came back from a cache rather than from the source. */
  reused: boolean;
  /** How old the reused data already is, in seconds (0 for a fresh fetch). */
  ageSeconds: number;
}

/**
 * `cached`, but also reporting what the caller is getting: reused or fetched
 * now, and how old it already is. The audit UI needs exactly this — a score
 * without its date is a claim the user cannot check (§15.3 of the study).
 */
export async function cachedWithMeta<T>(
  opts: CachedOptions<T>,
  produce: () => Promise<T>
): Promise<CacheResult<T>> {
  const trace = traceStore.getStore();
  const reuse = (value: T, fetchedAt: number): CacheResult<T> => ({
    value, fetchedAt, reused: true,
    ageSeconds: Math.max(0, Math.round((Date.now() - fetchedAt) / 1000)),
  });
  const hot = memoryEntry(opts.key, Date.now());
  if (hot && isFresh(hot.fetchedAt, opts.ttlSeconds) && (!opts.usable || opts.usable(hot.value as T))) {
    if (trace) trace.hits++;
    return reuse(hot.value as T, hot.fetchedAt);
  }

  // Install the flight before the first database await. Concurrent callers
  // share the read and provider call; failures always remove the flight.
  const flightKey = `${opts.kind}|${opts.ttlSeconds}|${opts.key}`;
  const pending = flights.get(flightKey);
  if (pending) {
    const shared = await pending as CacheResult<T>;
    if (!opts.usable || opts.usable(shared.value)) {
      if (trace) trace.hits++;
      return reuse(shared.value, shared.fetchedAt);
    }
    // A caller needing more records must not accept a smaller shared result.
    return cachedWithMeta(opts, produce);
  }
  const work = (async (): Promise<CacheResult<T>> => {
    const stored = await readRow<T>(opts.key, opts.ttlSeconds);
    if (stored && (!opts.usable || opts.usable(stored.value))) {
      if (trace) trace.hits++;
      memorySet(opts.key, { at: Date.now(), fetchedAt: stored.fetchedAt, value: stored.value });
      return reuse(stored.value, stored.fetchedAt);
    }
    if (trace) trace.misses++;
    const value = await produce();
    const fetchedAt = Date.now();
    if (value !== null && value !== undefined) {
      await writeRow(opts.key, opts.kind, value);
      memorySet(opts.key, { at: Date.now(), fetchedAt, value });
    }
    return { value, fetchedAt, reused: false, ageSeconds: 0 };
  })();
  flights.set(flightKey, work);
  try { return await work; }
  finally { if (flights.get(flightKey) === work) flights.delete(flightKey); }
}

/** The value alone, for callers that don't care where it came from. */
export async function cached<T>(opts: CachedOptions<T>, produce: () => Promise<T>): Promise<T> {
  return (await cachedWithMeta(opts, produce)).value;
}

/**
 * Writes a value into both layers, replacing whatever was there.
 *
 * This is how a deliberate re-check makes itself felt: the fresh facts are
 * stored under the same key, so the next search *and* every account already
 * holding that site in memory gets the new audit rather than the one the user
 * just proved wrong.
 */
export async function storeCached<T>(
  key: string,
  kind: CacheKind,
  value: T
): Promise<void> {
  const now = Date.now();
  memorySet(key, { at: now, fetchedAt: now, value });
  await writeRow(key, kind, value);
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export type SearchOutcome = "ok" | "empty" | "rejected" | "error";

export interface SearchEvent {
  jobId?: number;
  stage?: string;
  userId: number | null;
  niche: string;
  location: string;
  source: string;
  filter: string;
  requested: number;
  returned: number;
  cacheHits: number;
  cacheMisses: number;
  latencyMs: number;
  outcome: SearchOutcome;
  detail?: string;
}

/**
 * Keeps a field to a length the log can live with.
 *
 * These columns hold what the user typed, so they are truncated on the way in
 * rather than filtered afterwards — a pasted page or a runaway string must not
 * become a row nobody can read. Query text only: no lead, no email, no phone
 * number ever reaches this table.
 */
const MAX_TEXT = 120;
function clip(value: string, max = MAX_TEXT): string {
  const s = (value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Appends one row to the activity log. Best-effort by design: losing a log line
 * must never fail the search that produced it.
 */
export async function recordSearchEvent(event: SearchEvent): Promise<void> {
  try {
    const { q } = await import("./db");
    await q(
      `INSERT INTO search_events
         (user_id, niche, location, source, filter, requested, returned,
          cache_hits, cache_misses, latency_ms, outcome, detail, job_id, stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        event.userId,
        clip(event.niche),
        clip(event.location),
        clip(event.source, 40),
        clip(event.filter, 20),
        Math.max(0, Math.round(event.requested)),
        Math.max(0, Math.round(event.returned)),
        Math.max(0, Math.round(event.cacheHits)),
        Math.max(0, Math.round(event.cacheMisses)),
        Math.max(0, Math.round(event.latencyMs)),
        event.outcome,
        clip(event.detail ?? "", 300),
        event.jobId ?? null,
        clip(event.stage ?? "lead-search",40),
      ]
    );
  } catch (err) {
    console.error("[search-cache] event log failed:", err);
  }
}

export type RecheckOutcome = "ok" | "failed" | "refused";

export interface RecheckEvent {
  userId: number | null;
  website: string;
  /** How old the audit it replaced was, in seconds. Null = there wasn't one. */
  ageSeconds: number | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  outcome: RecheckOutcome;
  detail?: string;
  latencyMs: number;
}

/**
 * Appends one row to the re-check log. Best-effort, like the search log: losing
 * a line about a refresh must never fail the refresh.
 *
 * Every attempt is recorded, including the refused ones — an endpoint that takes
 * a URL from a user is one somebody will eventually point at the server's own
 * network, and the operator should be able to see that happen.
 */
export async function recordRecheckEvent(event: RecheckEvent): Promise<void> {
  try {
    const { q } = await import("./db");
    await q(
      `INSERT INTO recheck_events
         (user_id, website, age_seconds, score_before, score_after, outcome, detail, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.userId,
        clip(event.website, 200),
        event.ageSeconds == null ? null : Math.max(0, Math.round(event.ageSeconds)),
        event.scoreBefore,
        event.scoreAfter,
        event.outcome,
        clip(event.detail ?? "", 300),
        Math.max(0, Math.round(event.latencyMs)),
      ]
    );
  } catch (err) {
    console.error("[search-cache] recheck log failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

/**
 * Drops cache rows no TTL can still consider fresh, and ages out the activity
 * log only if it grows beyond what this deployment could ever produce (a
 * runaway loop, not a real user). Called opportunistically from a search, so it
 * stays cheap and never runs on a schedule of its own.
 *
 * The log is deliberately the last thing to be pruned: rows are the research
 * data, and the query below leaves anything younger than a year alone.
 */
export async function pruneSearchCache(): Promise<void> {
  try {
    const { q } = await import("./db");
    await q("DELETE FROM search_cache WHERE refreshed_at < now() - interval '180 days'");
    await q(
      `DELETE FROM search_events
        WHERE created_at < now() - interval '400 days'
          AND id < (SELECT COALESCE(MAX(id), 0) - 200000 FROM search_events)`
    );
    await q("DELETE FROM recheck_events WHERE created_at < now() - interval '400 days'");
  } catch (err) {
    console.error("[search-cache] prune failed:", err);
  }
}

export interface CacheStats {
  entries: number;
  fresh: number;
  expired: number;
  hits: number;
  oldestSeconds: number;
  byKind: { kind: string; entries: number; hits: number }[];
}

/** The cache panel on the admin page: what is held, and what it has saved. */
export async function searchCacheStats(): Promise<CacheStats | null> {
  try {
    const { q1, q } = await import("./db");
    const totals = await q1<{
      entries: number;
      fresh: number;
      expired: number;
      hits: number;
      oldest: string | Date | null;
    }>(
      `SELECT
         COUNT(*)::int AS entries,
         COUNT(*) FILTER (WHERE refreshed_at > now() - ttl)::int AS fresh,
         COUNT(*) FILTER (WHERE refreshed_at <= now() - ttl)::int AS expired,
         COALESCE(SUM(hits), 0)::int AS hits,
         MIN(refreshed_at) AS oldest
       FROM (SELECT *, CASE
         WHEN kind = 'geo' THEN interval '180 days'
         WHEN kind = 'contact' OR (kind = 'source' AND cache_key LIKE 'src|osm|%') THEN interval '30 days'
         WHEN kind = 'site' OR (kind = 'source' AND cache_key LIKE 'src|companies_house|%') THEN interval '7 days'
         ELSE interval '14 days' END AS ttl FROM search_cache) cache`
    );
    const byKind = await q<{ kind: string; entries: number; hits: number }>(
      `SELECT kind, COUNT(*)::int AS entries, COALESCE(SUM(hits), 0)::int AS hits
       FROM search_cache GROUP BY kind ORDER BY entries DESC`
    );
    const oldestMs = toMs(totals?.oldest);
    return {
      entries: totals?.entries ?? 0,
      fresh: totals?.fresh ?? 0,
      expired: totals?.expired ?? 0,
      hits: totals?.hits ?? 0,
      oldestSeconds: oldestMs > 0 ? Math.round((Date.now() - oldestMs) / 1000) : 0,
      byKind,
    };
  } catch (err) {
    console.error("[search-cache] stats failed:", err);
    return null;
  }
}
