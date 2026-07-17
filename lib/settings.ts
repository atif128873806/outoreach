import { q, q1, getDb } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

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
  // IANA zone (e.g. "America/New_York") that send windows are evaluated in;
  // empty = server-local time
  "timezone",
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

export async function getSettings(userId: number): Promise<Settings> {
  const rows = await q<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE user_id = $1",
    [userId]
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = {} as Settings;
  for (const key of SETTING_KEYS) {
    const raw = map[key] ?? "";
    out[key] = SECRET_SETTING_KEYS.includes(key) ? decryptSecret(raw) : raw;
  }
  return out;
}

export async function saveSettings(userId: number, values: Partial<Settings>): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const key of SETTING_KEYS) {
      let v = values[key];
      if (v === undefined) continue;
      if (SECRET_SETTING_KEYS.includes(key)) {
        if (v === SECRET_MASK) continue; // untouched masked field — keep stored value
        v = encryptSecret(v);
      }
      await tx.query(
        `INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [userId, key, v]
      );
    }
  });
}

export interface AiConfig {
  provider: "anthropic" | "groq";
  apiKey: string;
  model: string;
  /** true when the key is the instance's global env key, not the user's own — subject to the daily quota */
  global: boolean;
}

/**
 * Resolves which AI provider to use.
 *
 * "auto" (shown in the UI as "Free AI (included)") means the INSTANCE's
 * global key — a personal key stored in Settings must never override it,
 * otherwise a bad personal key silently breaks the free path the user chose.
 * Explicit choices ("anthropic"/"groq") use the user's own key, with the env
 * key as fallback; if neither exists we fall back to the template engine
 * rather than a provider the user didn't pick.
 */
export function getAiConfig(s: Settings): AiConfig | null {
  const envAnthropic = process.env.ANTHROPIC_API_KEY || "";
  const envGroq = process.env.GROQ_API_KEY || "";
  const pref = s.ai_provider || "auto";

  const groq = (apiKey: string, global: boolean): AiConfig => ({
    provider: "groq",
    apiKey,
    model: s.groq_model || DEFAULT_GROQ_MODEL,
    global,
  });
  const anthropic = (apiKey: string, global: boolean): AiConfig => ({
    provider: "anthropic",
    apiKey,
    model: "claude-opus-4-8",
    global,
  });

  if (pref === "anthropic") {
    const key = s.anthropic_api_key || envAnthropic;
    return key ? anthropic(key, !s.anthropic_api_key) : null;
  }
  if (pref === "groq") {
    const key = s.groq_api_key || envGroq;
    return key ? groq(key, !s.groq_api_key) : null;
  }
  // "auto" = the included free AI: instance keys first, always.
  if (envGroq) return groq(envGroq, true);
  if (envAnthropic) return anthropic(envAnthropic, true);
  // Self-hosted instance without global keys — use whatever the user stored.
  if (s.groq_api_key) return groq(s.groq_api_key, false);
  if (s.anthropic_api_key) return anthropic(s.anthropic_api_key, false);
  return null;
}

export function isSmtpConfigured(s: Settings): boolean {
  return Boolean(s.smtp_host && s.from_email);
}

// ---------- internal per-user key-value state (not exposed in the settings UI) ----------

export async function getKv(userId: number, key: string): Promise<string> {
  const row = await q1<{ value: string }>(
    "SELECT value FROM settings WHERE user_id = $1 AND key = $2",
    [userId, key]
  );
  return row?.value ?? "";
}

export async function setKv(userId: number, key: string, value: string): Promise<void> {
  await q(
    `INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [userId, key, value]
  );
}

// ---------- IMAP (reply detection) ----------

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/** IMAP config; host/user/pass fall back to the SMTP mailbox. */
export function getImapConfig(s: Settings): ImapConfig | null {
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
export function getEffectiveDailyCap(s: Settings): number {
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
