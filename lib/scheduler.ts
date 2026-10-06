import cron from "node-cron";
import { tick } from "./runner";
import { checkAllInboxes } from "./inbox";
import { runWeeklyDigest } from "./watches";
import { isNewBusinessesEnabled, isOutreachEnabled } from "./product";
import { getDb } from "./db";
import { pumpSearchJobs, recoverSearchJobs } from "./search-jobs";

// Survive Next.js hot reloads without stacking duplicate cron jobs.
const globalForCron = globalThis as unknown as { __outreachCron?: boolean };

let tickCount = 0;
let inboxBusy = false;
let digestBusy = false;

/**
 * Runs whatever lead searches are queued.
 *
 * Every ten seconds, and it never waits for a search to finish — a job is fired,
 * counted, and the next tick tops the slots back up as they free. Searching was
 * the one thing on this deployment that blocked a browser for a minute; the
 * queue is what took that out of the request (see lib/search-jobs.ts).
 */
async function pumpJobs(): Promise<void> {
  try {
    await pumpSearchJobs();
  } catch (err) {
    console.error("[scheduler] search queue failed:", err);
  }
}

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

  // Expired claims fail safely; active claims from other workers stay intact.
  const recovered = await recoverSearchJobs().catch(() => 0);

  const outreachOn = isOutreachEnabled();
  if (outreachOn) cron.schedule("* * * * *", () => {
      void tick();
      if (tickCount % 2 === 0) void pollInboxes();
      tickCount++;
    });

  // The search queue, checked often enough that a queued search starts while the
  // user is still on the page — the UI polls every couple of seconds.
  cron.schedule("*/10 * * * * *", () => {
    void pumpJobs();
  });

  // 07:00, before a contractor's first call of the day — but only while the
  // feature it serves is switched on. Parked, the job's sole output would be an
  // email pointing at a page the app redirects away from, so it waits with the
  // feature rather than filling tables nobody can open.
  const digestOn = isNewBusinessesEnabled();
  if (digestOn) {
    cron.schedule("0 7 * * *", () => {
      void runDigest();
    });
  }

  // Also run immediately on boot so due campaigns don't wait a full minute, and
  // so queued searches start now rather than in ten seconds.
  if (outreachOn) {
    void tick();
    void pollInboxes();
  }
  void pumpJobs();

  console.log(
    "[scheduler] started — search queue every 10s" +
      (outreachOn ? ", campaigns every minute, inbox check every 2 minutes" : ", campaigns and inbox polling paused (Outreach is off)") +
      (recovered > 0 ? `, ${recovered} expired search claim(s) recovered` : "") +
      (digestOn ? ", lead digest daily at 07:00" : ", lead digest paused (New businesses is off)")
  );
}
