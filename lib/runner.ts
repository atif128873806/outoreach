import crypto from "crypto";
import { getDb, type Campaign, type Contact, type EmailRow } from "./db";
import { generateMessage } from "./ai";
import { sendMail } from "./mailer";
import {
  getSettings,
  getEffectiveDailyCap,
  isSmtpConfigured,
  startOfTodayIso,
} from "./settings";

let ticking = false;
let capNoticeDay = "";

// Errors worth retrying: connection/timeout problems, SMTP 4xx "try again
// later" replies, and provider rate limits. Anything else fails permanently.
const TRANSIENT_ERROR_RE =
  /timeout|timed? ?out|econn|etimedout|enotfound|eai_again|ehostunreach|socket|network|fetch failed|greylist|too many|rate.?limit|overloaded|429|421|45[0-2]|5[23]9/i;

/** Real SMTP sends made today (simulated sends don't count against the cap). */
function sentTodayCount(): number {
  const db = getDb();
  return (
    db
      .prepare(
        "SELECT COUNT(*) n FROM emails WHERE status = 'sent' AND via LIKE 'smtp%' AND sent_at >= ?"
      )
      .get(startOfTodayIso()) as { n: number }
  ).n;
}

/**
 * Runs once a minute. Promotes scheduled campaigns whose time has come,
 * then processes the next throttled batch for every running campaign:
 *  - email channel: generate → send (SMTP or simulated) → queue follow-up
 *  - instagram channel: generate → mark "ready" for manual sending in the Message Center
 */
export async function tick(): Promise<void> {
  if (ticking) return; // a slow batch from the previous tick is still going
  ticking = true;
  try {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(
      "UPDATE campaigns SET status = 'running' WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?"
    ).run(now);

    const running = db
      .prepare("SELECT * FROM campaigns WHERE status = 'running'")
      .all() as Campaign[];

    for (const campaign of running) {
      await processCampaignBatch(campaign);
    }
  } catch (err) {
    console.error("[runner] tick failed:", err);
  } finally {
    ticking = false;
  }
}

function insideSendWindow(campaign: Campaign): boolean {
  if (campaign.send_window_start == null || campaign.send_window_end == null) {
    return true;
  }
  const hour = new Date().getHours(); // server-local time
  const { send_window_start: start, send_window_end: end } = campaign;
  // Window may wrap midnight, e.g. 20 → 6
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

async function processCampaignBatch(campaign: Campaign): Promise<void> {
  const db = getDb();
  const settings = getSettings();
  const now = new Date().toISOString();

  const totalPending = (
    db
      .prepare(
        "SELECT COUNT(*) n FROM emails WHERE campaign_id = ? AND status = 'pending'"
      )
      .get(campaign.id) as { n: number }
  ).n;

  if (totalPending === 0) {
    db.prepare(
      "UPDATE campaigns SET status = 'completed' WHERE id = ? AND status = 'running'"
    ).run(campaign.id);
    console.log(`[runner] campaign #${campaign.id} "${campaign.name}" completed`);
    return;
  }

  if (!insideSendWindow(campaign)) return; // outside allowed hours; try next tick

  // throttle_per_hour spread across one-minute ticks
  const batchSize = Math.max(1, Math.round(campaign.throttle_per_hour / 60));

  const batch = db
    .prepare(
      `SELECT * FROM emails
       WHERE campaign_id = ? AND status = 'pending'
         AND (scheduled_for IS NULL OR scheduled_for <= ?)
       ORDER BY id LIMIT ?`
    )
    .all(campaign.id, now, batchSize) as EmailRow[];

  const getContact = db.prepare("SELECT * FROM contacts WHERE id = ?");
  const markSkipped = db.prepare(
    "UPDATE emails SET status = 'skipped', error = ? WHERE id = ?"
  );
  const markSent = db.prepare(
    "UPDATE emails SET status = 'sent', subject = ?, body = ?, via = ?, sent_at = ?, open_token = ?, variant = ? WHERE id = ?"
  );
  const markReady = db.prepare(
    "UPDATE emails SET status = 'ready', subject = ?, body = ?, via = ? WHERE id = ?"
  );
  const markFailed = db.prepare(
    "UPDATE emails SET status = 'failed', error = ? WHERE id = ?"
  );
  const retryLater = db.prepare(
    "UPDATE emails SET attempts = ?, error = ?, scheduled_for = ? WHERE id = ?"
  );
  const queueFollowup = db.prepare(
    "INSERT INTO emails (campaign_id, contact_id, step, scheduled_for) VALUES (?, ?, ?, ?)"
  );

  for (const email of batch) {
    // Re-check campaign status each iteration so pause/cancel takes effect mid-batch.
    const current = db
      .prepare("SELECT status FROM campaigns WHERE id = ?")
      .get(campaign.id) as { status: string } | undefined;
    if (!current || current.status !== "running") return;

    const contact = getContact.get(email.contact_id) as Contact | undefined;
    if (!contact) {
      markSkipped.run("contact no longer exists", email.id);
      continue;
    }
    if (contact.unsubscribed) {
      markSkipped.run("contact unsubscribed", email.id);
      continue;
    }
    if (contact.bounced) {
      markSkipped.run("contact email bounced previously", email.id);
      continue;
    }
    if (email.step > 1 && contact.replied) {
      markSkipped.run("contact replied — follow-up not needed", email.id);
      continue;
    }

    // Deliverability: enforce the daily cap (with warm-up ramp) on real sends.
    if (campaign.channel === "email" && isSmtpConfigured(settings)) {
      const cap = getEffectiveDailyCap(settings);
      if (sentTodayCount() >= cap) {
        const today = new Date().toDateString();
        if (capNoticeDay !== today) {
          capNoticeDay = today;
          console.log(
            `[runner] daily send cap reached (${cap}/day) — remaining emails resume tomorrow`
          );
        }
        return; // leave the rest pending until tomorrow
      }
    }

    try {
      // For follow-ups, hand the AI the message we sent last time.
      let prior: { subject: string; body: string } | undefined;
      if (email.step > 1) {
        prior = db
          .prepare(
            `SELECT subject, body FROM emails
             WHERE campaign_id = ? AND contact_id = ? AND step = ? AND status = 'sent'`
          )
          .get(campaign.id, contact.id, email.step - 1) as
          | { subject: string; body: string }
          | undefined;
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
        markReady.run(generated.subject, generated.body, "draft" + viaSuffix, email.id);
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
      markSent.run(
        generated.subject,
        generated.body,
        result.via + viaSuffix,
        new Date().toISOString(),
        trackToken,
        variant ?? "",
        email.id
      );
      console.log(
        `[runner] campaign #${campaign.id} step ${email.step} → ${contact.email} (${result.via})`
      );

      // Queue the next follow-up if the sequence has more steps.
      if (email.step <= campaign.followup_count) {
        const dueAt = new Date(
          Date.now() + campaign.followup_interval_days * 24 * 60 * 60 * 1000
        ).toISOString();
        queueFollowup.run(campaign.id, contact.id, email.step + 1, dueAt);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (email.attempts ?? 0) + 1;
      if (attempts < 3 && TRANSIENT_ERROR_RE.test(message)) {
        // Temporary problem (network, rate limit, greylisting) — back off
        // and let a later tick retry instead of failing the message.
        const retryAt = new Date(Date.now() + attempts * 10 * 60 * 1000).toISOString();
        retryLater.run(attempts, message, retryAt, email.id);
        console.warn(
          `[runner] campaign #${campaign.id} → ${contact.email} transient failure (attempt ${attempts}/3), retrying in ${attempts * 10}m: ${message}`
        );
      } else {
        markFailed.run(message, email.id);
        console.error(
          `[runner] campaign #${campaign.id} → ${contact.email} FAILED:`,
          err
        );
      }
    }
  }
}
