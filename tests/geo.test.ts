import { test } from "node:test";
import assert from "node:assert/strict";

const {
  locationTerms,
  classifyLocality,
  countryConflict,
  distanceKm,
  withinLocalRadius,
  inferCountryFromAddresses,
  countryOfText,
  countryFromHost,
  countryAgrees,
} = await import("../lib/geo.ts");

test("a page's country is read from what it shows, not guessed from a TLD", () => {
  // Verbatim from the live lookup that surfaced the failure: this is what the
  // register's Leeds roofer "Ironpeak Roofing Services Ltd" was matched to.
  const california =
    "Iron Peak Roofing is a family-owned roofing company proudly serving homeowners and " +
    "businesses across California's Inland Empire — from Winchester and Temecula to Riverside " +
    "and beyond. Contact (951) 230-8701 (+19512308701) Free Inspection";
  assert.equal(countryOfText(california), "US");
  assert.equal(countryOfText(california, "GB"), "US");

  const leeds =
    "Iconic Roofing are professional roofing contractors offering services across Leeds, " +
    "Wakefield, Bradford and the surrounding West Yorkshire region. LS1 2AB";
  assert.equal(countryOfText(leeds), "GB");

  // A British page that mentions its American supplier is still a British page:
  // the location already established for the search settles the tie.
  assert.equal(
    countryOfText("Based in Leeds LS1 2AB, we fit windows supplied by a partner in California.", "GB"),
    "GB"
  );

  // A generic TLD claims nothing — British businesses use .com constantly —
  // while a country code is the site's own statement.
  assert.equal(countryFromHost("ironpeakroofingservices.com"), null);
  assert.equal(countryFromHost("peakperformanceproperty.co.uk"), "GB");
  assert.equal(countryFromHost("some-roofing.us"), "US");
});

test("only a proven clash of countries refuses a page", () => {
  assert.equal(countryAgrees("GB", "US"), false);
  assert.equal(countryAgrees("GB", "GB"), true);
  assert.equal(countryAgrees("US", "US"), true);
  // Silence decides nothing: an unreadable page, or a market nobody stated.
  assert.equal(countryAgrees("GB", null), true);
  assert.equal(countryAgrees(null, "US"), true);
  assert.equal(countryAgrees(null, null), true);
});

test("the market is inferred from the results when the location box names none", () => {
  // The bug this exists for, measured live: "Leeds" handed over a profile's
  // truncated "113 275 262" while "Leeds, UK" produced the business's own
  // published "0113 275 2620" for the same lead, from the same source, a minute
  // apart. The location just never said which country it was in.
  assert.equal(
    inferCountryFromAddresses([
      "55 Fountain Street, Morley, Leeds, LS27 0AA, England",
      "3 Feast Field, Horsforth, West Yorkshire, LS18 4TJ, England",
      "12 Colenso Grove, Leeds, LS11 0DG",
    ]),
    "GB"
  );
  assert.equal(
    inferCountryFromAddresses([
      "1200 Congress Ave, Austin, TX 78701",
      "500 Main St, Dallas, TX 75201, USA",
    ]),
    "US"
  );
});

test("a market nobody stated is only claimed on one-sided evidence", () => {
  // Mixed results decide nothing.
  assert.equal(
    inferCountryFromAddresses(["Leeds, LS27 0AA, England", "Austin, TX 78701"]),
    null
  );
  // An address we cannot read is not evidence either way.
  assert.equal(inferCountryFromAddresses([]), null);
  assert.equal(inferCountryFromAddresses(["", "Suite 4"]), null);
  // A bare city name proves nothing about which Leeds or Austin it is.
  assert.equal(inferCountryFromAddresses(["Leeds", "Manchester"]), null);
});

test("a ZIP is not mistaken for a UK postcode", () => {
  // "TX 78701" must never read as a UK postcode: the shape needs two letters at
  // the end, which no American ZIP has.
  assert.equal(inferCountryFromAddresses(["Austin, TX 78701", "Dallas, TX 75201"]), "US");
  assert.equal(inferCountryFromAddresses(["Austin, TX 78701-1234"]), "US");
});

/**
 * The contract: a business is only called "elsewhere" when its address
 * positively names another place. Addresses we cannot read must never cost a
 * lead, because a silent drop is invisible while a distant lead is visible.
 */

const austin = locationTerms("Austin, USA");
const manchester = locationTerms("Manchester, UK");

test("a location box names its market, or names none", () => {
  assert.equal(manchester.country, "GB");
  assert.equal(locationTerms("Manchester, England").country, "GB");
  assert.equal(austin.country, "US");
  // Markets we don't make assumptions about stay null rather than defaulting.
  assert.equal(locationTerms("Lahore, Pakistan").country, null);
  assert.equal(locationTerms("Manchester").country, null);
});

test("an address in another country is dropped without a lookup", () => {
  // The failure the word rule makes in the other direction: this shares a word
  // with a Manchester, UK search and would otherwise be kept as local — in New
  // Hampshire.
  assert.equal(countryConflict("Manchester, United States", manchester), true);
  assert.equal(countryConflict("Manchester, NH, USA", manchester), true);
  assert.equal(countryConflict("Solon, Canada", austin), true);
  // Same country is not a conflict, whatever else the address says.
  assert.equal(countryConflict("Openshaw, United Kingdom", manchester), false);
  assert.equal(countryConflict("chorley, lancs pr6 9ar, united kingdom (GB)", manchester), false);
  assert.equal(countryConflict("Manchester, United Kingdom", manchester), false);
  assert.equal(countryConflict("Solon, United States", austin), false);
  // Silence on either side decides nothing.
  assert.equal(countryConflict("Openshaw", manchester), false);
  assert.equal(countryConflict("", manchester), false);
  assert.equal(countryConflict("Manchester, United States", locationTerms("Manchester")), false);
});

test("distance is measured, not guessed, and 25 km is the line", () => {
  // Real coordinates, real cases from the Manchester and Austin searches.
  const mcr = { lat: 53.4424618, lon: -2.2324547 };
  const openshaw = { lat: 53.4751735, lon: -2.1780609 }; // a Manchester district
  const astley = { lat: 53.5009963, lon: -2.4496899 }; // Wigan, Greater Manchester
  const chorley = { lat: 53.6531915, lon: -2.6294313 }; // Lancashire
  const tx = { lat: 30.2711286, lon: -97.7436995 };
  const roundRock = { lat: 30.5085915, lon: -97.6788056 };
  const iowa = { lat: 41.8072344, lon: -91.4940604 }; // Solon

  assert.equal(withinLocalRadius(mcr, openshaw), true); // 5.1 km
  assert.equal(withinLocalRadius(mcr, astley), true); // 15.8 km
  assert.equal(withinLocalRadius(mcr, chorley), false); // 35.3 km
  assert.equal(withinLocalRadius(tx, roundRock), false); // 27.1 km — the documented trade-off
  assert.equal(withinLocalRadius(tx, iowa), false); // another time zone
  assert.ok(Math.abs(distanceKm(mcr, openshaw) - 5.1) < 1);
  assert.ok(Math.abs(distanceKm(mcr, chorley) - 35.3) < 1.5);
  // A lookup that failed must leave the stricter verdict standing, never open
  // the gate: no origin or no point is not "local".
  assert.equal(withinLocalRadius(null, openshaw), false);
  assert.equal(withinLocalRadius(mcr, null), false);
  assert.equal(distanceKm(mcr, mcr), 0);
});

test("an address in the requested city is local", () => {
  // The three shapes the sources actually return.
  assert.equal(classifyLocality("Austin, United States", austin), "local"); // web search
  assert.equal(classifyLocality("7015 Village Center Dr, Austin, TX 78730, USA", austin), "local"); // Google
  assert.equal(classifyLocality("1206 W 38th St, Austin", austin), "local"); // OpenStreetMap
});

test("an address in another place is elsewhere", () => {
  // The real record that prompted this: an Austin search returned a practice
  // whose own address and phone number were both in Ohio.
  assert.equal(classifyLocality("Solon, United States", austin), "elsewhere");
  assert.equal(classifyLocality("Dublin, Ireland", austin), "elsewhere");
  assert.equal(classifyLocality("Springfield, Ohio", austin), "elsewhere");
});

test("a suburb keeps its lead only if the city is named", () => {
  // Documented cost of the rule: "Round Rock" is 20 minutes from Austin, but the
  // address names a different city, so it is dropped. Erring the other way would
  // let any distant city through.
  assert.equal(classifyLocality("Round Rock, TX", austin), "elsewhere");
  assert.equal(classifyLocality("Round Rock, Austin, TX", austin), "local");
});

test("an unreadable address never costs the lead", () => {
  assert.equal(classifyLocality("", austin), "unknown");
  assert.equal(classifyLocality("   ", austin), "unknown");
  assert.equal(classifyLocality("100 Main St", austin), "unknown"); // OSM with no city tag
  assert.equal(classifyLocality("TX, United States", austin), "unknown"); // state only
  assert.equal(classifyLocality("United States", austin), "unknown"); // country only
});

test("a location that names no city cannot make anything out of area", () => {
  const country = locationTerms("USA");
  assert.deepEqual(country.tokens, []);
  assert.equal(classifyLocality("Solon, United States", country), "unknown");
  assert.equal(classifyLocality("Lahore, Pakistan", country), "unknown");
});

test("city names are matched whole, never as fragments", () => {
  // "Austinton" must not read as Austin.
  assert.equal(classifyLocality("Austinton, CA", austin), "elsewhere");
  assert.equal(classifyLocality("Austinbury, CA", austin), "elsewhere");
});

test("any part of what the user typed can place a lead", () => {
  // A Brooklyn search whose leads are addressed "New York, NY" is normal.
  const brooklyn = locationTerms("Brooklyn, New York, USA");
  assert.equal(classifyLocality("New York, NY", brooklyn), "local");
  assert.equal(classifyLocality("Buffalo, NY", brooklyn), "local"); // same state as asked
  assert.equal(classifyLocality("Newark, NJ", brooklyn), "elsewhere");
});

test("a state search matches postal codes", () => {
  const texas = locationTerms("Texas, USA");
  assert.equal(texas.tokens.includes("tx"), true);
  assert.equal(classifyLocality("Dallas, TX", texas), "local");
  assert.equal(classifyLocality("Denver, CO", texas), "elsewhere");
});

test("matching is case and accent insensitive", () => {
  const munich = locationTerms("München, Germany");
  assert.equal(classifyLocality("münchen, germany", munich), "local");
  assert.equal(classifyLocality("Munich, Germany", munich), "elsewhere"); // English spelling differs
  const lahore = locationTerms("Lahore, Pakistan");
  assert.equal(classifyLocality("LAHORE, PAKISTAN", lahore), "local");
});

test("locationTerms keeps the city and drops the country", () => {
  assert.deepEqual(locationTerms("Austin, USA").tokens, ["austin"]);
  assert.equal(locationTerms("Austin, USA").label, "Austin, USA");
  assert.deepEqual(locationTerms("Brooklyn, New York, USA").tokens, [
    "brooklyn",
    "new york",
    "ny",
  ]);
});
