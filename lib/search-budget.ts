/**
 * How much web search this deployment is allowed to do, and when it gets more.
 *
 * Kept dependency-free (like `lib/scrape.ts` and `lib/crawl.ts`) so the test
 * runner can import it directly — every rule here is a decision about a *number*
 * taken from a response header, which is exactly the kind of thing that silently
 * drifts if it is only exercised in production.
 *
 * The endpoint serves a shared free allowance when no key is configured, and it
 * is a daily budget the entire deployment draws on rather than a per-minute
 * throttle. Measured on a real session: after a morning of searches the endpoint
 * answered HTTP 429 with `retry-after: 15076` and `x-ratelimit-reset` pointing
 * exactly at 00:00 UTC, with `x-ratelimit-limit: 0` — the allowance was not
 * "busy", it was gone for the rest of the day. A user told to "wait a minute"
 * would retry all evening.
 */

/**
 * Raised when the shared allowance is spent, carrying when it comes back.
 *
 * Its own type because "rate limited" and "your allowance resumes at 00:00 UTC
 * tomorrow" are different things to a user: the first invites a retry in a
 * minute, the second means the feature is down for the rest of the day unless
 * the deployment adds a key.
 */
export class SearchAllowanceSpentError extends Error {
  /**
   * Written as a plain field rather than a constructor parameter property:
   * the test runner strips types instead of compiling them, and a parameter
   * property is the one TypeScript form it cannot strip.
   */
  readonly resumesAt: number;

  constructor(resumesAt: number) {
    super(`Free web-search allowance spent until ${new Date(resumesAt).toISOString()} (429)`);
    this.name = "SearchAllowanceSpentError";
    this.resumesAt = resumesAt;
  }
}

/** "17:00" in UTC — the clock a user's decision hangs on. */
export function utcClock(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

/** Just the header lookup a `Response` and a plain object both satisfy. */
export interface HeadersLike {
  get(name: string): string | null;
}

/**
 * When a 429 says the allowance returns.
 *
 * `retry-after` is the standard and is what this endpoint sent (in seconds);
 * `x-ratelimit-reset` came as epoch milliseconds. If neither is usable the answer
 * is the end of the UTC day, because that is when the free allowance was observed
 * to reset — and guessing *later* is the safe direction, since retrying a spent
 * allowance is what makes the wait longer.
 */
export function allowanceResetFrom(headers: HeadersLike, now: number = Date.now()): number {
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return now + retryAfter * 1000;
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    // Seconds or milliseconds, depending on who wrote the header.
    return reset < 1e12 ? reset * 1000 : reset;
  }
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.getTime();
}

/**
 * The moment the allowance comes back, or 0 when nothing is known to be spent.
 *
 * Remembering this is what keeps one spent allowance from costing one request per
 * look-up: a register search asks for a contact on every lead, and firing twenty
 * calls at an endpoint that has already refused them all does not shorten the
 * wait, it just makes twenty errors.
 */
export function allowanceResumesAt(spentUntil: number, now: number = Date.now()): number {
  return now < spentUntil ? spentUntil : 0;
}
