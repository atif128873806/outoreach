/**
 * Postgres data layer.
 *
 * Production: set DATABASE_URL — a standard Postgres (node-postgres Pool).
 * Development: no DATABASE_URL — PGlite, an embedded Postgres engine stored
 * in data/pg/, so local dev needs no database server. Same SQL both ways.
 */

import path from "path";
import fs from "fs";

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

interface Adapter extends Queryable {
  exec(sql: string): Promise<void>;
  /** Runs fn inside BEGIN/COMMIT (ROLLBACK on throw). */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

const globalForDb = globalThis as unknown as {
  __outreachPg?: Promise<Adapter>;
};

async function createAdapter(): Promise<Adapter> {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 10 });
    return {
      async query<T>(text: string, params: unknown[] = []) {
        const res = await pool.query(text, params);
        return res.rows as T[];
      },
      async exec(sql: string) {
        await pool.query(sql);
      },
      async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn({
            async query<R>(text: string, params: unknown[] = []) {
              const res = await client.query(text, params);
              return res.rows as R[];
            },
          });
          await client.query("COMMIT");
          return result;
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
    };
  }

  // Embedded Postgres for local development (single connection, serialized)
  const { PGlite } = await import("@electric-sql/pglite");
  const storagePath = path.join(process.cwd(), "data", "pg");
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const lite = new PGlite(storagePath);
  await lite.waitReady;

  const q = async <T>(text: string, params: unknown[] = []) => {
    const res = await lite.query(text, params);
    return res.rows as T[];
  };

  return {
    query: q,
    async exec(sql: string) {
      await lite.exec(sql);
    },
    transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      // PGlite's transaction mutex also excludes standalone queries. A manual
      // BEGIN allowed unrelated requests to join (and be rolled back with) fn.
      return lite.transaction(async (tx) => fn({
        async query<R>(text: string, params: unknown[] = []) {
          return (await tx.query(text, params)).rows as R[];
        },
      }));
    },
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL DEFAULT '',
  password_hash  TEXT NOT NULL,
  is_admin       INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token   TEXT,
  verify_expires TIMESTAMPTZ,
  reset_token    TEXT,
  reset_expires  TIMESTAMPTZ,
  plan           TEXT NOT NULL DEFAULT 'free',
  plan_changed_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, key)
);

-- Saved searches that report what is NEW in them.
--
-- A lead list is worked once and then it is done, which is why a lead tool gets
-- opened in bursts and then forgotten. The register publishes companies by
-- incorporation date, so "new roofers in Leeds since last week" is a real,
-- authoritative answer that changes every week — this table is what remembers
-- what a user is watching.
CREATE TABLE IF NOT EXISTS lead_watches (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  niche           TEXT NOT NULL,
  location        TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Start of the window the next check asks for. Defaults to creation time to
  -- satisfy the not-null constraint, but it is only *read* once a check has
  -- succeeded (see lib/digest.ts watchWindow): until then a watch looks back a
  -- week, because treating creation time as the boundary would ask the register
  -- only for companies registered from now on and leave every new watch empty
  -- until its second week. After that it moves forward on each check, so no
  -- company is ever asked for twice.
  checked_through TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  -- Written by a check, cleared when the user looks, so the sidebar can show a
  -- count without querying the register on every page load.
  unseen_count    INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT NOT NULL DEFAULT '',
  UNIQUE (user_id, niche, location)
);

-- The companies a watch has already reported.
--
-- Deduplication is by company number, not by name: the register numbers companies
-- for life, while "ABC Roofing Ltd" and "ABC Roofing Limited" are one business
-- spelled two ways. Rows are pruned once they fall outside the window a check
-- can ask about, so this stays proportional to a few weeks of incorporations
-- rather than growing for ever.
CREATE TABLE IF NOT EXISTS lead_watch_companies (
  watch_id       INTEGER NOT NULL REFERENCES lead_watches(id) ON DELETE CASCADE,
  company_number TEXT NOT NULL,
  business_name  TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  directors      TEXT NOT NULL DEFAULT '',
  incorporated_on TEXT NOT NULL DEFAULT '',
  seen           INTEGER NOT NULL DEFAULT 0,
  found_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (watch_id, company_number)
);

CREATE TABLE IF NOT EXISTS contacts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  website       TEXT NOT NULL DEFAULT '',
  instagram     TEXT NOT NULL DEFAULT '',
  linkedin      TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  email_status  TEXT NOT NULL DEFAULT 'unchecked',
  email_checked_at TIMESTAMPTZ,
  replied       INTEGER NOT NULL DEFAULT 0,
  bounced       INTEGER NOT NULL DEFAULT 0,
  unsubscribed  INTEGER NOT NULL DEFAULT 0,
  unsub_token   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email is optional (offline businesses are reached by phone/Instagram);
-- uniqueness applies only to real addresses.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email
  ON contacts(user_id, email) WHERE email <> '';

CREATE TABLE IF NOT EXISTS campaigns (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  tone                   TEXT NOT NULL DEFAULT 'professional',
  channel                TEXT NOT NULL DEFAULT 'email',
  category_filter        TEXT NOT NULL DEFAULT '',
  scheduled_at           TIMESTAMPTZ,
  throttle_per_hour      INTEGER NOT NULL DEFAULT 60,
  followup_count         INTEGER NOT NULL DEFAULT 0,
  followup_interval_days INTEGER NOT NULL DEFAULT 3,
  send_window_start      INTEGER,
  send_window_end        INTEGER,
  ab_test                INTEGER NOT NULL DEFAULT 0,
  test_batch             INTEGER NOT NULL DEFAULT 0,
  test_done              INTEGER NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'scheduled',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  step          INTEGER NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMPTZ,
  subject       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending',
  via           TEXT NOT NULL DEFAULT '',
  error         TEXT NOT NULL DEFAULT '',
  attempts      INTEGER NOT NULL DEFAULT 0,
  variant       TEXT NOT NULL DEFAULT '',
  sent_at       TIMESTAMPTZ,
  open_token    TEXT,
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ,
  replied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_campaign ON emails(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_emails_user_sent ON emails(user_id, status, sent_at);
CREATE INDEX IF NOT EXISTS idx_emails_open_token ON emails(open_token);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

-- Generic per-user daily usage counters (kind: 'leads', …)
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  kind    TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);

-- Per-user daily count of AI generations made with the instance's global key
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Fixed-window rate limits that survive restarts (auth endpoints)
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS replies (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_email      TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL DEFAULT '',
  snippet         TEXT NOT NULL DEFAULT '',
  classification  TEXT NOT NULL DEFAULT '',
  suggested_reply TEXT NOT NULL DEFAULT '',
  handled         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Search cache: the payload store for fetched source results, website facts and
-- geocoding. Mutable, evictable, and shared by every account (the data is
-- public; the point is to stop re-fetching it). See lib/search-cache.ts.
CREATE TABLE IF NOT EXISTS search_cache (
  cache_key    TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  payload      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits         INTEGER NOT NULL DEFAULT 0,
  last_hit_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_search_cache_kind ON search_cache(kind);
CREATE INDEX IF NOT EXISTS idx_search_cache_refreshed ON search_cache(refreshed_at);

-- Search activity log: one append-only row per search attempt. Never updated,
-- never evicted — it is the record of what people searched for, where they got
-- nothing, and where they gave up. Deliberately a separate table from
-- search_cache: expiring a cached payload must not erase the history of
-- everyone who searched it.
CREATE TABLE IF NOT EXISTS search_events (
  id           SERIAL PRIMARY KEY,
  -- Nullable and SET NULL: an account can be deleted, its search history stays.
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  niche        TEXT NOT NULL DEFAULT '',
  location     TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT '',
  filter       TEXT NOT NULL DEFAULT '',
  requested    INTEGER NOT NULL DEFAULT 0,
  returned     INTEGER NOT NULL DEFAULT 0,
  cache_hits   INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  latency_ms   INTEGER NOT NULL DEFAULT 0,
  -- ok = returned leads | empty = ran, found nothing | rejected = never ran,
  -- because of quota, plan or a bad request | error = the search itself failed.
  outcome      TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_events_created ON search_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_events_user ON search_events(user_id);
CREATE INDEX IF NOT EXISTS idx_search_events_outcome ON search_events(outcome);

-- Audit re-checks: a user asking us to visit a site again because the audit we
-- showed them was cached. Deliberately its own table rather than rows in
-- search_events — a re-check is not a search, and mixing the two would corrupt
-- the funnel numbers that log exists to report.
--
-- It answers the one question that decides the site cache's TTL: when someone
-- checks again, does the cached audit turn out to have been wrong? age_seconds
-- is how old the audit being replaced actually was, and score_before/after say
-- whether the fresh visit agreed with it. "Of the audits older than 3 days that
-- were re-checked, 40% had changed" is a decision; a guess is not.
CREATE TABLE IF NOT EXISTS recheck_events (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  website      TEXT NOT NULL,
  -- Age of the audit this replaced, in seconds. NULL = no stored audit at all.
  age_seconds  INTEGER,
  score_before INTEGER,
  score_after  INTEGER,
  -- ok = site visited | failed = it could not be loaded | refused = never ran
  -- (a bad or internal address, or the rate limit).
  outcome      TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '',
  latency_ms   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recheck_events_created ON recheck_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recheck_events_site ON recheck_events(website);

-- Lead searches run as jobs, not as a held-open HTTP request: a search takes a
-- minute on a cold cache, and the user should be able to queue another while one
-- runs (see lib/search-jobs.ts).
--
-- The result column holds the finished payload whole, which is what lets a
-- search be reopened after a page reload without re-fetching or re-auditing
-- anything. It is also the biggest thing in this database, which is why finished
-- jobs are aged out after a week.
CREATE TABLE IF NOT EXISTS search_jobs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'web',
  niche       TEXT NOT NULL,
  location    TEXT NOT NULL,
  filter      TEXT NOT NULL DEFAULT 'any',
  count       INTEGER NOT NULL DEFAULT 10,
  -- queued | running | done | failed
  status      TEXT NOT NULL DEFAULT 'queued',
  result      TEXT,
  lead_count  INTEGER NOT NULL DEFAULT 0,
  error       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  worker_token TEXT,
  lease_until TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  copied_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ
);

-- The claim walks the queue in id order, and the per-account cap counts active
-- jobs by user, so both need an index that starts where they do.
CREATE INDEX IF NOT EXISTS idx_search_jobs_queue ON search_jobs(status, id);
CREATE INDEX IF NOT EXISTS idx_search_jobs_user ON search_jobs(user_id, status);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_stamp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_audit_events (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS search_extractions (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  niche TEXT NOT NULL,
  location TEXT NOT NULL,
  source TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('exported','copied','saved')),
  lead_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, action)
);
CREATE INDEX IF NOT EXISTS idx_search_extractions_created ON search_extractions(created_at DESC);
`;

async function init(): Promise<Adapter> {
  const db = await createAdapter();

  // Detect pre-verification databases BEFORE the schema runs, so we can
  // grandfather their existing accounts as verified.
  const hadUsersTable =
    (
      await db.query(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
      )
    ).length > 0;
  const hadVerifiedColumn =
    hadUsersTable &&
    (
      await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified'"
      )
    ).length > 0;

  await db.exec(SCHEMA);

  // Migrations for databases created by earlier versions
  await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin INTEGER NOT NULL DEFAULT 0");
  await db.exec(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0;
     ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT;
     ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMPTZ;
     ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
     ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
     ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
     ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMPTZ`
  );
  await db.exec(
    `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'unchecked';
     ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_checked_at TIMESTAMPTZ`
  );
  if (hadUsersTable && !hadVerifiedColumn) {
    // Accounts created before email verification existed keep working.
    await db.exec("UPDATE users SET email_verified = 1");
  }
  // Contacts: replace the hard UNIQUE(user_id, email) with the partial index
  // so no-email (offline-business) contacts can exist.
  await db
    .exec("ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_user_id_email_key")
    .catch(() => {});
  await db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_id, email) WHERE email <> ''"
  );
  await db.exec(
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS test_batch INTEGER NOT NULL DEFAULT 0;
     ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS test_done INTEGER NOT NULL DEFAULT 0`
  );
  await db.exec(`ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS worker_token TEXT;
    ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
    ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
    ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;
    ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS copied_at TIMESTAMPTZ;
    ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ`);
  await db.exec(`ALTER TABLE search_events ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES search_jobs(id) ON DELETE SET NULL;
    ALTER TABLE search_events ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'lead-search';
    CREATE INDEX IF NOT EXISTS idx_search_events_job ON search_events(job_id)`);
  return db;
}

export function getDb(): Promise<Adapter> {
  return (globalForDb.__outreachPg ??= init());
}

/** Convenience: run one query against the shared adapter. */
export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(text, params);
}

/** Convenience: first row or undefined. */
export async function q1<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

// ---------- row types ----------

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  is_admin: number;
  email_verified: number;
  /** sha256 hex of the emailed verification token */
  verify_token: string | null;
  verify_expires: string | null;
  /** sha256 hex of the emailed password-reset token */
  reset_token: string | null;
  reset_expires: string | null;
  /** "free" | "starter" | "pro" — see lib/plans.ts */
  plan: string;
  created_at: string;
}

export interface Contact {
  id: number;
  user_id: number;
  email: string;
  business_name: string;
  category: string;
  website: string;
  instagram: string;
  /** LinkedIn path, e.g. "company/acme" or "in/janedoe" */
  linkedin: string;
  phone: string;
  notes: string;
  /** Domain-level safety check: unchecked | valid | risky | invalid | unknown. */
  email_status: string;
  email_checked_at: string | null;
  replied: number;
  bounced: number;
  unsubscribed: number;
  unsub_token: string;
  created_at: string;
}

export type CampaignStatus =
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type Channel = "email" | "instagram" | "linkedin";

export type ReplyClassification =
  | "interested"
  | "question"
  | "not_interested"
  | "out_of_office"
  | "other";

export interface ReplyRow {
  id: number;
  user_id: number;
  contact_id: number;
  from_email: string;
  subject: string;
  snippet: string;
  classification: ReplyClassification | "";
  suggested_reply: string;
  handled: number;
  created_at: string;
}

export interface Campaign {
  id: number;
  user_id: number;
  name: string;
  description: string;
  tone: string;
  channel: Channel;
  category_filter: string;
  scheduled_at: string | null;
  throttle_per_hour: number;
  followup_count: number;
  followup_interval_days: number;
  send_window_start: number | null;
  send_window_end: number | null;
  /** 1 = alternate two AI subject-line styles and compare open rates */
  ab_test: number;
  /** >0 = send this many first, then auto-pause for review */
  test_batch: number;
  /** 1 = the test batch already ran and paused once */
  test_done: number;
  status: CampaignStatus;
  created_at: string;
}

/**
 * Message lifecycle:
 *  pending → sent | failed | skipped          (email channel)
 *  pending → ready → sent | skipped           (instagram/linkedin: drafted, sent manually)
 */
export type EmailStatus = "pending" | "ready" | "sent" | "failed" | "skipped";

export interface EmailRow {
  id: number;
  user_id: number;
  campaign_id: number;
  contact_id: number;
  step: number;
  scheduled_for: string | null;
  subject: string;
  body: string;
  status: EmailStatus;
  via: string;
  error: string;
  attempts: number;
  /** A/B subject test arm ("A" | "B") — empty when the campaign isn't testing */
  variant: string;
  sent_at: string | null;
  open_token: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  created_at: string;
}
