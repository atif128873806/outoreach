/**
 * The weekly "what is new in your searches" rules.
 *
 * Kept dependency-free (like lib/niches.ts, lib/scrape.ts and lib/geo.ts) so the
 * test suite can import it directly. Every rule here decides what a user is told
 * is *new*, and both directions of a mistake are bad: a company reported twice
 * makes the digest untrustworthy, and one that is silently skipped is a lead the
 * user never learns about.
 *
 * The register is the source because it is the only one with a date: it publishes
 * companies by incorporation date, so "new since I last looked" is a question it
 * can actually answer. OpenStreetMap and the open web have no such stamp — a
 * business that appears there this week may have existed for years.
 */

/** The most a single check will ask the register for. */
export const DIGEST_LIMIT = 50;

/**
 * How far back a first check looks, and the cap on any gap.
 *
 * A watch created now has nothing to catch up on, so the first run covers the
 * last week rather than showing a user every company of the past two years as
 * "new". The same ceiling applies when a deployment has been down or a check has
 * failed for a while: catching up on a month is useful, catching up on a year is
 * a thousand-item list nobody reads.
 */
export const DIGEST_MAX_DAYS = 7;

/**
 * How long a reported company is remembered for deduplication.
 *
 * Comfortably longer than the window a check can ask about (DIGEST_MAX_DAYS), so
 * a company cannot fall out of memory while it is still inside the range the
 * register is being asked for. Anything shorter would let a business be reported
 * twice after a long gap.
 */
export const DIGEST_MEMORY_DAYS = 45;

export interface DigestWindow {
  /** ISO date (YYYY-MM-DD) to ask the register from. */
  since: string;
  /** How many days that covers, after clamping. */
  days: number;
  /**
   * True when this is the watch's first check — worth wording differently, since
   * nothing is "new" to someone who has never looked.
   */
  first: boolean;
  /**
   * True when the real gap was longer than the cap and has been shortened. The
   * UI says so, because otherwise a user who was away for a month sees a week of
   * companies and believes that is all there was.
   */
  truncated: boolean;
}

/** Midnight UTC, `days` before `now`, as YYYY-MM-DD — the register's date format. */
function isoDaysBefore(now: number, days: number): string {
  const d = new Date(now - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * The window to ask the register about.
 *
 * `checkedThrough` is the moment the last check covered up to, so a company
 * incorporated in between cannot be missed by a clock skew or a slow run. An
 * unparseable or future date is treated as "now" rather than trusted: the failure
 * mode of trusting it is either a flood of old companies or a window that never
 * advances, i.e. a digest that repeats itself for ever.
 */
export function digestWindow(
  checkedThrough: string | null | undefined,
  now: number = Date.now()
): DigestWindow {
  const from = checkedThrough ? new Date(checkedThrough).getTime() : NaN;
  const first = !Number.isFinite(from);

  if (first) {
    return { since: isoDaysBefore(now, DIGEST_MAX_DAYS), days: DIGEST_MAX_DAYS, first: true, truncated: false };
  }
  if (from >= now) {
    // A stamp in the future (clock change, restored backup) would ask the
    // register for a window that starts after today and return nothing at all.
    return { since: isoDaysBefore(now, DIGEST_MAX_DAYS), days: DIGEST_MAX_DAYS, first: false, truncated: false };
  }

  const days = Math.ceil((now - from) / (24 * 60 * 60 * 1000));
  if (days > DIGEST_MAX_DAYS) {
    return { since: isoDaysBefore(now, DIGEST_MAX_DAYS), days: DIGEST_MAX_DAYS, first: false, truncated: true };
  }
  // The register takes whole days, and a date one day back can exclude a company
  // registered yesterday afternoon — so the window is rounded out, not in. A
  // repeated company is caught by the dedupe; a missed one is gone.
  const since = new Date(from).toISOString().slice(0, 10);
  const calendarDays = Math.max(1, Math.ceil((now - Date.parse(`${since}T00:00:00Z`)) / (24 * 60 * 60 * 1000)));
  return { since, days: calendarDays, first: false, truncated: false };
}

/**
 * The window for one stored watch.
 *
 * A watch that has never been checked looks back a full week, whatever its
 * `checked_through` says. The column defaults to the watch's creation time, and
 * treating that as the window start would ask the register for companies
 * registered from *now* onwards — so a search created on Monday would report
 * nothing until the following week, which is exactly the empty first impression
 * that makes someone abandon a watchlist.
 *
 * `checked_through` only becomes a real boundary once a check has succeeded and
 * moved it forward, which is why the check is on `lastCheckedAt` and not on the
 * column itself.
 */
export function watchWindow(
  watch: { checkedThrough: string | null; lastCheckedAt: string | null },
  now: number = Date.now()
): DigestWindow {
  return digestWindow(watch.lastCheckedAt ? watch.checkedThrough : null, now);
}

/** The least a company row needs for this module to reason about it. */
export interface DigestCompany {
  company_number?: string;
  business_name?: string;
}

/**
 * The companies that are genuinely new, in the order the register returned them.
 *
 * Anything without a company number is dropped rather than shown with a guess at
 * its identity: without the number there is nothing to remember it by, so it
 * would come back as "new" on every single check, which is the failure that makes
 * a digest worthless.
 *
 * Duplicates *within* one reply are collapsed too — the register can return the
 * same company through two searches (a SIC match and a name match), and the
 * first occurrence wins.
 */
export function newCompanies<T extends DigestCompany>(
  found: readonly T[],
  alreadyReported: ReadonlySet<string>
): T[] {
  const out: T[] = [];
  const claimed = new Set<string>();
  for (const company of found) {
    const number = (company.company_number ?? "").trim();
    if (!number || alreadyReported.has(number) || claimed.has(number)) continue;
    claimed.add(number);
    out.push(company);
  }
  return out;
}

/** What one watch's check produced, as far as the email is concerned. */
export interface WatchReport {
  userId: number;
  niche: string;
  location: string;
  companies: { business_name: string; company_number: string; incorporated_on: string }[];
}

/**
 * Group the week's checks into the emails that will actually be sent.
 *
 * One message per account, covering every search that produced something, and
 * nothing for an account where nothing was registered. Both halves matter: five
 * watches firing five emails looks like a malfunction, and an empty weekly "no
 * news" email is how a product teaches someone to stop opening it. The order of
 * the searches is preserved so the email reads in the order they were set up.
 */
export function digestByAccount<T extends WatchReport>(reports: readonly T[]): Map<
  number,
  { niche: string; location: string; companies: T["companies"] }[]
> {
  const out = new Map<number, { niche: string; location: string; companies: T["companies"] }[]>();
  for (const report of reports) {
    if (report.companies.length === 0) continue;
    const account = out.get(report.userId) ?? [];
    account.push({ niche: report.niche, location: report.location, companies: report.companies });
    out.set(report.userId, account);
  }
  return out;
}

/**
 * How old a remembered company may get before it is forgotten.
 *
 * Exported as a moment rather than a number of days because both the pruning and
 * its test need to agree on the boundary.
 */
export function memoryCutoff(now: number = Date.now()): string {
  return new Date(now - DIGEST_MEMORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** "3 new roofers in Leeds", or the same sentence for any count. */
export function digestLine(niche: string, location: string, count: number): string {
  const trade = (niche ?? "").trim() || "business";
  const where = (location ?? "").trim();
  const plural = count === 1 ? trade.replace(/s$/, "") : trade;
  return `${count} new ${plural}${where ? ` in ${where}` : ""}`;
}

/**
 * The subject line and opening words of the emailed digest.
 *
 * Plain text rather than a template engine: the whole message is a list of
 * company names and a link, and a digest that reads like a marketing email is
 * one a user marks as spam. It is sent by the account owner's own product to
 * the account owner, about their own saved searches — not to a prospect.
 */
export function digestEmail(params: {
  name: string;
  watches: { niche: string; location: string; companies: { business_name: string; company_number: string; incorporated_on: string }[] }[];
  total: number;
  url: string;
}): { subject: string; text: string } {
  const one = params.watches.length === 1 ? params.watches[0] : null;
  const subject = one
    ? `${digestLine(one.niche, one.location, params.total)} — your weekly digest`
    : `${params.total} new businesses across ${params.watches.length} searches — your weekly digest`;

  const lines: string[] = [
    `${params.name ? `${params.name}, ` : ""}${params.total} ${params.total === 1 ? "business has" : "businesses have"} registered since you last looked:`,
    "",
  ];
  for (const watch of params.watches) {
    if (params.watches.length > 1) lines.push(`${digestLine(watch.niche, watch.location, watch.companies.length)}`);
    for (const c of watch.companies) {
      lines.push(`  • ${c.business_name}${c.incorporated_on ? ` (registered ${c.incorporated_on})` : ""}`);
      lines.push(`    https://find-and-update.company-information.service.gov.uk/company/${c.company_number}`);
    }
    lines.push("");
  }
  lines.push(`Open your digest: ${params.url}`);
  lines.push("");
  lines.push(
    "These are new incorporations from the official UK register. They have not been checked for a website yet — open the digest to work them."
  );

  return { subject: subject.replace(/\s+/g, " ").replace(/ — $/, ""), text: lines.join("\n") };
}
