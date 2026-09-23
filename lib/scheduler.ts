import cron from "node-cron";
import { tick } from "./runner";
import { checkAllInboxes } from "./inbox";
import { runWeeklyDigest } from "./watches";
import { getDb } from "./db";

// Survive Next.js hot reloads without stacking duplicate cron jobs.
const globalForCron = globalThis as unknown as { __outreachCron?: boolean };

let tickCount = 0;
let inboxBusy = false;
let digestBusy = false;

async function pollInboxes(): Promise<void> {
  if (inboxBusy) return;
  inboxBusy = true;
  try {
    await checkAllInboxes();
  } catch (err) {
    console.error("[scheduler] inbox poll failed:", err);
  } finally {
    inboxBusy = false;
  }
}

/**
 * The "new businesses in your niches" job.
 *
 * It runs *daily*, not weekly, and that is the point: a watch becomes due when
 * its own last check is seven days old (see dueWatches), so each account is
 * still covered once a week — but a deploy, a restart, or a night of downtime
 * can no longer move everyone's digest to the same skipped day. "Weekly" here
 * means seven days since you last heard something, which is what a user
 * actually notices.
 */
async function runDigest(): Promise<void> {
  if (digestBusy) return;
  digestBusy = true;
  try {
    const r = await runWeeklyDigest();
    console.log(
      `[scheduler] digest: ${r.checked} watch(es) checked, ${r.found} new, ${r.emailed} email(s) sent` +
        // Said as a count here; the reason per account is in the errors below,
        // because guessing at the cause is how a log lies to you.
        (r.notEmailed > 0 ? `, ${r.notEmailed} not delivered` : "")
    );
    for (const err of r.errors) console.error("[scheduler] digest:", err);
  } catch (err) {
    console.error("[scheduler] digest failed:", err);
  } finally {
    digestBusy = false;
  }
}

export async function startScheduler(): Promise<void> {
  if (globalForCron.__outreachCron) return;
  globalForCron.__outreachCron = true;

  await getDb(); // connect + run schema before the first tick

  cron.schedule("* * * * *", () => {
    void tick();
    // Check inboxes for replies/bounces every 2 minutes
    if (tickCount % 2 === 0) void pollInboxes();
    tickCount++;
  });

  // 07:00, before a contractor's first call of the day.
  cron.schedule("0 7 * * *", () => {
    void runDigest();
  });

  // Also run immediately on boot so due campaigns don't wait a full minute.
  void tick();
  void pollInboxes();

  console.log(
    "[scheduler] started — campaigns every minute, inbox check every 2 minutes, lead digest daily at 07:00"
  );
}
