import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { encryptSecret, isEncrypted } from "./crypto";
import { SETTING_KEYS, SECRET_SETTING_KEYS, type SettingKey } from "./settings";

/**
 * One-time import of the pre-multi-user SQLite database (data/outreach.db)
 * into Postgres, owned by the given user. Runs when the FIRST account signs
 * up, so an existing single-user install keeps its contacts, campaigns,
 * history, and settings. The SQLite file is renamed afterwards so the import
 * can never run twice.
 */

const LEGACY_DB = path.join(process.cwd(), "data", "outreach.db");

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null ? 0 : Number(v));
const t = (v: unknown) => (v ? String(v) : null); // timestamps

export async function importLegacySqlite(userId: number): Promise<string | null> {
  if (!fs.existsSync(LEGACY_DB)) return null;

  let Database: typeof import("better-sqlite3");
  try {
    Database = (await import("better-sqlite3")).default as unknown as typeof import("better-sqlite3");
  } catch {
    console.warn("[legacy-import] better-sqlite3 unavailable — skipping import");
    return null;
  }

  const sqlite = new Database(LEGACY_DB, { readonly: true });
  const db = await getDb();

  try {
    const contacts = sqlite.prepare("SELECT * FROM contacts").all() as Row[];
    const campaigns = sqlite.prepare("SELECT * FROM campaigns").all() as Row[];
    const emails = sqlite.prepare("SELECT * FROM emails").all() as Row[];
    let replies: Row[] = [];
    try {
      replies = sqlite.prepare("SELECT * FROM replies").all() as Row[];
    } catch {
      /* older schema without replies */
    }
    const settings = sqlite.prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];

    await db.transaction(async (tx) => {
      const contactMap = new Map<number, number>();
      for (const c of contacts) {
        const rows = await tx.query<{ id: number }>(
          `INSERT INTO contacts (user_id, email, business_name, category, website, instagram,
             linkedin, phone, notes, replied, bounced, unsubscribed, unsub_token)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (user_id, email) DO NOTHING RETURNING id`,
          [
            userId, s(c.email), s(c.business_name), s(c.category), s(c.website),
            s(c.instagram), s(c.linkedin), s(c.phone), s(c.notes),
            n(c.replied), n(c.bounced), n(c.unsubscribed), s(c.unsub_token),
          ]
        );
        if (rows[0]) contactMap.set(n(c.id), rows[0].id);
      }

      const campaignMap = new Map<number, number>();
      for (const c of campaigns) {
        const rows = await tx.query<{ id: number }>(
          `INSERT INTO campaigns (user_id, name, description, tone, channel, category_filter,
             scheduled_at, throttle_per_hour, followup_count, followup_interval_days,
             send_window_start, send_window_end, ab_test, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [
            userId, s(c.name), s(c.description), s(c.tone), s(c.channel) || "email",
            s(c.category_filter), t(c.scheduled_at), n(c.throttle_per_hour) || 60,
            n(c.followup_count), n(c.followup_interval_days) || 3,
            c.send_window_start == null ? null : n(c.send_window_start),
            c.send_window_end == null ? null : n(c.send_window_end),
            n(c.ab_test), s(c.status) || "completed",
          ]
        );
        campaignMap.set(n(c.id), rows[0].id);
      }

      for (const e of emails) {
        const campaignId = campaignMap.get(n(e.campaign_id));
        const contactId = contactMap.get(n(e.contact_id));
        if (!campaignId || !contactId) continue;
        await tx.query(
          `INSERT INTO emails (user_id, campaign_id, contact_id, step, scheduled_for, subject,
             body, status, via, error, attempts, variant, sent_at, open_token, opened_at,
             clicked_at, replied_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            userId, campaignId, contactId, n(e.step) || 1, t(e.scheduled_for), s(e.subject),
            s(e.body), s(e.status) || "pending", s(e.via), s(e.error), n(e.attempts),
            s(e.variant), t(e.sent_at), e.open_token ? s(e.open_token) : null,
            t(e.opened_at), t(e.clicked_at), t(e.replied_at),
          ]
        );
      }

      for (const r of replies) {
        const contactId = contactMap.get(n(r.contact_id));
        if (!contactId) continue;
        await tx.query(
          `INSERT INTO replies (user_id, contact_id, from_email, subject, snippet,
             classification, suggested_reply, handled)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [userId, contactId, s(r.from_email), s(r.subject), s(r.snippet),
           s(r.classification), s(r.suggested_reply), n(r.handled)]
        );
      }

      const validKeys = new Set<string>(SETTING_KEYS);
      for (const row of settings) {
        // Carry over the internal imap_* cursor keys too; drop app_password_hash
        if (!validKeys.has(row.key) && !row.key.startsWith("imap_last")) continue;
        let value = row.value;
        if (
          SECRET_SETTING_KEYS.includes(row.key as SettingKey) &&
          value &&
          !isEncrypted(value)
        ) {
          value = encryptSecret(value);
        }
        await tx.query(
          `INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
          [userId, row.key, value]
        );
      }
    });

    sqlite.close();
    fs.renameSync(LEGACY_DB, LEGACY_DB + ".imported");
    for (const suffix of ["-wal", "-shm"]) {
      fs.rmSync(LEGACY_DB + suffix, { force: true });
    }

    const summary = `${contacts.length} contacts, ${campaigns.length} campaigns, ${emails.length} messages, ${settings.length} settings`;
    console.log(`[legacy-import] imported ${summary} for user #${userId}`);
    return summary;
  } catch (err) {
    sqlite.close();
    console.error("[legacy-import] failed (data left untouched):", err);
    return null;
  }
}
