/**
 * Postgres data layer.
 *
 * Production: set DATABASE_URL — a standard Postgres (node-postgres Pool).
 * Development: no DATABASE_URL — PGlite, an embedded Postgres engine stored
 * in data/pg/, so local dev needs no database server. Same SQL both ways.
 */

import path from "path";

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
  const lite = new PGlite(path.join(process.cwd(), "data", "pg"));
  await lite.waitReady;
  let chain: Promise<unknown> = Promise.resolve(); // serialize transactions

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
      const run = chain.then(async () => {
        await lite.query("BEGIN");
        try {
          const result = await fn({ query: q });
          await lite.query("COMMIT");
          return result;
        } catch (err) {
          await lite.query("ROLLBACK").catch(() => {});
          throw err;
        }
      });
      chain = run.catch(() => {});
      return run as Promise<T>;
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
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, key)
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
     ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'`
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
