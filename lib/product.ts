/**
 * Product shape.
 *
 * The product is one feature: type a niche and a city, get real businesses
 * pulled live, each with a scored audit of what's wrong with their website.
 *
 * The outreach half — campaigns, message center, SMTP/IMAP, warm-up,
 * deliverability — still exists in this codebase and still works; it is simply
 * unlinked and unreachable unless a deployment opts in with
 * `OUTREACH_ENABLED=true`. Nothing was deleted, so the two can coexist while
 * the single-feature product is validated.
 *
 * Server-only: client components read the flag from /api/auth/me and
 * /api/settings instead of importing this module, so the value can never be
 * frozen into a browser bundle.
 */
export function isOutreachEnabled(): boolean {
  return process.env.OUTREACH_ENABLED === "true";
}

/**
 * Routes that belong to the hidden outreach half.
 *
 * The last three are not app screens but the *marketing* for the outreach half:
 * a cold-email deliverability guide and the two email tools it sells. Leaving
 * them public while the app itself hides campaigns and sending is worse than
 * either choice alone — the footer then advertises "Cold email deliverability"
 * and "Spam checker" to a visitor who came for lead generation, and the product
 * reads as a cold-email platform in exactly the place someone decides what it
 * is. They come back with the flag, like everything else here.
 */
const OUTREACH_PREFIXES = [
  "/dashboard",
  "/campaigns",
  "/messages",
  "/guides/cold-email-deliverability",
  "/tools/dns-checker",
  "/tools/spam-checker",
];

/** True when `pathname` is inside the outreach half. */
export function isOutreachPath(pathname: string): boolean {
  return OUTREACH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Whether this request must be turned away *right now* — an outreach path on a
 * deployment that has not opted in.
 *
 * The flag and the path list have to be read together, or the rule ends up
 * split across two files and a caller can apply one without the other. This is
 * the single expression the router uses, and the thing the tests exercise.
 *
 * `pathname` matching is exact-or-slash-prefixed, so `/guides` is not treated as
 * `/guides/cold-email-deliverability`, and hiding the two email tools does not
 * take the whole `/tools` directory with them.
 */
export function isOutreachBlocked(pathname: string): boolean {
  return !isOutreachEnabled() && isOutreachPath(pathname);
}

/** Where a signed-in user belongs: the campaign dashboard, or the search screen. */
export function getAppLandingPath(): string {
  return isOutreachEnabled() ? "/dashboard" : "/leads";
}
