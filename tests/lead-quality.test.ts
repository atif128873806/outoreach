import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRelativeTs } from "./helpers/resolve-ts.mjs";
import { leadSearchMocks } from "./helpers/lead-search-mocks.mjs";
import type { Lead } from "../lib/leads";

type Point = { lat: number; lon: number };
type Fixture = { leads: Lead[]; enriched: number; geocoded: string[]; points: Record<string, Point | null> };
const globals = globalThis as typeof globalThis & { __leadQualityFixture?: Fixture };
const resolve = resolveRelativeTs(), mocks = leadSearchMocks();
const { runLeadSearch } = await import("../lib/lead-search.ts");
const params = { source: "fixture", niche: "dentists", location: "London, UK", count: 10, websiteFilter: "any" };
const lead = (address: string, business_name = "Synthetic dental business"): Lead => ({ business_name, address, category: "dentist", website: "", phone: "", email: "", instagram: "", linkedin: "", notes: "", source: "fixture" });
function scenario(leads: Lead[], points: Fixture['points'] = {}): Fixture {
  return globals.__leadQualityFixture = { leads, points, enriched: 0, geocoded: [] };
}
await test("lead search keeps locality exclusions through final delivery", async t => {
  t.after(() => { mocks.deregister(); resolve.deregister(); delete globals.__leadQualityFixture; });
  await t.test("all foreign results stay excluded without enrichment or geocoding", async () => {
    const f = scenario([lead("London, Ontario, Canada")]);
    const result = await runLeadSearch(1, params);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.deepEqual(result.leads, []); assert.equal(result.meta.outOfArea, 1);
    assert.equal(f.enriched, 0); assert.deepEqual(f.geocoded, []);
    assert.equal(result.meta.quota.remaining, 50); assert.match(result.note ?? "", /confirm|area/i);
  });
  await t.test("a same-city-name foreign business cannot accompany a UK match", async () => {
    const f = scenario([lead("London, Ontario, Canada", "Foreign fixture"), lead("London, UK", "Local fixture")]);
    const result = await runLeadSearch(1, params);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.deepEqual(result.leads.map(l => l.business_name), ["Local fixture"]);
    assert.equal(result.meta.outOfArea, 1); assert.equal(f.enriched, 1); assert.deepEqual(f.geocoded, []);
  });
  await t.test("all distant domestic results stay rejected after the geocoder confirms distance", async () => {
    const f = scenario([lead("Bristol, UK")], { "London, UK": { lat: 51.507, lon: -.128 }, "Bristol, UK": { lat: 51.455, lon: -2.588 } });
    const result = await runLeadSearch(1, params);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.leads.length, 0); assert.equal(result.meta.outOfArea, 1); assert.equal(f.enriched, 0);
    assert.deepEqual(f.geocoded, ["London, UK", "Bristol, UK"]);
  });
  await t.test("geocoder unavailability never reverses an explicit place exclusion", async () => {
    const f = scenario([lead("Liverpool, UK")]); const result = await runLeadSearch(1, params);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.leads.length, 0); assert.equal(result.meta.outOfArea, 1); assert.equal(f.enriched, 0);
  });
  await t.test("nearby districts still survive the existing distance verification", async () => {
    const f = scenario([lead("Croydon, UK")], { "London, UK": { lat: 51.507, lon: -.128 }, "Croydon, UK": { lat: 51.372, lon: -.101 } });
    const result = await runLeadSearch(1, params);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.leads.length, 1); assert.equal(result.meta.outOfArea, 0); assert.equal(f.enriched, 1);
  });
  await t.test("unknown addresses remain available with an honest location warning", async () => {
    scenario([lead("10 Test Street")]); const result = await runLeadSearch(1, params);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.leads.length, 1); assert.equal(result.meta.outOfArea, 0);
    assert.match(result.note ?? "", /incomplete|unconfirmed|could not be confirmed/i);
  });
  await t.test("mixed local and unknown results do not claim every delivered business is confirmed local", async () => {
    scenario([lead("London, UK", "Local fixture"), lead("", "Unknown fixture"), lead("Paris, France", "Foreign fixture")]);
    const result = await runLeadSearch(1, params); assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.leads.length, 2); assert.equal(result.meta.outOfArea, 1);
    assert.doesNotMatch(result.note ?? "", /every row here is a business in/i);
    assert.match(result.note ?? "", /incomplete|unconfirmed|could not be confirmed/i);
  });
  await t.test("empty source results stay empty without a location-verification claim", async () => {
    const f = scenario([]); const result = await runLeadSearch(1, params);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.leads.length, 0); assert.equal(result.meta.outOfArea, 0); assert.equal(f.enriched, 0);
    assert.equal(result.detail, "no businesses from the source");
  });
});
