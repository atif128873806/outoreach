/**
 * The search queue.
 *
 * A lead search takes a minute on a cold cache: a source fetch, a locality
 * check, a website probe and a full audit per business. Holding an HTTP request
 * open for that is why the search screen used to feel broken — the user could
 * not do anything else, and neither could the browser. So a search is now a
 * *job*: the request validates, stores it, and answers immediately; a worker
 * runs it, and the UI watches it progress.
 *
 * The queue uses account locks for admission and a transaction-scoped lock for
 * deployment-wide worker capacity. Claims carry a renewable lease and unique
 * token; expired work fails instead of being replayed and potentially charged
 * again. Finished payloads and linked action timestamps are retained for a week.
 *
 * This module imports nothing of ours at the top level — the test runner loads
 * pure modules directly with Node's type stripping, which does not resolve
 * extensionless relative imports, and the repo's rule is that a module under
 * test stays dependency-free. What it needs at runtime (`db`, the search, the
 * activity log) is imported lazily inside functions, exactly as
 * lib/ratelimit.ts does it.
 */

export type JobStatus = "queued" | "running" | "done" | "failed";

/**
 * How many searches one account may have queued or running at once.
 *
 * Two, not "as many as you like": the sources behind a search have
 * deployment-wide budgets (Overpass mirrors, the register's 600 requests per
 * five minutes, one Exa allowance for the whole instance), so a single account
 * queueing twenty searches would take those budgets from everyone else. Two is
 * enough to keep working while one runs, which is the point of the queue.
 */
export const MAX_ACTIVE_JOBS_PER_USER = 2;

/** Deployment-wide running-job limit, coordinated by the database. */
export const MAX_CONCURRENT_JOBS = 2;

/** Finished searches are kept this long so a user can reopen one. */
export const JOB_RETENTION_DAYS = 7;

/** Workers renew this lease while a search is running. */
const LEASE_SECONDS = 120;
const HEARTBEAT_MS = 30_000;

export interface JobRow {
  id: number;
  user_id: number;
  source: string;
  niche: string;
  location: string;
  filter: string;
  count: number;
  status: string;
  lead_count: number;
  error: string;
  created_at: string | Date;
  started_at: string | Date | null;
  finished_at: string | Date | null;
  worker_token?: string | null;
}

/** A job as the client sees it — never includes the leads (see `jobResult`). */
export interface PublicJob {
  id: number;
  source: string;
  niche: string;
  location: string;
  filter: string;
  count: number;
  status: JobStatus;
  leadCount: number;
  error: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** The columns every read and claim shares, so they can't drift apart. */
const JOB_COLUMNS = `id, user_id, source, niche, location, filter, count, status,
                     lead_count, error, created_at, started_at, finished_at`;

export function isActiveStatus(status: string): boolean {
  return status === "queued" || status === "running";
}

function iso(value: string | Date | null): string | null {
  if (!value) return null;
  const at = value instanceof Date ? value : new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export function publicJob(row: JobRow): PublicJob {
  return {
    id: Number(row.id),
    source: row.source,
    niche: row.niche,
    location: row.location,
    filter: row.filter,
    count: Number(row.count),
    status: (row.status as JobStatus) ?? "queued",
    leadCount: Number(row.lead_count ?? 0),
    error: row.error ?? "",
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
  };
}

/**
 * One line naming what a job is, for the queue list and the failure message:
 * "plumbers in Leeds, UK" — with the filter only when it isn't the default, so
 * the common case stays quiet.
 */
export function describeJob(job: { niche: string; location: string; filter: string }): string {
  const what = `${job.niche || "(no niche)"} in ${job.location || "(no location)"}`;
  return job.filter && job.filter !== "any" ? `${what} · ${job.filter}` : what;
}

/** Whether another job may be queued for this account. */
export function capReached(activeCount: number): boolean {
  return activeCount >= MAX_ACTIVE_JOBS_PER_USER;
}

export const CAP_MESSAGE = `You can have ${MAX_ACTIVE_JOBS_PER_USER} searches running at once — wait for one to finish, then queue the next.`;

export interface EnqueueResult {
  ok: boolean;
  job?: PublicJob;
  status?: number;
  error?: string;
}

/**
 * Stores a search and answers immediately.
 *
 * The rules that depend on *state* — the monthly quota, the plan, whether a
 * source can run here — are deliberately not re-implemented here: the worker
 * applies them through `runLeadSearch` (lib/lead-search.ts), the same code a
 * direct request would hit. Duplicating them would guarantee the two drift, and
 * a queue that forgets the paywall is a queue that gives the product away. Only
 * the request's own shape is checked here, because a malformed search is not
 * worth a row.
 */
export async function enqueueSearchJob(
  userId: number,
  params: { source: string; niche: string; location: string; count: number; filter: string }
): Promise<EnqueueResult> {
  if (!params || typeof params.niche !== "string" || typeof params.location !== "string" ||
      typeof params.source !== "string" || typeof params.filter !== "string" ||
      !Number.isFinite(params.count)) {
    return { ok: false, status: 400, error: "Invalid search fields" };
  }
  const niche = params.niche.trim();
  const location = params.location.trim();
  if (!niche || !location || niche.length > 200 || location.length > 200 ||
      params.source.length > 40 || params.filter.length > 40) {
    return { ok: false, status: 400, error: "Enter a niche and location (up to 200 characters each)" };
  }
  const count = Math.min(50, Math.max(1, Math.round(params.count || 10)));
  const { getDb } = await import("./db");
  const db = await getDb();
  return db.transaction(async (tx) => {
    // The account row serializes admission across tabs and application replicas.
    const user = await tx.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!user.length) return { ok: false, status: 401, error: "Unauthorized" };
    const [active] = await tx.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM search_jobs
        WHERE user_id = $1 AND status IN ('queued','running')`, [userId]);
    if (capReached(Number(active.n))) return { ok: false, status: 429, error: CAP_MESSAGE };
    const [row] = await tx.query<JobRow>(
      `INSERT INTO search_jobs (user_id, source, niche, location, filter, count)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${JOB_COLUMNS}`,
      [userId, params.source || "web", niche, location, params.filter || "any", count]);
    return { ok: true, job: publicJob(row) };
  });
}

/** This account's recent searches, newest first. No leads — see `jobResult`. */
export async function listSearchJobs(userId: number, limit = 20): Promise<PublicJob[]> {
  const { q } = await import("./db");
  const rows = await q<JobRow>(
    `SELECT ${JOB_COLUMNS} FROM search_jobs WHERE user_id = $1 ORDER BY id DESC LIMIT $2`,
    [userId, Math.max(1, Math.min(50, limit))]
  );
  return rows.map(publicJob);
}

export interface JobResult {
  leads: unknown[];
  note?: string;
  meta?: unknown;
}

/**
 * A finished job's leads. Fetched on demand rather than with the list: a result
 * is a few hundred kilobytes of audited businesses, and the queue polls every
 * couple of seconds — shipping every past search's payload on every poll would
 * cost more than the searches did.
 *
 * Scoped to the account that owns it, so an id cannot be walked to read someone
 * else's leads.
 */
export async function jobResult(userId: number, id: number): Promise<JobResult | null> {
  const { q1 } = await import("./db");
  const row = await q1<{ result: string | null; status: string }>(
    "SELECT result, status FROM search_jobs WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (!row || row.status !== "done" || !row.result) return null;
  try {
    return JSON.parse(row.result) as JobResult;
  } catch {
    // A result we cannot parse is a lost search, not a crashed page.
    return null;
  }
}

/** The job's own row, for the status route. */
export async function getSearchJob(userId: number, id: number): Promise<PublicJob | null> {
  const { q1 } = await import("./db");
  const row = await q1<JobRow>(
    `SELECT ${JOB_COLUMNS} FROM search_jobs WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return row ? publicJob(row) : null;
}

/** Claims one job within the database-wide capacity limit. */
export async function claimNextJob(): Promise<JobRow | null> {
  const { getDb } = await import("./db");
  const { randomUUID } = await import("node:crypto");
  return (await getDb()).transaction(async (tx) => {
    // Transaction-scoped lock serializes capacity + claim on the same DB connection.
    await tx.query("SELECT pg_advisory_xact_lock(734921)");
    const [active] = await tx.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM search_jobs WHERE status = 'running'");
    if (active.n >= MAX_CONCURRENT_JOBS) return null;
    const [row] = await tx.query<JobRow>(
      `UPDATE search_jobs SET status = 'running', started_at = now(), error = '',
         worker_token = $1, lease_until = clock_timestamp() + interval '${LEASE_SECONDS} seconds'
       WHERE id = (SELECT id FROM search_jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE)
         AND status = 'queued'
       RETURNING ${JOB_COLUMNS}, worker_token`, [randomUUID()]);
    return row ?? null;
  });
}

/** A stale worker cannot publish a result after its lease was lost. */
export async function finishSearchJob(job: JobRow, result: JobResult | null, error = ""): Promise<boolean> {
  const { getDb } = await import("./db");
  const { consumeLeadQuota, leadQuotaMessage } = await import("./usage");
  return (await getDb()).transaction(async (tx) => {
    // Consistent lock ordering with admission: account first, then job.
    await tx.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [job.user_id]);
    const owned = await tx.query(`SELECT id FROM search_jobs WHERE id = $1 AND user_id = $2
      AND status = 'running' AND worker_token = $3 AND lease_until > clock_timestamp() FOR UPDATE`,
      [job.id, job.user_id, job.worker_token]);
    if (!owned.length) return false;
    if (result) {
      const { accepted, quota } = await consumeLeadQuota(job.user_id, result.leads.length, tx);
      if (result.leads.length > 0 && accepted === 0) throw new Error(leadQuotaMessage(quota));
      if (accepted < result.leads.length) {
        result.leads.splice(accepted);
        result.note = [result.note, "Results limited to your remaining monthly allowance."].filter(Boolean).join(" ");
      }
      if (result.meta && typeof result.meta === "object") {
        const meta = result.meta as Record<string, unknown>;
        const leads = result.leads as Record<string, unknown>[];
        Object.assign(meta, { found: leads.length,
          withEmail: leads.filter(l => l.email).length, withPhone: leads.filter(l => l.phone).length,
          withInstagram: leads.filter(l => l.instagram).length,
          sitesAudited: leads.filter(l => l.site_audit).length,
          needsWork: leads.filter(l => (l.site_audit as { needsWork?: boolean } | undefined)?.needsWork).length,
          quota: { plan: quota.plan.id, limit: quota.limit, remaining: quota.remaining } });
      }
    }
    await tx.query(`UPDATE search_jobs SET status = $1, result = $2, lead_count = $3, error = $4,
      finished_at = now(), worker_token = NULL, lease_until = NULL WHERE id = $5`,
      [result ? "done" : "failed", result ? JSON.stringify(result) : null,
        result?.leads.length ?? 0, error, job.id]);
    return true;
  });
}

/** How many jobs this process is running right now. */
let running = 0;
/** Guards against two pumps claiming their way past the concurrency limit. */
let pumping = false;
let nextCleanup = 0;

/**
 * Runs one search and records what happened.
 *
 * The activity log gets a line either way, written here rather than by the
 * worker's caller so that a queued search and a refused one are described in
 * exactly the same terms as any other search — the funnel has to mean the same
 * thing whichever door the request came through.
 */
async function executeJob(job: JobRow): Promise<void> {
  const startedAt = Date.now();
  const { q } = await import("./db");
  const { recordSearchEvent, withSearchTrace } = await import("./search-cache");
  const { runLeadSearch } = await import("./lead-search");
  const heartbeat = setInterval(() => {
    void q(`UPDATE search_jobs SET lease_until = clock_timestamp() + interval '${LEASE_SECONDS} seconds'
      WHERE id = $1 AND status = 'running' AND worker_token = $2 AND lease_until > clock_timestamp()`,
      [job.id, job.worker_token]).catch(() => {});
  }, HEARTBEAT_MS);
  heartbeat.unref();

  const logEvent = (
    outcome: "ok" | "empty" | "rejected" | "error",
    extra: { returned?: number; detail?: string; hits?: number; misses?: number }
  ) =>
    recordSearchEvent({
      jobId: job.id,
      stage: outcome === "rejected" ? "eligibility" : "lead-search",
      userId: job.user_id,
      niche: job.niche,
      location: job.location,
      source: job.source,
      filter: job.filter,
      requested: Number(job.count),
      returned: extra.returned ?? 0,
      cacheHits: extra.hits ?? 0,
      cacheMisses: extra.misses ?? 0,
      latencyMs: Date.now() - startedAt,
      outcome,
      detail: extra.detail,
    });

  const fail = (message: string) => finishSearchJob(job, null, message);

  try {
    const { value: result, trace } = await withSearchTrace(() =>
      runLeadSearch(job.user_id, {
        source: job.source,
        niche: job.niche,
        location: job.location,
        count: Number(job.count),
        websiteFilter: job.filter,
      })
    );

    if (!result.ok) {
      if (await fail(result.error)) await logEvent(result.outcome, {
        detail: result.error,
        hits: trace.hits,
        misses: trace.misses,
      });
      return;
    }

    const finished = await finishSearchJob(job, { leads: result.leads, note: result.note, meta: result.meta });
    if (finished) await logEvent(result.leads.length === 0 ? "empty" : "ok", {
      returned: result.leads.length,
      detail: result.detail,
      hits: trace.hits,
      misses: trace.misses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Leaving it 'running' would strand the job until the stale sweep, so try to
    // mark it failed; if even that fails, the expired-lease sweep will settle it.
    if (await fail(message).catch(() => false)) await logEvent("error", { detail: message });
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Runs whatever is queued, up to the concurrency limit, then returns.
 *
 * Deliberately not a loop that waits: the tick decides when to look, and a pump
 * that blocked would tie the scheduler to a search. Executions are fired and
 * counted, so the next tick tops the slots back up as they free.
 */
export async function pumpSearchJobs(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    if (Date.now() >= nextCleanup) {
      await recoverSearchJobs();
      nextCleanup = Date.now() + 3_600_000;
    } else {
      await failStaleRunningJobs();
    }
    while (running < MAX_CONCURRENT_JOBS) {
      const job = await claimNextJob();
      if (!job) return;
      running++;
      void executeJob(job)
        .catch((err) => console.error("[search-jobs] job failed:", err))
        .finally(() => {
          running--;
        });
    }
  } catch (err) {
    console.error("[search-jobs] pump failed:", err);
  } finally {
    pumping = false;
  }
}

/**
 * A job still marked running long past any believable search is a crash — a
 * restarted container, a killed process — rather than a slow one. Failing it is
 * better than a user watching "In progress" for ever.
 */
async function failStaleRunningJobs(): Promise<number> {
  const { q } = await import("./db");
  const rows = await q(
    `UPDATE search_jobs SET status = 'failed',
       error = 'Search interrupted. Please queue it again.', finished_at = now(),
       worker_token = NULL, lease_until = NULL
     WHERE status = 'running' AND (
       lease_until <= clock_timestamp() OR (lease_until IS NULL AND (started_at IS NULL OR started_at < now() - interval '10 minutes'))
     ) RETURNING id`);
  return rows.length;
}

/** Recover expired leases only. Never replay work that may already be metered. */
export async function recoverSearchJobs(): Promise<number> {
  const { q } = await import("./db");
  const recovered = await failStaleRunningJobs();
  await q(`DELETE FROM search_jobs WHERE status IN ('done','failed')
    AND finished_at < now() - interval '${JOB_RETENTION_DAYS} days'`);
  return recovered;
}
