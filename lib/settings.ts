import { getDb } from "./db";
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  isEncrypted,
  setAuthFlag,
} from "./crypto";

export const SETTING_KEYS = [
  // Sender identity — used by the AI to write messages and by the mailer
  "sender_name",
  "sender_role",
  "company_name",
  "company_description",
  "signature",
  // Email delivery
  "from_email",
  "from_name",
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_pass",
  // Reply detection (IMAP) — empty host/user/pass fall back to SMTP values
  "imap_host",
  "imap_port",
  "imap_user",
  "imap_pass",
  // Deliverability
  "daily_send_cap",
  "warmup_enabled",
  "warmup_started_at",
  // AI providers
  "ai_provider", // "auto" (default) | "anthropic" | "groq"
  "anthropic_api_key",
  "groq_api_key",
  "groq_model",
  // Lead Finder
  "google_places_api_key",
  // Used to build unsubscribe links in outgoing mail
  "base_url",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
export type Settings = Record<SettingKey, string>;

/** Credentials — encrypted at rest and never returned to the browser. */
export const SECRET_SETTING_KEYS: readonly SettingKey[] = [
  "smtp_pass",
  "imap_pass",
  "anthropic_api_key",
  "groq_api_key",
  "google_places_api_key",
] as const;

/** Placeholder the API returns instead of a stored secret. Posting it back means "keep the current value". */
export const SECRET_MASK = "••••••••";

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export function getSettings(): Settings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = {} as Settings;
  for (const key of SETTING_KEYS) {
    const raw = map[key] ?? "";
    out[key] = SECRET_SETTING_KEYS.includes(key) ? decryptSecret(raw) : raw;
  }
  return out;
}

export function saveSettings(values: Partial<Settings>): void {
  const db = getDb();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const tx = db.transaction(() => {
    for (const key of SETTING_KEYS) {
      let v = values[key];
      if (v === undefined) continue;
      if (SECRET_SETTING_KEYS.includes(key)) {
        if (v === SECRET_MASK) continue; // untouched masked field — keep stored value
        v = encryptSecret(v);
      }
      upsert.run(key, v);
    }
  });
  tx();
}

/** One-time migration: encrypt any credentials stored as plaintext by earlier versions. */
export function migrateSecretsAtRest(): void {
  const db = getDb();
  const read = db.prepare("SELECT value FROM settings WHERE key = ?");
  const write = db.prepare("UPDATE settings SET value = ? WHERE key = ?");
  let migrated = 0;
  for (const key of SECRET_SETTING_KEYS) {
    const row = read.get(key) as { value: string } | undefined;
    if (row?.value && !isEncrypted(row.value)) {
      write.run(encryptSecret(row.value), key);
      migrated++;
    }
  }
  if (migrated > 0) {
    console.log(`[settings] encrypted ${migrated} stored credential(s) at rest`);
  }
}

export interface AiConfig {
  provider: "anthropic" | "groq";
  apiKey: string;
  model: string;
}

/**
 * Resolves which AI provider to use. "auto" prefers Anthropic when its key
 * exists, otherwise Groq. An explicit choice is honored strictly — if its
 * key is missing, we fall back to the template engine rather than another
 * provider the user didn't pick.
 */
export function getAiConfig(s: Settings = getSettings()): AiConfig | null {
  const anthropicKey =
    s.anthropic_api_key || process.env.ANTHROPIC_API_KEY || "";
  const groqKey = s.groq_api_key || process.env.GROQ_API_KEY || "";
  const pref = s.ai_provider || "auto";

  if (pref === "anthropic") {
    return anthropicKey
      ? { provider: "anthropic", apiKey: anthropicKey, model: "claude-opus-4-8" }
      : null;
  }
  if (pref === "groq") {
    return groqKey
      ? { provider: "groq", apiKey: groqKey, model: s.groq_model || DEFAULT_GROQ_MODEL }
      : null;
  }
  // auto
  if (anthropicKey) {
    return { provider: "anthropic", apiKey: anthropicKey, model: "claude-opus-4-8" };
  }
  if (groqKey) {
    return { provider: "groq", apiKey: groqKey, model: s.groq_model || DEFAULT_GROQ_MODEL };
  }
  return null;
}

export function isSmtpConfigured(s: Settings = getSettings()): boolean {
  return Boolean(s.smtp_host && s.from_email);
}

// ---------- internal key-value state (not exposed in the settings UI) ----------

export function getKv(key: string): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? "";
}

export function setKv(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

// ---------- app password (login protection) ----------

const APP_PASSWORD_KEY = "app_password_hash";

export function isAuthEnabled(): boolean {
  return Boolean(getKv(APP_PASSWORD_KEY));
}

export function getAppPasswordHash(): string {
  return getKv(APP_PASSWORD_KEY);
}

export function setAppPassword(password: string): void {
  setKv(APP_PASSWORD_KEY, hashPassword(password));
  setAuthFlag(true);
}

export function removeAppPassword(): void {
  setKv(APP_PASSWORD_KEY, "");
  setAuthFlag(false);
}

/** Keeps the flag file (read by proxy.ts) in step with the DB, e.g. after a restore. */
export function syncAuthFlag(): void {
  setAuthFlag(isAuthEnabled());
}

// ---------- IMAP (reply detection) ----------

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/** IMAP config; host/user/pass fall back to the SMTP mailbox. */
export function getImapConfig(s: Settings = getSettings()): ImapConfig | null {
  const host = s.imap_host || s.smtp_host;
  const user = s.imap_user || s.smtp_user;
  const pass = s.imap_pass || s.smtp_pass;
  if (!host || !user || !pass) return null;
  return { host, port: parseInt(s.imap_port || "993", 10), user, pass };
}

// ---------- deliverability: daily cap + warm-up ramp ----------

const WARMUP_RAMP = [10, 25, 40]; // week 1, 2, 3 — week 4+ uses the full cap

/**
 * How many real (SMTP) emails may be sent today. Warm-up mode ramps the cap
 * over the first weeks of a new sender so the domain builds reputation.
 */
export function getEffectiveDailyCap(s: Settings = getSettings()): number {
  const cap = Math.max(1, parseInt(s.daily_send_cap || "50", 10) || 50);
  if (s.warmup_enabled !== "true" || !s.warmup_started_at) return cap;
  const started = new Date(s.warmup_started_at).getTime();
  if (isNaN(started)) return cap;
  const week = Math.floor((Date.now() - started) / (7 * 24 * 60 * 60 * 1000));
  if (week >= WARMUP_RAMP.length) return cap;
  return Math.min(cap, WARMUP_RAMP[week]);
}

/** ISO timestamp for the start of the current local day. */
export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
