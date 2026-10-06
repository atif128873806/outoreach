import { test } from "node:test";
import assert from "node:assert/strict";

const {
  CACHE_TTL_SECONDS,
  countBucket,
  contactKey,
  geoKey,
  siteKey,
  sourceKey,
  sourceTtl,
  normalizeTerm,
  normalizeLocation,
  withSearchTrace,
} = await import("../lib/search-cache.ts");

test("normalizeTerm collapses the variations people actually type", () => {
  assert.equal(normalizeTerm("  Roofers,  Leeds "), "roofers, leeds");
  assert.equal(normalizeTerm("Dentists\tin\nLondon"), "dentists in london");
  // Nothing is stripped beyond case and whitespace: "St. John's" is not "st johns".
  assert.equal(normalizeTerm("St. John's"), "st. john's");
  assert.equal(normalizeTerm(""), "");
});

test("comma spacing shares location keys without merging distinct places or business names", () => {
  const base = sourceKey("companies_house", "real estate", "london, uk", 10);
  for (const location of ["london,uk", " London , UK ", "LONDON,  UK", "London\t,\nUK"]) {
    assert.equal(sourceKey("companies_house", "real estate", location, 10), base);
    assert.equal(geoKey(location), geoKey("London, UK"));
    assert.equal(contactKey("Acme", location, "GB"), contactKey("Acme", "London, UK", "GB"));
  }
  assert.equal(normalizeLocation("St. John's,UK"), "st. john's, uk");
  assert.notEqual(normalizeLocation("St. John's, UK"), normalizeLocation("St Johns, UK"));
  assert.notEqual(base, sourceKey("companies_house", "real estate", "London, Ontario", 10));
  assert.notEqual(base, sourceKey("web", "real estate", "London, UK", 10));
  assert.notEqual(base, sourceKey("companies_house", "real estate", "London, UK", 100));
  assert.notEqual(contactKey("Acme,Inc", "London, UK", "GB"), contactKey("Acme, Inc", "London, UK", "GB"));
});

test("countBucket lets neighbouring searches share one cache entry", () => {
  assert.equal(countBucket(10), 25);
  assert.equal(countBucket(12), 25);
  assert.equal(countBucket(25), 25);
  assert.equal(countBucket(26), 50);
  assert.equal(countBucket(0), 25); // never zero: a bucket of none is not a bucket
  // A 12-lead request and a 10-lead request are the same question to a source;
  // a 60-lead one is not.
  assert.equal(sourceKey("osm", "roofers", "Leeds", 10), sourceKey("osm", "roofers", "leeds ", 12));
  assert.notEqual(sourceKey("osm", "roofers", "Leeds", 10), sourceKey("osm", "roofers", "Leeds", 60));
});

test("a source key separates the source, the niche and the place", () => {
  const base = sourceKey("web", "dentists", "London", 25);
  assert.notEqual(base, sourceKey("osm", "dentists", "London", 25));
  assert.notEqual(base, sourceKey("web", "plumbers", "London", 25));
  assert.notEqual(base, sourceKey("web", "dentists", "Manchester", 25));
  assert.ok(base.startsWith("src|web|"));
});

test("site keys preserve response-changing URL parts and discard only fragments", () => {
  const opts = { deep: false, uk: true };
  const base = siteKey("https://example.com/about", opts);
  assert.equal(base, siteKey("example.com/about", opts));
  assert.equal(base, siteKey("https://EXAMPLE.COM:443/about#section", opts));
  for (const url of ["http://example.com/about", "https://example.com:8443/about",
    "https://example.com/About", "https://example.com/about/", "https://example.com/about?page=2"]) {
    assert.notEqual(base, siteKey(url, opts), url);
  }
  assert.ok(base.startsWith("site:v2|"));
});

test("site key separates the two visits that record different things", () => {
  const url = "https://example.com/";
  const quickUk = siteKey(url, { deep: false, uk: true });
  // A deep visit adds the broken-link sweep; a UK visit repairs the trunk 0.
  // Reusing one for the other would hand back an audit that never ran.
  assert.notEqual(quickUk, siteKey(url, { deep: true, uk: true }));
  assert.notEqual(quickUk, siteKey(url, { deep: false, uk: false }));
  assert.equal(quickUk, siteKey(url, { deep: false, uk: true }));
});

test("geo and contact keys are stable and market-aware", () => {
  assert.equal(geoKey(" Leeds, UK "), "geo|leeds, uk");
  assert.equal(contactKey("Ironpeak Roofing", "Leeds", "GB"), contactKey("ironpeak  roofing", "leeds", "GB"));
  // The same name abroad is a different business — and has been a real bug.
  assert.notEqual(contactKey("Ironpeak Roofing", "Leeds", "GB"), contactKey("Ironpeak Roofing", "Leeds", "US"));
  assert.equal(contactKey("Acme", "Leeds", null), contactKey("Acme", "Leeds", undefined));
});

// (isFresh itself is pinned in tests/freshness.test.ts, alongside the wording the
// UI shows — the same question asked from the browser's side.)

test("TTLs follow how fast each fact actually changes", () => {
  // A website can break this week; a city's coordinates cannot move at all.
  assert.ok(CACHE_TTL_SECONDS.site < CACHE_TTL_SECONDS.geo);
  assert.ok(CACHE_TTL_SECONDS.site <= 7 * 86400, "a stale audit is the one thing we must not quote");
  // The register publishes new companies every working day; a directory does not.
  assert.ok(sourceTtl("companies_house") < sourceTtl("osm"));
  assert.equal(sourceTtl("web"), CACHE_TTL_SECONDS.source);
});

test("withSearchTrace hands out per-search counters and keeps them apart", async () => {
  const first = await withSearchTrace(async (trace) => {
    trace.hits += 2;
    trace.misses += 1;
    // Awaited work inside the context still sees the same counters.
    await new Promise((r) => setTimeout(r, 1));
    assert.equal(trace.hits, 2);
    return "ok";
  });
  assert.equal(first.value, "ok");
  assert.deepEqual(first.trace, { hits: 2, misses: 1 });

  // A second search starts from zero rather than inheriting the first one's.
  const second = await withSearchTrace(async (trace) => {
    assert.deepEqual(trace, { hits: 0, misses: 0 });
    return 42;
  });
  assert.equal(second.value, 42);
  assert.deepEqual(second.trace, { hits: 0, misses: 0 });
});
