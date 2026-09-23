/**
 * Saved searches that report what is new: the storage and the register calls.
 *
 * The rules live in lib/digest.ts (dependency-free, unit-tested). This module is
 * the part that touches a database and the network, so it stays thin: read the
 * watches, ask the register for the window, remember what came back, and mark
 * which of it the user has looked at yet.
 *
 * Why the register and nothing else: it is the only source with a date. It
 * publishes companies *by incorporation date*, so "new since you last looked" is
 * a question it can answer. OpenStreetMap and the open web have no such stamp — a
 * business that appears there this week may have been trading for a decade.
 */

import { q, q1 } from "./db";
import { searchCompaniesHouse, CompaniesHouseError } from "./companieshouse";
import type { Lead } from "./leads";
import { SOURCE_META, instanceKey } from "./sources";
import { isSystemMailerConfigured, sendDigestEmail } from "./system-mailer";
import {
  DIGEST_LIMIT,
  DIGEST_MAX_DAYS,
  digestByAccount,
  memoryCutoff,
  newCompanies,
  watchWindow,
  type WatchReport,
} from "./digest";

export interface WatchRow {
  id: number;
  user_id: number;
  niche: string;
  location: string;
  created_at: string;
  checked_through: string;
  last_checked_at: string | null;
  unseen_count: number;
  last_error: string;
}

/** The three fields an email needs about a company it is announcing. */
export interface FreshCompany {
  business_name: string;
  company_number: string;
  incorporated_on: string;
}

export interface WatchCompanyRow {
  company_number: string;
  business_name: string;
  address: string;
  notes: string;
  directors: string;
  incorporated_on: string;
  seen: number;
  found_at: string;
}

export async function listWatches(userId: number): Promise<WatchRow[]> {
  return q<WatchRow>(
    "SELECT * FROM lead_watches WHERE user_id = $1 ORDER BY created_at ASC",
    [userId]
  );
}

/** Adds a watch, or returns null when the same niche and place is already watched. */
export async function addWatch(
  userId: number,
  niche: string,
  location: string
): Promise<WatchRow | null> {
  const cleanNiche = niche.trim().slice(0, 80);
  const cleanLocation = location.trim().slice(0, 80);
  if (!cleanNiche || !cleanLocation) return null;

  await q(
    `INSERT INTO lead_watches (user_id, niche, location)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, niche, location) DO NOTHING`,
    [userId, cleanNiche, cleanLocation]
  );
  return (
    (await q1<WatchRow>(
      "SELECT * FROM lead_watches WHERE user_id = $1 AND niche = $2 AND location = $3",
      [userId, cleanNiche, cleanLocation]
    )) ?? null
  );
}

export async function removeWatch(userId: number, id: number): Promise<void> {
  await q("DELETE FROM lead_watches WHERE user_id = $1 AND id = $2", [userId, id]);
}

/** Whether this deployment can run the digest at all (it needs the register key). */
export function registerConfigured(): boolean {
  return Boolean(instanceKey(SOURCE_META.companies_house));
}

/**
 * Checks one watch against the register and records what is new.
 *
 * The window comes from `checked_through`, which is moved forward only after a
 * successful check — a failed run must not skip the companies it failed to see.
 */
export async function checkWatch(
  watch: WatchRow,
  now: number = Date.now()
): Promise<{ found: number; error: string; companies: FreshCompany[] }> {
  const key = instanceKey(SOURCE_META.companies_house);
  if (!key) {
    return { found: 0, error: "companies_house_not_configured", companies: [] };
  }

  const window = watchWindow(
    { checkedThrough: watch.checked_through, lastCheckedAt: watch.last_checked_at },
    now
  );

  let leads: Lead[];
  try {
    leads = await searchCompaniesHouse(watch.niche, watch.location, DIGEST_LIMIT, key, {
      incorporatedFrom: window.since,
      // See CompaniesHouseOptions.officers: a weekly job across every account
      // cannot spend one officer lookup per company the way a single search can.
      officers: 10,
    });
  } catch (err) {
    const message =
      err instanceof CompaniesHouseError
        ? err.message
        : err instanceof Error
          ? err.message.slice(0, 200)
          : "unknown error";
    await q("UPDATE lead_watches SET last_error = $1 WHERE id = $2", [message, watch.id]);
    return { found: 0, error: message, companies: [] };
  }

  const known = await q<{ company_number: string }>(
    "SELECT company_number FROM lead_watch_companies WHERE watch_id = $1",
    [watch.id]
  );
  const fresh = newCompanies(leads, new Set(known.map((r) => r.company_number)));

  for (const lead of fresh) {
    await q(
      `INSERT INTO lead_watch_companies
         (watch_id, company_number, business_name, address, notes, directors, incorporated_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (watch_id, company_number) DO NOTHING`,
      [
        watch.id,
        lead.company_number ?? "",
        lead.business_name,
        lead.address,
        lead.notes,
        (lead.directors ?? []).join(", "),
        lead.incorporated_on ?? "",
      ]
    );
  }

  // Forget companies older than the memory window: a check can never ask about a
  // range that long, so remembering them is only storage growth.
  await q("DELETE FROM lead_watch_companies WHERE watch_id = $1 AND found_at < $2", [
    watch.id,
    memoryCutoff(now),
  ]);

  await q(
    `UPDATE lead_watches
        SET checked_through = $1,
            last_checked_at = now(),
            last_error = '',
            unseen_count = (SELECT count(*) FROM lead_watch_companies WHERE watch_id = $2 AND seen = 0)
      WHERE id = $2`,
    [new Date(now).toISOString(), watch.id]
  );

  return {
    found: fresh.length,
    error: "",
    companies: fresh.map((l) => ({
      business_name: l.business_name,
      company_number: l.company_number ?? "",
      incorporated_on: l.incorporated_on ?? "",
    })),
  };
}

/**
 * Checks a user's watches, skipping any that were checked in the last few
 * minutes unless `force`.
 *
 * The skip is what keeps a page reload from spending register requests: opening
 * the digest twice in a minute cannot tell you anything the first look did not,
 * and the register's allowance is shared by every account on the deployment.
 */
export async function checkUserWatches(
  userId: number,
  opts: { force?: boolean; now?: number } = {}
): Promise<{ checked: number; found: number; errors: string[] }> {
  const now = opts.now ?? Date.now();
  const watches = await listWatches(userId);
  const errors: string[] = [];
  let checked = 0;
  let found = 0;

  for (const watch of watches) {
    const last = watch.last_checked_at ? Date.parse(watch.last_checked_at) : NaN;
    const justChecked = Number.isFinite(last) && now - last < 10 * 60 * 1000;
    if (justChecked && !opts.force) continue;

    const result = await checkWatch(watch, now);
    checked++;
    found += result.found;
    if (result.error) errors.push(`${watch.niche} in ${watch.location}: ${result.error}`);
    // Two register requests a second is the deployment's half of the register's
    // 600-per-5-minutes allowance, shared by every account.
    await new Promise((r) => setTimeout(r, 400));
  }

  return { checked, found, errors };
}

/**
 * Every watch with what it has found recently, newest first.
 *
 * Deliberately *not* filtered to `seen = 0`. A company the user has already
 * looked at is still the reason they opened this page, and dropping it the
 * moment the badge clears would empty the list on the very visit that was meant
 * to show it — the page would say "nothing new" seconds after a check found
 * five companies. The rows carry their `seen` flag instead, so the page can mark
 * the unread ones and the badge keeps meaning "unread".
 *
 * Rows are bounded by the same retention window that prunes them (45 days, see
 * DIGEST_MEMORY_DAYS), and each check stores at most DIGEST_LIMIT companies.
 */
export async function unseenDigest(
  userId: number
): Promise<{ watch: WatchRow; companies: WatchCompanyRow[] }[]> {
  const watches = await listWatches(userId);
  const out: { watch: WatchRow; companies: WatchCompanyRow[] }[] = [];
  for (const watch of watches) {
    const companies = await q<WatchCompanyRow>(
      `SELECT company_number, business_name, address, notes, directors, incorporated_on, seen, found_at
         FROM lead_watch_companies
        WHERE watch_id = $1
        ORDER BY seen ASC, incorporated_on DESC, business_name ASC
        LIMIT 200`,
      [watch.id]
    );
    out.push({ watch, companies });
  }
  return out;
}

/** The total the sidebar shows, read from a stored counter rather than the register. */
export async function unseenTotal(userId: number): Promise<number> {
  const row = await q1<{ total: string }>(
    "SELECT COALESCE(sum(unseen_count), 0) AS total FROM lead_watches WHERE user_id = $1",
    [userId]
  );
  return Number(row?.total ?? 0);
}

/** Clears the badge: the user has looked at what is waiting. */
export async function markSeen(userId: number): Promise<void> {
  await q(
    `UPDATE lead_watch_companies SET seen = 1
      WHERE watch_id IN (SELECT id FROM lead_watches WHERE user_id = $1) AND seen = 0`,
    [userId]
  );
  await q("UPDATE lead_watches SET unseen_count = 0 WHERE user_id = $1", [userId]);
}

/**
 * Every watch on the deployment that is due a check, for the weekly job.
 *
 * A watch whose owner has not looked in months is still worth checking — the
 * email is what brings them back — so this is not filtered by activity, only by
 * how many are taken at once.
 */
export async function dueWatches(limit = 200): Promise<WatchRow[]> {
  return q<WatchRow>(
    `SELECT * FROM lead_watches
      WHERE last_checked_at IS NULL OR last_checked_at < now() - interval '${DIGEST_MAX_DAYS} days'
      ORDER BY COALESCE(last_checked_at, created_at) ASC
      LIMIT $1`,
    [limit]
  );
}

/**
 * The weekly job: check every watch that is due, then tell each owner once.
 *
 * One email per account rather than one per watch — five watches producing nine
 * companies is one message a person reads, not five they filter. The email only
 * goes to accounts that actually have something new: a weekly "nothing happened"
 * message is how a product teaches people to ignore it.
 */
export async function runWeeklyDigest(limit = 200): Promise<{
  checked: number;
  found: number;
  /** Emails that actually left the building — not the ones we tried to send. */
  emailed: number;
  /** Accounts with something new that could not be told, because no mailer is set. */
  notEmailed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  if (!registerConfigured()) {
    // Nothing to do on a deployment without the register key — and no point
    // writing a failure onto every watch, which is what checking them would do.
    return { checked: 0, found: 0, emailed: 0, notEmailed: 0, errors };
  }

  const due = await dueWatches(limit);
  const reports: (WatchReport & { companies: FreshCompany[] })[] = [];
  let checked = 0;
  let found = 0;

  for (const watch of due) {
    const result = await checkWatch(watch);
    checked++;
    found += result.found;
    if (result.error) errors.push(`${watch.niche} in ${watch.location}: ${result.error}`);
    reports.push({
      userId: watch.user_id,
      niche: watch.niche,
      location: watch.location,
      companies: result.companies,
    });
    // The deployment's half of the register's 600-requests-per-5-minutes
    // allowance, shared with every user's own searches.
    await new Promise((r) => setTimeout(r, 400));
  }

  // One email per account, and only where something was actually registered.
  const perUser = digestByAccount(reports);

  let emailed = 0;
  let notEmailed = 0;
  for (const [userId, watches] of perUser) {
    const user = await q1<{ email: string; name: string }>(
      "SELECT email, name FROM users WHERE id = $1",
      [userId]
    );
    if (!user?.email) continue;
    const total = watches.reduce((n, w) => n + w.companies.length, 0);
    // The rows are already stored, so nothing is lost — but the count has to be
    // honest, because "0 emails" is a problem worth knowing about and "sent"
    // would not be. The reason is read from the config rather than assumed: a
    // rejected message and a missing SMTP host are different failures, and this
    // job once blamed the config for a server that had simply said no.
    if (await sendDigestEmail(user.email, user.name, watches, total)) emailed++;
    else {
      notEmailed++;
      errors.push(
        `digest email to ${user.email} failed: ${
          isSystemMailerConfigured()
            ? "the mailer rejected the message (error above)"
            : "no system mailer is configured (SYSTEM_SMTP_*)"
        }`
      );
    }
  }

  return { checked, found, emailed, notEmailed, errors };
}
