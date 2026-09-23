import { test } from "node:test";
import assert from "node:assert/strict";

const niches = await import("../lib/niches.ts");
const { NICHE_ALIASES, nicheAlias, tradeTag, tagMatches } = niches;

/**
 * A niche that maps to no tag returns an empty list, and an empty list looks
 * like an empty city — the user adjusts their search instead of reporting a bug.
 * So the vocabulary gets tested like the promise it is.
 */

/** The trades this product is advertised for, plus what a user actually types. */
const ADVERTISED: string[] = [
  "roofers",
  "roofer",
  "plumbers",
  "plumber",
  "electricians",
  "cleaners",
  "cleaner",
  "cleaning",
  "window cleaners",
  "builders",
  "builder",
  "painters",
  "decorator",
  "carpenters",
  "gardeners",
  "locksmiths",
  "tiler",
  "plasterers",
  "glazier",
  "pest control",
  "movers",
  "removals",
  "hvac",
  "heating engineer",
  // The niches the product already shipped with.
  "dentists",
  "hair salon",
  "restaurant",
  "mechanic",
  "estate agent",
  "vet",
  "florist",
  "pharmacy",
];

test("every advertised trade maps to a real tag lookup", () => {
  for (const niche of ADVERTISED) {
    const alias = nicheAlias(niche);
    assert.ok(alias, `"${niche}" maps to no tag — the search would return nothing`);
    assert.ok(alias.re.length > 2, `"${niche}" has an empty pattern`);
    assert.ok(
      (alias.keys ?? []).length > 0,
      `"${niche}" names no tag keys, so it would scan every key in the city`
    );
  }
});

test("the trades the product is sold for are covered by the strict form", () => {
  // The reported failure: "cleaners" reduced to "cleaner", which does not match
  // OSM's craft=cleaning, so a cleaning search returned an empty list.
  const cleaning = nicheAlias("cleaners")!;
  assert.equal(tagMatches(cleaning.re, "cleaning"), true);
  assert.equal(tagMatches(cleaning.re, "cleaner"), true);
  // And a dry cleaner is a different business — it sells a service to walk-ins
  // and usually has a shopfront and a site, so it is not this lead.
  assert.equal(tagMatches(cleaning.re, "dry_cleaning"), false);
});

test("the fallback this module replaced could not have found a cleaning business", () => {
  // Why an entry was needed at all. With no alias, the source matched the word
  // the user typed against tag values, so "cleaners" reduced to "cleaner" and
  // was tested against OSM's value "cleaning" — a string that does not contain
  // it. The search returned nothing, anywhere, and the user concluded their city
  // had no cleaning companies. Measured live after the fix: 0 in the Leeds city
  // box, 2 in West Yorkshire ("Heaven Scent Cleaning", "Berry's Cleaners") —
  // OSM's coverage is thin, but it is no longer unreachable.
  assert.equal(/cleaner/.test("cleaning"), false, "the old fallback could not match");
  assert.equal(tagMatches(nicheAlias("cleaners")!.re, "cleaning"), true);
});

test("a trade value only matches whole, or as one part of a multi-value tag", () => {
  const painter = nicheAlias("painters")!;
  assert.equal(tagMatches(painter.re, "painter"), true);
  // Real tag values measured on taginfo: car_painter has 330 uses and is a
  // different trade; art_painter is not a decorator either.
  assert.equal(tagMatches(painter.re, "car_painter"), false);
  assert.equal(tagMatches(painter.re, "art_painter"), false);
  // A business tagged with two trades is still a painter.
  assert.equal(tagMatches(painter.re, "painter;plasterer"), true);
  assert.equal(tagMatches(painter.re, "hvac;painter"), true);

  const builder = nicheAlias("builders")!;
  assert.equal(tagMatches(builder.re, "builder"), true);
  // shop=builders_merchant is a yard selling to the trade, and boatbuilder is a
  // different business entirely — both contain the word.
  assert.equal(tagMatches(builder.re, "builders_merchant"), false);
  assert.equal(tagMatches(builder.re, "boatbuilder"), false);
  assert.equal(tagMatches(builder.re, "stand_builder"), false);
});

test("the value OSM really uses for each trade is the one we ask for", () => {
  // These spellings were read off taginfo's live counts, and two of them are
  // spelled unlike the trade: glaziers are craft=glaziery (6,420), and removing
  // companies are office=moving_company (3,233). Guessing the obvious word
  // returns nothing.
  assert.equal(tagMatches(nicheAlias("glazier")!.re, "glaziery"), true);
  assert.equal(tagMatches(nicheAlias("movers")!.re, "moving_company"), true);
  assert.equal(tagMatches(nicheAlias("locksmiths")!.re, "locksmith"), true);
  assert.equal(tagMatches(nicheAlias("pest control")!.re, "pest_control"), true);
  assert.equal(tagMatches(nicheAlias("tiler")!.re, "tiler"), true);
});

test("a plural is the singular the user didn't type", () => {
  assert.deepEqual(nicheAlias("roofers"), nicheAlias("roofer"));
  assert.deepEqual(nicheAlias("plumbers"), nicheAlias("plumber"));
  assert.deepEqual(nicheAlias("tilers"), nicheAlias("tiler"));
  // Case and stray spaces are the caller's business, not the user's problem.
  assert.ok(nicheAlias("  ELECTRICIANS "));
});

test("an unknown niche falls through instead of matching something wrong", () => {
  // The caller scans tag values for the niche's own words when this returns
  // null. Returning a made-up alias here would silently search the wrong trade.
  assert.equal(nicheAlias("dog groomers"), null);
  assert.equal(nicheAlias("vegan bistro"), null);
  assert.equal(nicheAlias(""), null);
  assert.equal(nicheAlias("   "), null);
  assert.equal("dog groomers" in NICHE_ALIASES, false);
});

test("the pre-existing aliases keep working, substring and all", () => {
  // These deliberately rely on substring matching and must not be \"tightened\":
  // shop=beauty_salon would stop answering \"beauty salon\", and the doctor/doctor's
  // office variants rely on it too.
  assert.equal(tagMatches(nicheAlias("beauty salon")!.re, "beauty_salon"), true);
  assert.equal(tagMatches(nicheAlias("dentists")!.re, "dentist"), true);
  assert.equal(tagMatches(nicheAlias("hotel")!.re, "guest_house"), true);
});

test("the trade pattern builder produces the shape Overpass honours", () => {
  // This exact shape matters, and the obvious alternative does not work: anchors
  // inside an alternation group — (^|;)(painter)(;|$) — return ZERO results from
  // Overpass's regex engine, verified against the live API. Pinning the string
  // stops the next person from "simplifying" it back into silence.
  assert.equal(tradeTag("painter"), "^(.*;)?(painter)(;.*)?$");
  assert.equal(tradeTag("plumber", "hvac"), "^(.*;)?(plumber|hvac)(;.*)?$");
  assert.equal(tagMatches(tradeTag("pest_control"), "pest_control"), true);
  assert.equal(tagMatches(tradeTag("painter"), "plasterer;painter"), true);
  assert.equal(tagMatches(tradeTag("painter"), "painter;plasterer"), true);
  assert.equal(tagMatches(tradeTag("painter"), "painter"), true);
  assert.equal(tagMatches(tradeTag("painter"), "car_painter"), false);
});
