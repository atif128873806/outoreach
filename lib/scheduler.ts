import cron from "node-cron";
import { tick } from "./runner";
import { checkInbox } from "./inbox";
import { getImapConfig, migrateSecretsAtRest, syncAuthFlag } from "./settings";

// Survive Next.js hot reloads without stacking duplicate cron jobs.
const globalForCron = globalThis as unknown as { __outreachCron?: boolean };

let tickCount = 0;
let inboxBusy = false;

async function pollInbox(): Promise<void> {
  if (inboxBusy || !getImapConfig()) return;
  inboxBusy = true;
  try {
    const result = await checkInbox();
    if (result.ok && (result.replies > 0 || result.bounces > 0)) {
      console.log(
        `[inbox] ${result.replies} new repl${result.replies === 1 ? "y" : "ies"}, ${result.bounces} bounce(s)`
      );
    }
  } finally {
    inboxBusy = false;
  }
}

export function startScheduler(): void {
  if (globalForCron.__outreachCron) return;
  globalForCron.__outreachCron = true;

  // Boot-time housekeeping: encrypt legacy plaintext credentials and make
  // sure the auth flag file matches the stored password hash.
  try {
    migrateSecretsAtRest();
    syncAuthFlag();
  } catch (err) {
    console.error("[scheduler] boot housekeeping failed:", err);
  }

  cron.schedule("* * * * *", () => {
    void tick();
    // Check the inbox for replies/bounces every 2 minutes
    if (tickCount % 2 === 0) void pollInbox();
    tickCount++;
  });

  // Also run immediately on boot so due campaigns don't wait a full minute.
  void tick();
  void pollInbox();

  console.log(
    "[scheduler] started — campaigns every minute, inbox check every 2 minutes"
  );
}
