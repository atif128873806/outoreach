import crypto from "crypto";
import { q, q1, type Campaign, type Contact, type EmailRow } from "./db";
import { generateMessage } from "./ai";
import { sendMail } from "./mailer";
import { isEmailVerified } from "./auth";
import { getUserPlan } from "./usage";
import { capWithPlan } from "./plans";
import { hourInTimeZone, isHourInWindow } from "./timewindow";
import {
  getSettings,
  getEffectiveDailyCap,
  isSmtpConfigured,
  startOfTodayIso,
  type Settings,
} from "./settings";

let ticking = false;
const capNoticeDay = new Map<number, string>();
const verifyNoticeDay = new Map<number, string>();

// Errors worth retrying: connection/timeout problems, SMTP 4xx "try again
// later" replies, and provider rate limits. Anything else fails permanently.
const TRANSIENT_ERROR_RE =
  /timeout|timed? ?out|econn|etimedout|enotfound|eai_again|ehostunreach|socket|network|fetch failed|greylist|too many|rate.?limit|overloaded|429|421|45[0-2]|5[23]9/i;

// Prevents double-sending if two app instances share one database.
const TICK_LOCK_KEY = 727274;

/** Real SMTP sends made today by this user (simulated sends don't count). */
async function sentTodayCount(userId: number): Promise<number> {
  const row = await q1<{ n: string | number }>(
    `SELECT COUNT(*) n FROM emails
     WHERE user_id = $1 AND status = 'sent' AND via LIKE 'smtp%' AND sent_at >= $2`,
    [userId, startOfTodayIso()]
  );
  return Number(row?.n ?? 0);
}

/**
 * Runs once a minute. Promotes scheduled campaigns whose time has come, then
 * processes the next throttled batch for every running campaign of every user:
 *  - email channel: generate → send (SMTP or simulated) → queue follow-up
 *  - instagram/linkedin: generate → mark "ready" for manual sending
 */
export async function tick(): Promise<void> {
  if (ticking) return; // a slow batch from the previous tick is still going
  ticking = true;
  try {
    // Cross-instance guard: only one process runs a tick at a time.
    const lock = await q1<{ ok: boolean }>(
      "SELECT pg_try_advisory_lock($1) ok",
      [TICK_LOCK_KEY]
    ).catch(() => ({ ok: true })); // PGlite quirk safety — single process anyway
    if (lock && lock.ok === false) return;

    try {
      await q(
        `UPDATE campaigns SET status = 'running'
         WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()`
      );

      const running = await q<Campaign>("SELECT * FROM campaigns WHERE status = 'running'");

      const settingsCache = new Map<number, Settings>();
      for (const campaign of running) {
        let settings = settingsCache.get(campaign.user_id);
        if (!settings) {
          settings = await getSettings(campaign.user_id);
          settingsCache.set(campaign.user_id, settings);
        }
        await processCampaignBatch(campaign, settings);
      }
    } finally {
      await q("SELECT pg_advisory_unlock($1)", [TICK_LOCK_KEY]).catch(() => {});
    }
  } catch (err) {
    console.error("[runner] tick failed:", err);
  } finally {
    ticking = false;
  }
}

function insideSendWindow(campaign: Campaign, settings: Settings): boolean {
  if (campaign.send_window_start == null || campaign.send_window_end == null) {
    return true;
  }
  // Evaluated in the user's configured time zone (server-local when unset).
  const hour = hourInTimeZone(settings.timezone);
  return isHourInWindow(hour, campaign.send_window_start, campaign.send_window_end);
}

async function processCampaignBatch(campaign: Campaign, settings: Settings): Promise<void> {
  const totalPending = Number(
    (
      await q1<{ n: string | number }>(
        "SELECT COUNT(*) n FROM emails WHERE campaign_id = $1 AND status = 'pending'",
        [campaign.id]
      )
    )?.n ?? 0
  );

  if (totalPending === 0) {
    await q("UPDATE campaigns SET status = 'completed' WHERE id = $1 AND status = 'running'", [
      campaign.id,
    ]);
    console.log(`[runner] campaign #${campaign.id} "${campaign.name}" completed`);
    return;
  }

  if (!insideSendWindow(campaign, settings)) return; // outside allowed hours; try next tick

  // Real SMTP sending requires a verified email address (when the instance
  // enforces verification). Simulated sends stay open for testing.
  if (
    campaign.channel === "email" &&
    isSmtpConfigured(settings) &&
    !(await isEmailVerified(campaign.user_id))
  ) {
    const today = new Date().toDateString();
    if (verifyNoticeDay.get(campaign.user_id) !== today) {
      verifyNoticeDay.set(campaign.user_id, today);
      console.log(
        `[runner] user #${campaign.user_id} has not verified their email — real sends are on hold`
      );
    }
    return;
  }

  // throttle_per_hour spread across one-minute ticks
  const batchSize = Math.max(1, Math.round(campaign.throttle_per_hour / 60));

  const batch = await q<EmailRow>(
    `SELECT * FROM emails
     WHERE campaign_id = $1 AND status = 'pending'
       AND (scheduled_for IS NULL OR scheduled_for <= now())
     ORDER BY id LIMIT $2`,
    [campaign.id, batchSize]
  );

  for (const email of batch) {
    // Re-check campaign status each iteration so pause/cancel takes effect mid-batch.
    const current = await q1<{ status: string }>(
      "SELECT status FROM campaigns WHERE id = $1",
      [campaign.id]
    );
    if (!current || current.status !== "running") return;

    const contact = await q1<Contact>("SELECT * FROM contacts WHERE id = $1", [
      email.contact_id,
    ]);
    const skip = (reason: string) =>
      q("UPDATE emails SET status = 'skipped', error = $1 WHERE id = $2", [reason, email.id]);

    if (!contact) {
      await skip("contact no longer exists");
      continue;
    }
    if (contact.unsubscribed) {
      await skip("contact unsubscribed");
      continue;
    }
    if (contact.bounced) {
      await skip("contact email bounced previously");
      continue;
    }
    if (email.step > 1 && contact.replied) {
      await skip("contact replied — follow-up not needed");
      continue;
    }

    // Deliverability + plan: the user's daily cap (with warm-up ramp),
    // bounded by their plan's emails/day, enforced on real sends.
    if (campaign.channel === "email" && isSmtpConfigured(settings)) {
      const plan = await getUserPlan(campaign.user_id);
      const cap = capWithPlan(getEffectiveDailyCap(settings), plan);
      if ((await sentTodayCount(campaign.user_id)) >= cap) {
        const today = new Date().toDateString();
        if (capNoticeDay.get(campaign.user_id) !== today) {
          capNoticeDay.set(campaign.user_id, today);
          console.log(
            `[runner] user #${campaign.user_id} daily send cap reached (${cap}/day) — remaining emails resume tomorrow`
          );
        }
        return; // leave the rest pending until tomorrow
      }
    }

    try {
      // For follow-ups, hand the AI the message we sent last time.
      let prior: { subject: string; body: string } | undefined;
      if (email.step > 1) {
        prior = await q1<{ subject: string; body: string }>(
          `SELECT subject, body FROM emails
           WHERE campaign_id = $1 AND contact_id = $2 AND step = $3 AND status = 'sent'`,
          [campaign.id, contact.id, email.step - 1]
        );
      }

      // A/B subject test: alternate arms deterministically on first-touch emails
      const variant: "A" | "B" | undefined =
        campaign.ab_test && campaign.channel === "email" && email.step === 1
          ? email.id % 2 === 0
            ? "A"
            : "B"
          : undefined;

      const generated = await generateMessage(contact, campaign, {
        step: email.step,
        prior,
        subjectVariant: variant,
        settings,
      });
      const viaSuffix = generated.ai ? "" : "+template";

      if (campaign.channel !== "email") {
        // Drafted for manual sending — Instagram and LinkedIn ban automated cold DMs.
        await q(
          "UPDATE emails SET status = 'ready', subject = $1, body = $2, via = $3 WHERE id = $4",
          [generated.subject, generated.body, "draft" + viaSuffix, email.id]
        );
        console.log(
          `[runner] campaign #${campaign.id} → ${campaign.channel} draft ready for ${
            campaign.channel === "instagram"
              ? `@${contact.instagram || contact.email}`
              : contact.linkedin || contact.email
          }`
        );
        continue;
      }

      const trackToken = crypto.randomBytes(16).toString("hex");
      const result = await sendMail({
        to: contact.email,
        subject: generated.subject,
        body: generated.body,
        unsubToken: contact.unsub_token,
        trackToken,
        settings,
      });
      await q(
        `UPDATE emails SET status = 'sent', subject = $1, body = $2, via = $3,
           sent_at = now(), open_token = $4, variant = $5 WHERE id = $6`,
        [generated.subject, generated.body, result.via + viaSuffix, trackToken, variant ?? "", email.id]
      );
      console.log(
        `[runner] campaign #${campaign.id} step ${email.step} → ${contact.email} (${result.via})`
      );

      // Queue the next follow-up if the sequence has more steps.
      if (email.step <= campaign.followup_count) {
        const dueAt = new Date(
          Date.now() + campaign.followup_interval_days * 24 * 60 * 60 * 1000
        ).toISOString();
        await q(
          `INSERT INTO emails (user_id, campaign_id, contact_id, step, scheduled_for)
           VALUES ($1, $2, $3, $4, $5)`,
          [campaign.user_id, campaign.id, contact.id, email.step + 1, dueAt]
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (email.attempts ?? 0) + 1;
      if (attempts < 3 && TRANSIENT_ERROR_RE.test(message)) {
        // Temporary problem (network, rate limit, greylisting) — back off
        // and let a later tick retry instead of failing the message.
        const retryAt = new Date(Date.now() + attempts * 10 * 60 * 1000).toISOString();
        await q(
          "UPDATE emails SET attempts = $1, error = $2, scheduled_for = $3 WHERE id = $4",
          [attempts, message, retryAt, email.id]
        );
        console.warn(
          `[runner] campaign #${campaign.id} → ${contact.email} transient failure (attempt ${attempts}/3), retrying in ${attempts * 10}m: ${message}`
        );
      } else {
        await q("UPDATE emails SET status = 'failed', error = $1 WHERE id = $2", [
          message,
          email.id,
        ]);
        console.error(`[runner] campaign #${campaign.id} → ${contact.email} FAILED:`, err);
      }
    }
  }
}
