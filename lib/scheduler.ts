import cron from "node-cron";
import { tick } from "./runner";
import { checkAllInboxes } from "./inbox";
import { getDb } from "./db";

// Survive Next.js hot reloads without stacking duplicate cron jobs.
const globalForCron = globalThis as unknown as { __outreachCron?: boolean };

let tickCount = 0;
let inboxBusy = false;

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

  // Also run immediately on boot so due campaigns don't wait a full minute.
  void tick();
  void pollInboxes();

  console.log(
    "[scheduler] started — campaigns every minute, inbox check every 2 minutes"
  );
}
