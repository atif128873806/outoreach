import { redactAdminDetail } from "@/lib/admin-data";
import { searchFollowThrough } from "@/lib/search-actions";
import { NextRequest, NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { getAdminId } from "@/lib/admin-auth";
import { searchCacheStats } from "@/lib/search-cache";

/**
 * Admin-only: what the Lead Finder has actually been used for.
 *
 * This is the read side of `search_events` (see lib/search-cache.ts) — the
 * analytics half of the advisory session's "persist metadata" item. It answers
 * the questions the product could not answer before: what people search for,
 * which searches come back with nothing, recorded follow-through, elapsed time,
 * in time, and whether the cache is earning its keep.
 *
 * Search events are server-written. Linked opens, copies and export requests
 * are client-reported; saves are recorded by successful contact imports.
 * Missing actions are not proof of abandonment.
 */

export const runtime = "nodejs";

interface TotalsRow {
  searches: number;
  ok: number;
  empty: number;
  rejected: number;
  errors: number;
  accounts: number;
  last_24h: number;
  last_7d: number;
  hits: number;
  misses: number;
  warmed: number;
  cold_ms: number | null;
  warm_ms: number | null;
  first_seen: string | Date | null;
}

export interface SearchRow {
  niche: string;
  location: string;
  source: string;
  searches: number;
  found: number;
  last_at: string | Date;
}

export async function GET(req: NextRequest) {
  const uid = await getAdminId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The study tool: the raw logs, as a spreadsheet. Every row the search screen
  // wrote, so the operator can group and chart it outside this page.
  const params = new URL(req.url).searchParams;
  if (params.get("format") === "csv") {
    return params.get("kind") === "rechecks" ? recheckCsvResponse() : csvResponse();
  }

  const totals = await q1<TotalsRow>(
    `SELECT
       COUNT(*)::int AS searches,
       COUNT(*) FILTER (WHERE outcome = 'ok')::int AS ok,
       COUNT(*) FILTER (WHERE outcome = 'empty')::int AS empty,
       COUNT(*) FILTER (WHERE outcome = 'rejected')::int AS rejected,
       COUNT(*) FILTER (WHERE outcome = 'error')::int AS errors,
       COUNT(DISTINCT user_id)::int AS accounts,
       COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last_24h,
       COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS last_7d,
       COALESCE(SUM(cache_hits), 0)::int AS hits,
       COALESCE(SUM(cache_misses), 0)::int AS misses,
       -- A "warmed" search is one that served part of itself from the cache.
       COUNT(*) FILTER (WHERE cache_hits > 0)::int AS warmed,
       -- The number that sells the cache: how long a search takes when it has
       -- to fetch everything, versus one that doesn't.
       (AVG(latency_ms) FILTER (WHERE cache_hits = 0 AND outcome = 'ok'))::int AS cold_ms,
       (AVG(latency_ms) FILTER (WHERE cache_hits > 0 AND outcome = 'ok'))::int AS warm_ms,
       MIN(created_at) AS first_seen
     FROM search_events`
  );

  const top = await q<SearchRow>(
    `SELECT niche, location, source,
            COUNT(*)::int AS searches,
            COALESCE(SUM(returned), 0)::int AS found,
            MAX(created_at) AS last_at
     FROM search_events
     WHERE outcome = 'ok'
     GROUP BY niche, location, source
     ORDER BY searches DESC, last_at DESC
     LIMIT 25`
  );

  // The most actionable list on the page: searches that ran and answered
  // nothing. "Dentists in Truro → 0" is either a missing niche translation, a
  // coverage gap in the source, or a market that isn't there — and all three
  // are decisions, where a guess is not.
  const empty = await q<SearchRow>(
    `SELECT niche, location, source,
            COUNT(*)::int AS searches,
            0::int AS found,
            MAX(created_at) AS last_at
     FROM search_events
     WHERE outcome = 'empty'
     GROUP BY niche, location, source
     ORDER BY searches DESC, last_at DESC
     LIMIT 25`
  );

  const sources = await q<{
    source: string;
    searches: number;
    ok: number;
    empty: number;
    rejected: number;
    errors: number;
    avg_ms: number | null;
  }>(
    `SELECT source,
            COUNT(*)::int AS searches,
            COUNT(*) FILTER (WHERE outcome = 'ok')::int AS ok,
            COUNT(*) FILTER (WHERE outcome = 'empty')::int AS empty,
            COUNT(*) FILTER (WHERE outcome = 'rejected')::int AS rejected,
            COUNT(*) FILTER (WHERE outcome = 'error')::int AS errors,
            (AVG(latency_ms))::int AS avg_ms
     FROM search_events
     WHERE source <> ''
     GROUP BY source
     ORDER BY searches DESC`
  );

  const accounts = await q<{
    email: string;
    searches: number;
    ok: number;
    empty: number;
    last_at: string | Date;
    contacts: number;
  }>(
    `SELECT COALESCE(u.email, '(deleted account)') AS email,
            COUNT(e.id)::int AS searches,
            COUNT(e.id) FILTER (WHERE e.outcome = 'ok')::int AS ok,
            COUNT(e.id) FILTER (WHERE e.outcome = 'empty')::int AS empty,
            MAX(e.created_at) AS last_at,
            (SELECT COUNT(*) FROM contacts c WHERE c.user_id = e.user_id)::int AS contacts
     FROM search_events e
     LEFT JOIN users u ON u.id = e.user_id
     GROUP BY e.user_id, u.email
     ORDER BY searches DESC
     LIMIT 25`
  );

  const perDay = await q<{ day: string; searches: number; ok: number; empty: number }>(
    `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS searches,
            COUNT(*) FILTER (WHERE outcome = 'ok')::int AS ok,
            COUNT(*) FILTER (WHERE outcome = 'empty')::int AS empty
     FROM search_events
     WHERE created_at > now() - interval '14 days'
     GROUP BY 1
     ORDER BY 1`
  );

  const recent = await q<{
    created_at: string | Date;
    email: string | null;
    niche: string;
    location: string;
    source: string;
    filter: string;
    requested: number;
    returned: number;
    cache_hits: number;
    cache_misses: number;
    latency_ms: number;
    outcome: string;
    detail: string;
  }>(
    `SELECT e.created_at, u.email, e.niche, e.location, e.source, e.filter,
            e.requested, e.returned, e.cache_hits, e.cache_misses,
            e.latency_ms, e.outcome, e.detail
     FROM search_events e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.id DESC
     LIMIT 40`
  );

  const cache = await searchCacheStats();
  const rechecks = await recheckInsights();

  const hits = totals?.hits ?? 0;
  const misses = totals?.misses ?? 0;

  return NextResponse.json({
    totals: {
      ...totals,
      searches: totals?.searches ?? 0,
      hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
    },
    top,
    empty,
    sources,
    accounts,
    perDay,
    recent: recent.map(r=>({...r,detail:redactAdminDetail(r.detail)})),
    cache,
    rechecks,
    followThrough: await searchFollowThrough(),
  }, {headers:{"Cache-Control":"no-store"}});
}

/**
 * The audit cache's report card.
 *
 * Every user who presses "re-check" runs an experiment we would otherwise have
 * to guess at: they ask whether the audit we served them — from the site cache —
 * still describes the site. So the panel is built around one comparison: how old
 * was the audit, and did the fresh visit agree with it?
 *
 * Read it as the answer to "is the seven-day site TTL right?":
 *  - re-checks changing almost nothing, at any age → the TTL could be longer;
 *    we are spending real requests to satisfy doubt.
 *  - audits over three days old changing often → it is too long, and the users
 *    clicking are correcting us by hand.
 *  - re-checks clustering on audits that are already days old → people don't
 *    trust what they cannot date, which is the other half of the same question.
 */
async function recheckInsights() {
  const totals = await q1<{
    rechecks: number;
    ok: number;
    failed: number;
    refused: number;
    accounts: number;
    last_7d: number;
    changed: number;
    median_age_seconds: number | null;
    avg_delta: number | null;
  }>(
    `SELECT
       COUNT(*)::int AS rechecks,
       COUNT(*) FILTER (WHERE outcome = 'ok')::int AS ok,
       COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failed,
       COUNT(*) FILTER (WHERE outcome = 'refused')::int AS refused,
       COUNT(DISTINCT user_id)::int AS accounts,
       COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS last_7d,
       COUNT(*) FILTER (WHERE score_before IS NOT NULL AND score_after IS NOT NULL
                          AND score_before <> score_after)::int AS changed,
       (percentile_cont(0.5) WITHIN GROUP (ORDER BY age_seconds))::int AS median_age_seconds,
       (AVG(score_after - score_before)
          FILTER (WHERE score_before IS NOT NULL AND score_after IS NOT NULL))::int AS avg_delta
     FROM recheck_events`
  );

  // The decisive table: does a cached audit's age predict whether it was wrong?
  const byAge = await q<{
    bucket: string;
    rechecks: number;
    changed: number;
    avg_delta: number | null;
  }>(
    `SELECT bucket,
            COUNT(*)::int AS rechecks,
            COUNT(*) FILTER (WHERE score_before IS NOT NULL AND score_after IS NOT NULL
                               AND score_before <> score_after)::int AS changed,
            (AVG(score_after - score_before)
               FILTER (WHERE score_before IS NOT NULL AND score_after IS NOT NULL))::int AS avg_delta
     FROM (
       SELECT CASE
                WHEN age_seconds IS NULL THEN 'no stored audit'
                WHEN age_seconds < 3600 THEN 'under an hour old'
                WHEN age_seconds < 86400 THEN 'under a day old'
                WHEN age_seconds < 259200 THEN '1 to 3 days old'
                WHEN age_seconds < 604800 THEN '3 to 7 days old'
                ELSE 'over 7 days old'
              END AS bucket,
              CASE
                WHEN age_seconds IS NULL THEN 0
                WHEN age_seconds < 3600 THEN 1
                WHEN age_seconds < 86400 THEN 2
                WHEN age_seconds < 259200 THEN 3
                WHEN age_seconds < 604800 THEN 4
                ELSE 5
              END AS ord,
              score_before,
              score_after
       FROM recheck_events
       WHERE outcome = 'ok'
     ) t
     GROUP BY bucket, ord
     ORDER BY ord`
  );

  const sites = await q<{
    website: string;
    rechecks: number;
    changed: number;
    last_at: string | Date;
  }>(
    `SELECT website,
            COUNT(*)::int AS rechecks,
            COUNT(*) FILTER (WHERE score_before IS NOT NULL AND score_after IS NOT NULL
                               AND score_before <> score_after)::int AS changed,
            MAX(created_at) AS last_at
     FROM recheck_events
     WHERE outcome = 'ok'
     GROUP BY website
     ORDER BY rechecks DESC, last_at DESC
     LIMIT 15`
  );

  const recent = await q<{
    created_at: string | Date;
    email: string | null;
    website: string;
    age_seconds: number | null;
    score_before: number | null;
    score_after: number | null;
    outcome: string;
    detail: string;
    latency_ms: number;
  }>(
    `SELECT e.created_at, u.email, e.website, e.age_seconds, e.score_before,
            e.score_after, e.outcome, e.detail, e.latency_ms
     FROM recheck_events e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.id DESC
     LIMIT 25`
  );

  return {
    totals: {
      rechecks: totals?.rechecks ?? 0,
      ok: totals?.ok ?? 0,
      failed: totals?.failed ?? 0,
      refused: totals?.refused ?? 0,
      accounts: totals?.accounts ?? 0,
      last_7d: totals?.last_7d ?? 0,
      changed: totals?.changed ?? 0,
      medianAgeSeconds: totals?.median_age_seconds ?? null,
      avgDelta: totals?.avg_delta ?? null,
    },
    byAge,
    sites,
    recent: recent.map(r=>({...r,detail:redactAdminDetail(r.detail)})),
  };
}

/** The re-check log as a spreadsheet, with the same escaping rules. */
async function recheckCsvResponse(): Promise<NextResponse> {
  const rows = await q<{
    created_at: string | Date;
    email: string | null;
    website: string;
    age_hours: number | null;
    score_before: number | null;
    score_after: number | null;
    outcome: string;
    detail: string;
    latency_ms: number;
  }>(
    `SELECT e.created_at, u.email, e.website,
            CASE WHEN e.age_seconds IS NULL THEN NULL
                 ELSE ROUND(e.age_seconds / 3600.0, 1) END AS age_hours,
            e.score_before, e.score_after, e.outcome, e.detail, e.latency_ms
     FROM recheck_events e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.id DESC
     LIMIT 20000`
  );

  const header = [
    "created_at",
    "account",
    "website",
    "audit_age_hours",
    "score_before",
    "score_after",
    "score_moved",
    "outcome",
    "detail",
    "latency_ms",
  ];
  const body = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.email ?? "",
        r.website,
        r.age_hours ?? "",
        r.score_before ?? "",
        r.score_after ?? "",
        r.score_before != null && r.score_after != null && r.score_before !== r.score_after
          ? "yes"
          : "no",
        r.outcome,
        r.detail,
        r.latency_ms,
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="recheck-activity-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}

/**
 * One CSV field. Quotes always, doubles embedded quotes, and defuses a leading
 * `=`, `+`, `-` or `@` — these are user-typed strings, and a spreadsheet that
 * executes one is a bug with a long history.
 */
function csvCell(value: unknown): string {
  const s = redactAdminDetail(value instanceof Date ? value.toISOString() : value);
  const safe = /^[\s]*[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * The whole search log as CSV.
 *
 * Server-side and deterministic rather than a client-side parse: the log is
 * meant to leave this product and become a spreadsheet, and a file that opens
 * the same way every time is worth more than one assembled in a browser.
 */
async function csvResponse(): Promise<NextResponse> {
  const rows = await q<{
    created_at: string | Date;
    email: string | null;
    niche: string;
    location: string;
    source: string;
    filter: string;
    requested: number;
    returned: number;
    cache_hits: number;
    cache_misses: number;
    latency_ms: number;
    outcome: string;
    detail: string;
  }>(
    `SELECT e.created_at, u.email, e.niche, e.location, e.source, e.filter,
            e.requested, e.returned, e.cache_hits, e.cache_misses,
            e.latency_ms, e.outcome, e.detail
     FROM search_events e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.id DESC
     LIMIT 20000`
  );

  const header = [
    "created_at",
    "account",
    "niche",
    "location",
    "source",
    "filter",
    "requested",
    "returned",
    "cache_hits",
    "cache_misses",
    "latency_ms",
    "outcome",
    "detail",
  ];
  const cell = csvCell;
  const body = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.email ?? "",
        r.niche,
        r.location,
        r.source,
        r.filter,
        r.requested,
        r.returned,
        r.cache_hits,
        r.cache_misses,
        r.latency_ms,
        r.outcome,
        r.detail,
      ]
        .map(cell)
        .join(",")
    ),
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="search-activity-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
