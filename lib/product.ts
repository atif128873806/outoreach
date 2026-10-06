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
  "/api/campaigns",
  "/api/messages",
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

/**
 * "New businesses" — saved searches that report what the company register has
 * incorporated since you last looked — is parked.
 *
 * Parked on the same terms as the outreach half above: the page, its API, the
 * daily register job and every stored row stay in the codebase and still work,
 * and a deployment brings the whole thing back with
 * `NEW_BUSINESSES_ENABLED=true`. Until then nothing links to it, a typed URL or
 * a bookmark lands on the search screen, and its API answers 404 rather than
 * pretending the feature never existed.
 *
 * The job is paused with it rather than left running out of sight: its only
 * output is an email pointing at a page the app no longer offers, which is worse
 * than no email at all. A pause loses nothing — re-enabling runs the usual
 * catch-up window (DIGEST_MAX_DAYS), so a watch checked today and re-enabled in
 * six months reports the same recent week it would have either way.
 */
export function isNewBusinessesEnabled(): boolean {
  return process.env.NEW_BUSINESSES_ENABLED === "true";
}

/** The page plus its API — both have to move together, or the app fetches a route the UI no longer offers. */
const NEW_BUSINESSES_PREFIXES = ["/watches", "/api/watches"];

/** True when `pathname` belongs to the parked "New businesses" feature. */
export function isNewBusinessesPath(pathname: string): boolean {
  return NEW_BUSINESSES_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Whether this request must be turned away because the feature is parked. */
export function isNewBusinessesBlocked(pathname: string): boolean {
  return !isNewBusinessesEnabled() && isNewBusinessesPath(pathname);
}
