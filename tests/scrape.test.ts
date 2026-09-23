import { test } from "node:test";
import assert from "node:assert/strict";

const scrapeState = await import("../lib/scrape.ts");
const { extractLocalBusiness, extractOwnerName, pagePhone, reconcilePhone } = scrapeState;

/**
 * Two rules decided this turn's value, so both are pinned here.
 *
 * `extractLocalBusiness` reads what a business publishes about *itself* for
 * Google — the most trustworthy contact data on a page, and the only source of
 * a phone number that the owner explicitly wants called.
 *
 * `extractOwnerName` is strict on purpose: a wrong name in a cold opener costs
 * more than no name, so it must stay silent unless a human name sits beside an
 * ownership role.
 */

test("structured data: contact details come from the business block", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Plumber","name":"Acme Plumbing",
     "telephone":"+44 161 496 0000","email":"mailto:hello@acmeplumbing.co.uk",
     "address":{"@type":"PostalAddress","streetAddress":"12 High Street","addressLocality":"Manchester","postalCode":"M1 1AA"},
     "sameAs":["https://www.instagram.com/acmeplumbing/"]}
  </script></head><body></body></html>`;
  const b = extractLocalBusiness(html);
  assert.equal(b.name, "Acme Plumbing");
  assert.equal(b.phone, "+44 161 496 0000");
  assert.equal(b.email, "hello@acmeplumbing.co.uk");
  assert.equal(b.address, "12 High Street, Manchester, M1 1AA");
  assert.deepEqual(b.socials, ["https://www.instagram.com/acmeplumbing/"]);
});

test("structured data: details split across @graph entries are merged", () => {
  const html = `<script type="application/ld+json">
    {"@graph":[
      {"@type":"WebSite","name":"Acme","url":"https://acme.co.uk"},
      {"@type":"Organization","name":"Acme Plumbing Ltd","telephone":"0161 496 0000"},
      {"@type":"PostalAddress","streetAddress":"5 Mill Lane","addressLocality":"Leeds"}
    ]}</script>`;
  const b = extractLocalBusiness(html);
  assert.equal(b.name, "Acme Plumbing Ltd");
  assert.equal(b.phone, "0161 496 0000");
  // A bare PostalAddress is not a business, but its address still belongs to one.
  assert.equal(b.address, "");
});

test("structured data: page-level blocks are not mistaken for a business", () => {
  const html = `<script type="application/ld+json">
    {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","name":"Home"}]}
  </script>
  <script type="application/ld+json">
    {"@type":"WebPage","name":"Contact us","isPartOf":{"@type":"WebSite","name":"Site"}}
  </script>`;
  const b = extractLocalBusiness(html);
  assert.equal(b.name, "");
  assert.equal(b.phone, "");
});

test("structured data: a broken block does not hide a good one", () => {
  const html = `<script type="application/ld+json">{ oops: not json }</script>
    <script type="application/ld+json">{"@type":"LocalBusiness","telephone":"512.454.4211"}</script>`;
  assert.equal(extractLocalBusiness(html).phone, "512.454.4211");
});

test("structured data: an address given as a string is kept as written", () => {
  const html = `<script type="application/ld+json">
    {"@type":"Restaurant","address":"91 Brick Lane, London E1 6QL"}</script>`;
  assert.equal(extractLocalBusiness(html).address, "91 Brick Lane, London E1 6QL");
});

test("structured data: nothing published means nothing invented", () => {
  const b = extractLocalBusiness("<html><body>Just a website</body></html>");
  assert.deepEqual(b, { name: "", phone: "", email: "", address: "", socials: [] });
});

test("owner name: the common ways a site states it are all found", () => {
  assert.deepEqual(extractOwnerName("<p>Mark Thompson, Director</p>"), {
    name: "Mark Thompson",
    role: "director",
  });
  assert.deepEqual(extractOwnerName("Owner: Sarah O'Brien"), {
    name: "Sarah O'Brien",
    role: "owner",
  });
  assert.deepEqual(extractOwnerName("Jane Doe is the founder of Acme Plumbing"), {
    name: "Jane Doe",
    role: "founder",
  });
  assert.deepEqual(extractOwnerName("Managing Director: John A. Smith"), {
    name: "John A. Smith",
    role: "managing director",
  });
  assert.deepEqual(extractOwnerName("Our team is led by Alan Brown, proprietor"), {
    name: "Alan Brown",
    role: "owner",
  });
  assert.deepEqual(extractOwnerName("Contact our owner Jane Doe on 0161 496 0000"), {
    name: "Jane Doe",
    role: "owner",
  });
});

test("owner name: a full stop ends the name, it does not join the next line", () => {
  // "Jane Doe. Accounts: Paul Smith" is one person; a window that reads through
  // the sentence boundary would glue two names together or pick the wrong one.
  assert.deepEqual(extractOwnerName("Owner Jane Doe. Accounts: Paul Smith"), {
    name: "Jane Doe",
    role: "owner",
  });
  assert.deepEqual(extractOwnerName("Owner Jane Doe | Accounts: Paul Smith"), {
    name: "Jane Doe",
    role: "owner",
  });
});

test("owner name: a window cut mid-word never invents a person", () => {
  // The role word sits far enough along that a naive character window slices a
  // surname in half — and "Paul Sm" is a name nobody has.
  const padded = "x".repeat(40);
  const mention = extractOwnerName(`Owner Jane Doe. ${padded} Accounts: Paul Smith`);
  assert.deepEqual(mention, { name: "Jane Doe", role: "owner" });
});

test("owner name: the owner outranks a director, and the nearest name wins", () => {
  const mention = extractOwnerName("Director Alan Brown — Owner Rachel Green");
  assert.deepEqual(mention, { name: "Rachel Green", role: "owner" });
  const tied = extractOwnerName("Owner Jane Doe. Accounts: Paul Smith");
  assert.deepEqual(tied, { name: "Jane Doe", role: "owner" });
});

test("owner name: a business, a job title or a headline is not a person", () => {
  assert.equal(extractOwnerName("Acme Plumbing Ltd, registered in England"), null);
  assert.equal(extractOwnerName("Director, Acme Plumbing Ltd"), null);
  assert.equal(extractOwnerName("Contact us today for a free quote"), null);
  assert.equal(extractOwnerName("Our Team"), null);
  assert.equal(extractOwnerName("We are the leading plumbing company in Leeds"), null);
  assert.equal(extractOwnerName("Marketing Manager Jane Doe"), null);
  assert.equal(extractOwnerName("Registered office: 12 High Street"), null);
  assert.equal(extractOwnerName("Owner Finance Available"), null);
  assert.equal(extractOwnerName("Meet the team behind Acme Plumbing"), null);
});

test("owner name: nothing to read is not a guess", () => {
  assert.equal(extractOwnerName(""), null);
  assert.equal(extractOwnerName("<div><span></span></div>"), null);
});

test("page phone: a tel: link is what the page wants dialled", () => {

  const html = `<a href="tel:+441132718830">Call us</a><p>Other numbers: 020 7946 0000</p>`;
  assert.equal(pagePhone(html, { uk: true }), "+441132718830");
});

test("page phone: markup numbers are not phone numbers", () => {

  // The exact false positive a real Wix page produced: an inline SVG's
  // coordinates read as a ten-digit phone number.
  const html = `<div style="background:url(&quot;data:image/svg+xml,%3Csvg preserveAspectRatio='none' data-bbox='20 20 160 160' viewBox='20 20 160 160'%3E%3C/svg%3E&quot;)"></div>
    <p>Call us on 0113 2718830</p>`;
  assert.equal(pagePhone(html, { uk: true }), "0113 2718830");
  const onlyCoords = `<svg data-bbox="20 20 160 160"><rect x="20" y="20"/></svg>`;
  assert.equal(pagePhone(onlyCoords, { uk: true }), "");
});

test("reconcile: a truncated copy is replaced by the number the site publishes", () => {

  // Real lead: the source field said "0113 271883", the site says 0113 2718830.
  assert.equal(reconcilePhone("0113 271883", "0113 2718830", { uk: true }), "0113 2718830");
  // A different number is never overwritten — a second line is not an error.
  assert.equal(reconcilePhone("020 7946 0000", "0113 2718830", { uk: true }), "020 7946 0000");
  // No site number, or no current number: the sensible side wins.
  assert.equal(reconcilePhone("0113 2718830", "", { uk: true }), "0113 2718830");
  assert.equal(reconcilePhone("", "0113 2718830", { uk: true }), "0113 2718830");
  assert.equal(reconcilePhone("512.454.4211", "512.454.4211", {}), "512.454.4211");
});

test("reconcile: international and national spellings are the same number", () => {
  const { reconcilePhone } = scrapeState;
  // Two real leads: the source field truncated a number the site spells in full,
  // and in both cases the two spellings differ in format as well as length.
  assert.equal(reconcilePhone("0113-337-213", "+44 113 337 2130", { uk: true }), "+44 113 337 2130");
  assert.equal(reconcilePhone("03332 421 129", "0333 242 1129", { uk: true }), "03332 421 129");
  assert.equal(reconcilePhone("0044 113 337 213", "+44 113 337 2130", { uk: true }), "+44 113 337 2130");
  assert.equal(reconcilePhone("512.454.421", "(512) 454-4211", {}), "(512) 454-4211");
  assert.equal(reconcilePhone("1 512 454 4211", "512.454.4211", {}), "1 512 454 4211");
  // A mobile is not a truncated landline.
  assert.equal(reconcilePhone("07700 900123", "0113 496 0000", { uk: true }), "07700 900123");
});

test("phone repair: a trunk zero after a country code is removed, not added", () => {
  const { pickPhone, restoreTrunkPrefix } = scrapeState;
  // A real source field: "+44-0113 242 8411" dials nothing from anywhere.
  assert.equal(restoreTrunkPrefix("+44-0113 242 8411"), "+44 113 242 8411");
  assert.equal(restoreTrunkPrefix("0044 0113 242 8411"), "+44 113 242 8411");
  assert.equal(pickPhone("+44-0113 242 8411", { uk: true }), "+44 113 242 8411");
  // Correct numbers are left exactly as they arrived.
  assert.equal(restoreTrunkPrefix("+44 113 242 8411"), "+44 113 242 8411");
  assert.equal(restoreTrunkPrefix("0113 242 8411"), "0113 242 8411");
  assert.equal(restoreTrunkPrefix("512.454.4211"), "512.454.4211");
  assert.equal(restoreTrunkPrefix("+1 (512) 454-4211"), "+1 (512) 454-4211");
});

test("own-website: a domain has to share a real word with the business name", () => {
  const { officialWebsiteFrom } = scrapeState;
  const results = `Title: Thompson Heating
URL: https://www.thompsonheating.co.uk/contact
Phone: 0113 268 2298`;
  assert.equal(
    officialWebsiteFrom(results, "Thompson Heating Ltd"),
    "https://www.thompsonheating.co.uk/contact"
  );
  // A different firm in the same results is not this firm's website.
  assert.equal(officialWebsiteFrom("URL: https://www.otherplumbing.co.uk/", "Thompson Heating Ltd"), "");
});

test("own-website: a directory or a social page is not a website", () => {
  const { officialWebsiteFrom } = scrapeState;
  assert.equal(
    officialWebsiteFrom("https://www.facebook.com/thompsonheating", "Thompson Heating Ltd"),
    ""
  );
  assert.equal(
    officialWebsiteFrom("https://www.checkatrade.com/thompson-heating", "Thompson Heating Ltd"),
    ""
  );
  assert.equal(
    officialWebsiteFrom("https://www.thompsonheating.co.uk", "Thompson Heating Ltd"),
    "https://www.thompsonheating.co.uk"
  );
});

test("own-website: generic words and empty results decide nothing", () => {
  const { officialWebsiteFrom } = scrapeState;
  assert.equal(officialWebsiteFrom("", "Thompson Heating Ltd"), "");
  // \"Services\", \"Group\" and \"Ltd\" say nothing about which domain is theirs.
  assert.equal(officialWebsiteFrom("https://www.services.co.uk", "Acme Services Ltd"), "");
  // A name containing a place matches a domain containing that place. Excluding a
  // lead here is the safe direction: claiming a business has no site when it has
  // one is the mistake this function exists to prevent.
  assert.equal(officialWebsiteFrom("https://www.leeds.co.uk/acme", "Acme Leeds Ltd"), "https://www.leeds.co.uk/acme");
});

/**
 * Attribution: whose contact detail is this?
 *
 * The bug these pin is the worst one this product can ship. One web lookup for a
 * Leeds roofer returned b2bhint, opencorpdata and clarity-project beside the
 * real result, and the code read the *whole* reply for the first email — which
 * was clarity-project's own address, printed on every page it publishes. In one
 * test run that single address was handed to nine different businesses across
 * three cities. A lead list that emails a directory instead of the business is
 * worse than an empty one: the user finds out in front of the prospect.
 */

test("a search reply is read as separate results, not one blob", () => {
  const { splitSearchResults } = scrapeState;
  const reply = [
    "Title: DEC ROOFING (YORKSHIRE) LIMITED | B2BHint",
    "URL: https://b2bhint.com/en/company/gb/dec-roofing--17287858",
    "Highlights:",
    "Contact details partially masked",
    "",
    "---",
    "",
    "Title: Dec Roofing (Yorkshire) Limited — contact",
    "URL: https://decroofing.co.uk/contact",
    "Highlights:",
    "Call 0113 271 8830 or email info@decroofing.co.uk",
  ].join("\n");
  const results = splitSearchResults(reply);
  assert.equal(results.length, 2);
  assert.equal(results[0].host, "b2bhint.com");
  assert.equal(results[1].host, "decroofing.co.uk");
  assert.match(results[1].title, /Dec Roofing/);
  assert.equal(splitSearchResults("").length, 0);
});


test("a person's profile is only taken from a personal path", () => {
  const { personProfileFromUrl } = scrapeState;
  assert.deepEqual(personProfileFromUrl("https://www.linkedin.com/in/damian-greenshields"), {
    linkedin: "in/damian-greenshields",
    x: "",
  });
  assert.deepEqual(personProfileFromUrl("https://x.com/damianroofing"), { linkedin: "", x: "damianroofing" });
  // X caps a handle at 15 characters, so a longer run is not one.
  assert.deepEqual(personProfileFromUrl("https://x.com/damiangreenshields"), { linkedin: "", x: "" });
  assert.deepEqual(personProfileFromUrl("https://twitter.com/damian_g"), { linkedin: "", x: "damian_g" });
  // A company page is not the human being looked for.
  assert.deepEqual(personProfileFromUrl("https://www.linkedin.com/company/ironpeak-roofing"), {
    linkedin: "",
    x: "",
  });
  // X's own navigation renders people handles that are not people.
  assert.deepEqual(personProfileFromUrl("https://x.com/home"), { linkedin: "", x: "" });
  assert.deepEqual(personProfileFromUrl("https://x.com/i/flow/login"), { linkedin: "", x: "" });
  assert.deepEqual(personProfileFromUrl("https://example.com/in/not-linkedin"), { linkedin: "", x: "" });
  assert.deepEqual(personProfileFromUrl(""), { linkedin: "", x: "" });
});

test("the person lookup asks about the person, not the company", () => {
  const { peopleQuery } = scrapeState;
  const named = peopleQuery("Ironpeak Roofing Services Ltd", "Leeds", "Damian Marcus Greenshields");
  assert.match(named.query, /category:people/);
  assert.match(named.query, /"Damian Marcus Greenshields"/);
  assert.match(named.query, /Ironpeak Roofing Services Ltd/);
  assert.match(named.objective, /not a different person with a similar name/);
  assert.match(named.objective, /director/);

  // With no name, the old question — and no stray quotes around a missing one.
  const unnamed = peopleQuery("Ironpeak Roofing Services Ltd", "Leeds");
  assert.match(unnamed.query, /founder or owner of Ironpeak Roofing Services Ltd Leeds/);
  assert.doesNotMatch(unnamed.query, /"/);
});

test("a company with several directors is asked about in one lookup", () => {
  const { peopleQuery } = scrapeState;
  const both = peopleQuery("TL Roofing Limited", "Leeds", ["Lee Chippendale", "Thomas Pritchard"]);
  // One search, both names, no call per director.
  assert.equal((both.query.match(/category:people/g) ?? []).length, 1);
  assert.match(both.query, /"Lee Chippendale" OR "Thomas Pritchard"/);
  assert.match(both.objective, /directors of TL Roofing Limited/);

  // A single name stays exactly the shape the live endpoint was checked with.
  const one = peopleQuery("TL Roofing Limited", "Leeds", ["Lee Chippendale"]);
  assert.match(one.query, /category:people "Lee Chippendale" TL Roofing Limited/);
  assert.doesNotMatch(one.query, / OR /);

  // Blank and missing names are not searched for.
  const blanks = peopleQuery("TL Roofing Limited", "Leeds", ["  ", ""]);
  assert.match(blanks.query, /founder or owner of TL Roofing Limited/);
});

test("any director the record names can be the person found", () => {
  const { personNameMatchesAny } = scrapeState;
  const directors = ["Lee Chippendale", "Thomas Pritchard"];
  // The second director counts even when the first was the one asked about.
  assert.equal(personNameMatchesAny("Thomas Pritchard", directors), true);
  assert.equal(personNameMatchesAny("Lee Chippendale", directors), true);
  // Widening the set of *known* people does not admit an unknown one.
  assert.equal(personNameMatchesAny("Lee Chippendal", directors), false);
  assert.equal(personNameMatchesAny("Karen Chippendale", directors), false);
  assert.equal(personNameMatchesAny("Lee Chippendale", []), false);
});

test("the name a person goes by is accepted for the name on the record", () => {
  const { personNameMatches } = scrapeState;
  // The register writes the formal name; the profile carries the chosen one.
  // Refusing this silently loses the very person the lookup exists to find.
  assert.equal(personNameMatches("Tom Pritchard", "Thomas Pritchard"), true);
  // The prefix family, with no table entry at all.
  assert.equal(personNameMatches("Chris Greenshields", "Christopher Greenshields"), true);
  assert.equal(personNameMatches("Dan White", "Daniel White"), true);
  assert.equal(personNameMatches("Alex Chippendale", "Alexander Chippendale"), true);
  // Either direction, since which side is formal depends on the record.
  assert.equal(personNameMatches("Thomas Pritchard", "Tom Pritchard"), true);
  assert.equal(personNameMatches("Christopher Greenshields", "Chris Greenshields"), true);

  // Bounded: the surname must still match exactly, so a diminutive only ever
  // renames a person who is already the one the record named.
  assert.equal(personNameMatches("Tom Hanks", "Thomas Pritchard"), false);
  assert.equal(personNameMatches("Tom Pritchard", "Thomas Green"), false);
  // Two letters is a different person more often than a nickname.
  assert.equal(personNameMatches("Jo Pritchard", "Josephine Pritchard"), false);
  // Not a prefix and not in the table: a wrong match here writes to somebody
  // who has never heard of this business, which is the worse error.
  assert.equal(personNameMatches("Jenny Edwards", "Jennifer Davis"), false);
  assert.equal(personNameMatches("Bob Hanks", "Robert Pritchard"), false);
});

test("a profile name is checked against a name from an official record", () => {
  const { personNameMatches } = scrapeState;
  // The register writes an exact name; people write themselves however they
  // like. First name and last name together survive every difference that is
  // not identity — which is why the check is those two, not the whole string.
  assert.equal(personNameMatches("Damian Greenshields", "Damian Marcus Greenshields"), true);
  assert.equal(personNameMatches("Damian Marcus Greenshields", "Damian Marcus Greenshields"), true);
  // The register puts the surname first; the profile reverses it.
  assert.equal(personNameMatches("Wei Ming Lee", "Lee, Wei Ming"), true);
  // Accents differ by keyboard, not by person.
  assert.equal(personNameMatches("Jose Alvarez", "José Álvarez"), true);

  // A relative who shares the surname, and a namesake who shares the first name.
  assert.equal(personNameMatches("Marcus Greenshields", "Damian Marcus Greenshields"), false);
  assert.equal(personNameMatches("Damian Green", "Damian Marcus Greenshields"), false);
  // A near-miss spelling is refused: attaching the wrong stranger is worse.
  assert.equal(personNameMatches("Damien Greenshields", "Damian Marcus Greenshields"), false);
  // An initial is not an identity.
  assert.equal(personNameMatches("D Greenshields", "Damian Marcus Greenshields"), false);

  assert.equal(personNameMatches("Cher", "Cher"), true);
  assert.equal(personNameMatches("", "Damian Greenshields"), false);
  assert.equal(personNameMatches("Damian Greenshields", ""), false);
});

test("a social profile is matched by its handle, not its host", () => {
  const { socialProfileMatches } = scrapeState;
  const name = "Dec Roofing (Yorkshire) Limited";
  assert.equal(socialProfileMatches("instagram.com", "https://instagram.com/roofingleeds", name), true);
  assert.equal(
    socialProfileMatches("facebook.com", "https://facebook.com/decroofingyorkshire", name),
    true
  );
  // Someone else's profile, and a post rather than a profile.
  assert.equal(socialProfileMatches("instagram.com", "https://instagram.com/leedscafe", name), false);
  assert.equal(socialProfileMatches("instagram.com", "https://instagram.com/p/CxyZ", name), false);
  // A host that is not a social platform is judged by host, not handle.
  assert.equal(socialProfileMatches("decroofing.co.uk", "https://decroofing.co.uk/x", name), false);
});

test("register mirrors and directories are refused outright", () => {
  const { isDirectoryHost } = scrapeState;
  for (const host of [
    "clarity-project.co.uk",
    "b2bhint.com",
    "opencorpdata.com",
    "companyatlas.co.uk",
    "newcohunter.co.uk",
    "zoominfo.com",
    "instagram.com",
    "yell.com",
  ]) {
    assert.equal(isDirectoryHost(host), true, `${host} must never speak for a business`);
  }
  assert.equal(isDirectoryHost("decroofing.co.uk"), false);
  assert.equal(isDirectoryHost(""), true);
});

test("a UK number has to have a UK number's shape", () => {
  const { isPlausibleUkPhone, isPlausiblePhone } = scrapeState;
  // Eleven national digits is always two things glued together: here an area
  // code followed by an eight-digit run, which reached a real user's list.
  assert.equal(isPlausibleUkPhone("+44 (1783) 1097778"), false);
  assert.equal(isPlausibleUkPhone("17858 182-184"), false);
  assert.equal(isPlausibleUkPhone("+44-1252 4502716"), false);
  assert.equal(isPlausibleUkPhone("+44 161 230 7651"), true);
  assert.equal(isPlausibleUkPhone("0161 230 7651"), true);
  assert.equal(isPlausibleUkPhone("07467 224271"), true);
  assert.equal(isPlausibleUkPhone("0121 705 1982"), true);
  // A trunk zero under a country code is repaired, not rejected.
  assert.equal(isPlausibleUkPhone("+44 (0)161 230 7651"), true);
  // A digit missing: a search snippet truncating a real number produced this,
  // and it went out on a dial list. Every UK national number is 10 digits.
  assert.equal(isPlausibleUkPhone("+44 113 275 262"), false);
  assert.equal(isPlausibleUkPhone("113275262"), false);
  assert.equal(isPlausibleUkPhone("0113 275 2629"), true);
  // An ellipsis means a search result was truncated, so the digits around it
  // were never one number ("a company number ... the start of an address").
  assert.equal(isPlausiblePhone("(17164805) ... 54", { uk: true }), false);
  assert.equal(isPlausiblePhone("(17164805) ... 54"), false);
});

test("a UK lookup never dials a glued or malformed number", () => {
  const { extractPhone } = scrapeState;
  const junk =
    "Company number 17164805 ... 54. Registered office 17858 182-184, Leeds. Phone +44 (1783) 1097778.";
  assert.equal(extractPhone(junk, { uk: true }), "");
  assert.equal(extractPhone("Call us on 0113 271 8830 today.", { uk: true }), "0113 271 8830");
});
