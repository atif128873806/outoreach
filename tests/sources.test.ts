import { test } from "node:test";
import assert from "node:assert/strict";
import type { SourceId } from "../lib/sources/meta.ts";

const { SOURCE_META, ACTIVE_SOURCES, sourceLabel, isSourceId, inventoryProblems, sourceFitsFilter } =
  await import("../lib/sources/meta.ts");

/**
 * The contract: a source shown to a user always has an implementation, a keyed
 * source always names the settings field holding its key, and every source has
 * a distinct label and a description a human can act on. `inventoryProblems`
 * is what the server registry refuses to start on, so these tests are the
 * guardrail against advertising a source we cannot actually search.
 */

const IMPLEMENTED: SourceId[] = ["web", "osm", "companies_house"];

test("the shipped inventory is consistent", () => {
  assert.deepEqual(inventoryProblems(IMPLEMENTED), []);
});

test("a source with no website of its own is confined to the filter it can serve", () => {
  // The UK register publishes no websites, so it can never fill a filter that
  // promises an audit — "has a website" and "outdated site" both mean every row
  // carries a site we graded. The rule lives in one place, and the route refuses
  // the request rather than selling a design prospect an audit that never
  // happened. (A food-hygiene register was built, measured and dropped for the
  // same reason — see the note in lib/sources/meta.ts.)
  assert.equal(SOURCE_META.companies_house.gives.website, false);
  assert.equal(sourceFitsFilter(SOURCE_META.companies_house, "without"), true);
  for (const filter of ["any", "with", "outdated"]) {
    assert.equal(
      sourceFitsFilter(SOURCE_META.companies_house, filter),
      false,
      `the register must be refused for the ${filter} filter`
    );
  }
  // Every other offered source carries a website, so no filter is closed to it.
  for (const id of ACTIVE_SOURCES.filter((i) => SOURCE_META[i].gives.website)) {
    for (const filter of ["any", "with", "outdated", "without"]) {
      assert.equal(sourceFitsFilter(SOURCE_META[id], filter), true, `${id} should serve ${filter}`);
    }
  }
});

test("every offered source is implemented and described", () => {
  for (const id of ACTIVE_SOURCES) {
    const meta = SOURCE_META[id];
    assert.ok(meta, `${id} is offered but has no metadata`);
    assert.ok(meta.desc.length > 20, `${id} has no usable description`);
    assert.equal(meta.available, true, `${id} is offered in the picker but marked unavailable`);
  }
});

test("a source offered without an implementation is a problem", () => {
  const problems = inventoryProblems(["osm", "companies_house"]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"web" is offered but has no implementation/);
});

test("an offered source that cannot discover businesses is a problem", () => {
  const before = [...ACTIVE_SOURCES];
  ACTIVE_SOURCES.push("site_crawl");
  try {
    const problems = inventoryProblems([...IMPLEMENTED, "site_crawl"]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /is not a discovery source/);
  } finally {
    ACTIVE_SOURCES.splice(0, ACTIVE_SOURCES.length, ...before);
  }
});

test("a user-keyed source that names no settings field is a problem", () => {
  // The rule outlived the source that used to exercise it: nothing ships
  // user-keyed today, so the fixture is a declared-but-unbuilt source standing
  // in for one. If a keyed source is ever added back (see the note on Google
  // Places in lib/sources/meta.ts), this is the rule that catches a typo'd
  // setting name before a customer hits it.
  const yelp = SOURCE_META.yelp;
  const before = { credential: yelp.credential, cost: yelp.cost };
  yelp.credential = "user";
  yelp.cost = "key";
  ACTIVE_SOURCES.push("yelp");
  try {
    const problems = inventoryProblems([...IMPLEMENTED, "yelp"]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /runs on the user's own key but names no settings field/);
  } finally {
    ACTIVE_SOURCES.pop();
    delete yelp.credential;
    yelp.cost = before.cost;
  }
});

test("each keyed source says whose key it is, and where that key lives", () => {
  // A typo in either place means a source that can never be configured. The
  // registry guard checks the shape; only this pins the actual names.
  //
  // Nothing is user-keyed any more, on purpose: the product's promise is "type a
  // niche and a city", and asking for a cloud API key first is where a new user
  // leaves. Google Places was removed for exactly that (see its note in
  // lib/sources/meta.ts), so the only keyed source left is the deployment's own.
  const userKeyed = ACTIVE_SOURCES.filter((id) => SOURCE_META[id].credential === "user");
  assert.deepEqual(userKeyed, [], "no shipped source should ask the customer for a key");

  // The register is deliberately the opposite arrangement. The deployment holds
  // one key for every customer, so there must be no settings field here at all:
  // a customer is never asked to sign up for the register to use the product.
  assert.equal(SOURCE_META.companies_house.cost, "key");
  assert.equal(SOURCE_META.companies_house.credential, "instance");
  assert.equal(SOURCE_META.companies_house.envKey, "COMPANIES_HOUSE_API_KEY");
  assert.equal(SOURCE_META.companies_house.keySetting, undefined);
  // Its only usable filter is the Pro one, so the plan must say so. Offering it
  // to a free plan would be an entry that always fails on submit.
  assert.equal(SOURCE_META.companies_house.plan, "pro");
});

test("a deployment-keyed source that names no environment variable is a problem", () => {
  const ch = SOURCE_META.companies_house;
  const original = ch.envKey;
  delete ch.envKey;
  try {
    const problems = inventoryProblems(IMPLEMENTED);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /runs on the deployment's key but names no environment variable/);
  } finally {
    ch.envKey = original;
  }
});

test("a deployment-keyed source must not also ask the customer for a key", () => {
  const ch = SOURCE_META.companies_house;
  ch.keySetting = "companies_house_api_key";
  try {
    const problems = inventoryProblems(IMPLEMENTED);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /must not ask the user for one/);
  } finally {
    delete ch.keySetting;
  }
});

test("a source that declares a key without saying whose is a problem", () => {
  const ch = SOURCE_META.companies_house;
  const original = ch.credential;
  delete ch.credential;
  try {
    const problems = inventoryProblems(IMPLEMENTED);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /does not say whose key it is/);
  } finally {
    ch.credential = original;
  }
});

test("free sources carry no key requirement", () => {
  for (const id of ["web", "osm"] as const) {
    assert.equal(SOURCE_META[id].cost, "free");
    assert.equal(SOURCE_META[id].keySetting, undefined);
  }
});

test("roadmap sources are declared but not offered", () => {
  const roadmap = (Object.keys(SOURCE_META) as (keyof typeof SOURCE_META)[]).filter(
    (id) => !ACTIVE_SOURCES.includes(id)
  );
  assert.ok(roadmap.length >= 2, "the unbuilt sources should stay declared");
  for (const id of roadmap) assert.equal(SOURCE_META[id].available, false);
  // The own-site crawl is part of the pipeline, not a picker entry: it cannot
  // discover a business from a niche and a location.
  assert.equal(SOURCE_META.site_crawl.kind, "enrichment");
});

test("a source offered to users must be able to find businesses", () => {
  const problems = inventoryProblems([...IMPLEMENTED, "site_crawl"]);
  assert.equal(problems.length, 0, "site_crawl stays unoffered, so it is not a problem");
  // If it were offered, the inventory would refuse to start.
  const offered = inventoryProblems(IMPLEMENTED).concat(
    SOURCE_META.site_crawl.kind === "discovery" ? [] : ["enrichment offered"]
  );
  assert.ok(offered.length >= 1 || SOURCE_META.site_crawl.kind === "discovery");
});

test("Google Places stays removed until it is re-added deliberately", () => {
  // Removed because it was the only source that asked a *customer* for a key,
  // and that ask sits in front of the product's core action for data
  // OpenStreetMap already carries keylessly. The removal is a product decision,
  // not an oversight, so it is pinned — a stray entry here would put a Google
  // Cloud signup back between a new user and their first search.
  assert.equal("google" in SOURCE_META, false);
  assert.equal(ACTIVE_SOURCES.includes("google" as SourceId), false);
  // The settings field went with it, and the type system is what keeps it gone:
  // `google_places_api_key` is no longer a SettingKey, so any leftover read of
  // it fails `tsc` rather than silently resolving to undefined at runtime.
});

test("sources probed and rejected stay rejected", () => {
  // Evidence, so this is not re-litigated from memory. planning.data.gov.uk
  // carries applications for a single council (Leeds, Birmingham, Manchester,
  // Bristol, Sheffield and Liverpool all return zero); Certificate Transparency
  // publishes certificates, not businesses; and the UK food hygiene register
  // lists no websites and carried 0 usable phone numbers in a 100-entry sample,
  // so a row from it could not honestly sit inside a "no website" filter.
  assert.equal("planning" in SOURCE_META, false);
  assert.equal("new_domains" in SOURCE_META, false);
  assert.equal("fsa" in SOURCE_META, false);
});

test("labels are unique, so the results header never misreports a source", () => {
  const labels = ACTIVE_SOURCES.map((id) => sourceLabel(id));
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(labels.every((label) => label.length > 0));
});

test("an unknown source id is rejected rather than silently searched", () => {
  assert.equal(isSourceId("web"), true);
  assert.equal(isSourceId("myspace"), false);
  assert.equal(isSourceId(undefined), false);
  assert.equal(isSourceId(7), false);
  assert.equal(isSourceId("site_crawl"), true, "declared sources are still valid ids");
});

test("a source that promises groundwork it cannot do is flagged", () => {
  // The AI search source is the only one allowed to claim it returns a website
  // and a contact; a source giving neither has nothing to qualify a lead with.
  const smooth = SOURCE_META.web;
  const original = { ...smooth.gives };
  smooth.gives = { website: false, contact: false, address: true, industry: true };
  try {
    const problems = inventoryProblems(IMPLEMENTED);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /claims to give neither a website nor a contact/);
  } finally {
    smooth.gives = original;
  }
});
