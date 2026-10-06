import { test } from "node:test";
import assert from "node:assert/strict";

const product = await import("../lib/product.ts");
const {
  isOutreachPath,
  isOutreachBlocked,
  isOutreachEnabled,
  getAppLandingPath,
  isNewBusinessesPath,
  isNewBusinessesBlocked,
} = product;

/**
 * The product is one feature — real-time lead generation with a website audit.
 * The outreach half still exists in the codebase and still works, but with the
 * flag off it must be *unreachable*, not merely unlinked: a page that is only
 * missing from a nav is still one search-engine result, one shared URL and one
 * bookmark away from telling a visitor this is a cold-email tool.
 *
 * `lib/product.ts` is dependency-free precisely so these rules can be exercised
 * here rather than only in a browser.
 */

/** Runs `fn` with OUTREACH_ENABLED set as given, then restores it. */
function withOutreach<T>(value: string | undefined, fn: () => T): T {
  const before = process.env.OUTREACH_ENABLED;
  if (value === undefined) delete process.env.OUTREACH_ENABLED;
  else process.env.OUTREACH_ENABLED = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.OUTREACH_ENABLED;
    else process.env.OUTREACH_ENABLED = before;
  }
}

test("with outreach off, the whole sending half is unreachable", () => {
  withOutreach(undefined, () => {
    assert.equal(isOutreachEnabled(), false);
    for (const path of ["/dashboard", "/campaigns", "/campaigns/42", "/messages"]) {
      // `isOutreachBlocked` is what the router applies, so this is the branch a
      // real request takes, not just the classification of the path.
      assert.equal(isOutreachBlocked(path), true, `${path} must not be reachable`);
    }
  });
  // An explicit "false" is off too — only the exact string "true" opts in, so a
  // half-set variable can never expose the sending half by accident.
  withOutreach("false", () => assert.equal(isOutreachEnabled(), false));
  withOutreach("1", () => assert.equal(isOutreachEnabled(), false));
});

test("with outreach off, its marketing is unreachable as well as its app", () => {
  // The app screens were always hidden; these three were not, and they are what
  // a visitor actually reads — a footer advertising "Cold email deliverability"
  // and a spam checker describes a different product (see OUTREACH_PREFIXES).
  withOutreach(undefined, () => {
    for (const path of [
      "/guides/cold-email-deliverability",
      "/tools/dns-checker",
      "/tools/spam-checker",
    ]) {
      assert.equal(isOutreachBlocked(path), true, `${path} still sells the sending half`);
    }
  });
});

test("the lead-finding surface is never hidden by that flag", () => {
  withOutreach(undefined, () => {
    for (const path of [
      "/",
      "/leads",
      "/contacts",
      "/pricing",
      "/features",
      "/docs",
      "/contact",
      "/guides",
      "/guides/find-local-business-emails",
      "/terms",
      "/privacy",
      "/refund-policy",
    ]) {
      assert.equal(isOutreachBlocked(path), false, `${path} must stay reachable`);
    }
  });
});

test("a prefix match does not swallow a neighbouring path", () => {
  withOutreach(undefined, () => {
    // The guide is outreach; the guides index next to it is not, even though one
    // path is a prefix of the other.
    assert.equal(isOutreachPath("/guides/cold-email-deliverability"), true);
    assert.equal(isOutreachPath("/guides"), false);
    // Same for the tools directory: hiding the two email tools must not take the
    // whole /tools section with them if a lead-side tool is ever added.
    assert.equal(isOutreachPath("/tools"), false);
    assert.equal(isOutreachPath("/tools/spam-checker"), true);
    // But a route *under* an outreach page is outreach.
    assert.equal(isOutreachPath("/tools/spam-checker/report"), true);
  });
});

test("the same paths come back when a deployment opts in", () => {
  withOutreach("true", () => {
    assert.equal(isOutreachEnabled(), true);
    for (const path of [
      "/dashboard",
      "/campaigns",
      "/messages",
      "/guides/cold-email-deliverability",
      "/tools/dns-checker",
      "/tools/spam-checker",
    ]) {
      // Still classified as outreach — that is what the flag is for — but no
      // longer blocked, which is the part that decides the request.
      assert.equal(isOutreachPath(path), true, `${path} is part of the outreach half`);
      assert.equal(isOutreachBlocked(path), false, `${path} should be reachable again`);
    }
  });
});

test("a signed-in user lands on the search screen, not a hidden dashboard", () => {
  // The landing path is where the router sends a signed-in user; pointing it at
  // /dashboard with outreach off would bounce them straight back.
  withOutreach(undefined, () => assert.equal(getAppLandingPath(), "/leads"));
  withOutreach("true", () => assert.equal(getAppLandingPath(), "/dashboard"));
});

/** Runs `fn` with NEW_BUSINESSES_ENABLED set as given, then restores it. */
function withNewBusinesses<T>(value: string | undefined, fn: () => T): T {
  const before = process.env.NEW_BUSINESSES_ENABLED;
  if (value === undefined) delete process.env.NEW_BUSINESSES_ENABLED;
  else process.env.NEW_BUSINESSES_ENABLED = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.NEW_BUSINESSES_ENABLED;
    else process.env.NEW_BUSINESSES_ENABLED = before;
  }
}

/**
 * "New businesses" is parked while the product's direction is reconsidered. Like
 * the outreach half it is *unreachable*, not merely unlinked — and it hides its
 * API with its page, or the app keeps `fetch`ing a route the UI no longer offers.
 */
test("while New businesses is parked, its page and its API are unreachable", () => {
  withNewBusinesses(undefined, () => {
    for (const path of [
      "/watches",
      "/api/watches",
      "/api/watches/digest",
      // A route *under* the page belongs to it too.
      "/watches/anything",
    ]) {
      assert.equal(isNewBusinessesBlocked(path), true, `${path} must not be reachable`);
    }
  });
  // Same rule as the outreach flag: only the exact string "true" opts in, so a
  // half-set variable can never reveal a feature that was parked.
  withNewBusinesses("false", () => assert.equal(isNewBusinessesBlocked("/watches"), true));
  withNewBusinesses("1", () => assert.equal(isNewBusinessesBlocked("/watches"), true));
});

test("parking New businesses does not take a neighbouring path with it", () => {
  withNewBusinesses(undefined, () => {
    for (const path of ["/", "/leads", "/contacts", "/watchlist", "/leads/watches"]) {
      assert.equal(isNewBusinessesBlocked(path), false, `${path} must stay reachable`);
    }
  });
});

test("the two flags are independent, and the feature returns whole", () => {
  // Outreach stays off; only the parked feature is switched back on. Both orders
  // matter — a shared path list would hide "New businesses" again the moment the
  // outreach rules were applied.
  withOutreach(undefined, () => {
    withNewBusinesses("true", () => {
      for (const path of ["/watches", "/api/watches", "/api/watches/digest"]) {
        assert.equal(isNewBusinessesBlocked(path), false, `${path} should be reachable again`);
        // Still classified as part of the feature, which is what the flag is for.
        assert.equal(isNewBusinessesPath(path), true);
      }
      // ...without exposing the sending half along with it.
      assert.equal(isOutreachBlocked("/campaigns"), true);
    });
  });
});

test("parking outreach also closes campaign and message APIs", () => {
  withOutreach(undefined, () => {
    for (const path of ["/api/campaigns", "/api/campaigns/1", "/api/campaigns/preview", "/api/messages"]) {
      assert.equal(isOutreachBlocked(path), true, `${path} must not run while parked`);
    }
    assert.equal(isOutreachBlocked("/api/leads"), false);
    assert.equal(isOutreachBlocked("/api/admin/dashboard"), false);
  });
  withOutreach("true", () => assert.equal(isOutreachBlocked("/api/campaigns/1"), false));
});
