import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Keep a single connection across Next.js hot reloads.
const globalForDb = globalThis as unknown as { __outreachDb?: Database.Database };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  business_name TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  website       TEXT NOT NULL DEFAULT '',
  instagram     TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  replied       INTEGER NOT NULL DEFAULT 0,
  unsubscribed  INTEGER NOT NULL DEFAULT 0,
  unsub_token   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  tone                   TEXT NOT NULL DEFAULT 'professional',
  channel                TEXT NOT NULL DEFAULT 'email',
  category_filter        TEXT NOT NULL DEFAULT '',
  scheduled_at           TEXT,
  throttle_per_hour      INTEGER NOT NULL DEFAULT 60,
  followup_count         INTEGER NOT NULL DEFAULT 0,
  followup_interval_days INTEGER NOT NULL DEFAULT 3,
  send_window_start      INTEGER,
  send_window_end        INTEGER,
  status                 TEXT NOT NULL DEFAULT 'scheduled',
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS emails (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  step          INTEGER NOT NULL DEFAULT 1,
  scheduled_for TEXT,
  subject       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending',
  via           TEXT NOT NULL DEFAULT '',
  error         TEXT NOT NULL DEFAULT '',
  sent_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_emails_campaign ON emails(campaign_id, status);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS replies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_email      TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL DEFAULT '',
  snippet         TEXT NOT NULL DEFAULT '',
  classification  TEXT NOT NULL DEFAULT '',
  suggested_reply TEXT NOT NULL DEFAULT '',
  handled         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

/** Adds any columns missing from an older database file. */
function ensureColumns(
  db: Database.Database,
  table: string,
  columns: Record<string, string>
) {
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (r) => r.name
    )
  );
  for (const [name, ddl] of Object.entries(columns)) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    }
  }
}

export function getDb(): Database.Database {
  if (globalForDb.__outreachDb) return globalForDb.__outreachDb;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, "outreach.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  // Migrations for databases created by earlier versions
  ensureColumns(db, "contacts", {
    instagram: "TEXT NOT NULL DEFAULT ''",
    linkedin: "TEXT NOT NULL DEFAULT ''",
    phone: "TEXT NOT NULL DEFAULT ''",
    replied: "INTEGER NOT NULL DEFAULT 0",
    bounced: "INTEGER NOT NULL DEFAULT 0",
  });
  ensureColumns(db, "campaigns", {
    channel: "TEXT NOT NULL DEFAULT 'email'",
    followup_count: "INTEGER NOT NULL DEFAULT 0",
    followup_interval_days: "INTEGER NOT NULL DEFAULT 3",
    send_window_start: "INTEGER",
    send_window_end: "INTEGER",
    ab_test: "INTEGER NOT NULL DEFAULT 0",
  });
  ensureColumns(db, "emails", {
    step: "INTEGER NOT NULL DEFAULT 1",
    scheduled_for: "TEXT",
    open_token: "TEXT",
    opened_at: "TEXT",
    clicked_at: "TEXT",
    replied_at: "TEXT",
    attempts: "INTEGER NOT NULL DEFAULT 0",
    variant: "TEXT NOT NULL DEFAULT ''",
  });

  globalForDb.__outreachDb = db;
  return db;
}

export interface Contact {
  id: number;
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
