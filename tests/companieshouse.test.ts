import { describe, it } from "node:test";
import assert from "node:assert/strict";

const ch = await import("../lib/companieshouse.ts");
const {
  advancedSearchUrl,
  agePhrase,
  companiesHouseRequest,
  companyToLead,
  formatRegisteredAddress,
  incorporatedFromIso,
  isUkLocation,
  keywordFor,
  locationQuery,
  requestSize,
  sicCodesFor,
  sicSummary,
  titleCaseCompanyName,
} = ch;

describe("niche → SIC codes", () => {
  it("maps the trades the product actually sells to", () => {
    assert.deepEqual(sicCodesFor("roofer"), ["43910"]);
    assert.deepEqual(sicCodesFor("Roofers"), ["43910"]);
    assert.deepEqual(sicCodesFor("plumber"), ["43220"]);
    assert.deepEqual(sicCodesFor("hairdresser"), ["96020"]);
    assert.deepEqual(sicCodesFor("takeaways"), ["56103"]);
  });

  it("singularises before giving up, either direction", () => {
    assert.deepEqual(sicCodesFor("electricians"), ["43210"]);
    assert.deepEqual(sicCodesFor("dentists"), ["86230"]);
  });

  it("finds the trade named inside a longer phrase", () => {
    assert.deepEqual(sicCodesFor("commercial roofing"), ["43910"]);
    assert.deepEqual(sicCodesFor("emergency plumbing"), ["43220"]);
    assert.deepEqual(sicCodesFor("estate agents in a posh area"), ["68310"]);
    // The earliest match wins, so the trade the phrase leads with is the one
    // classified — window cleaning, not the general "cleaning company" it ends
    // with. Both keys are here on purpose; they return different codes.
    assert.deepEqual(sicCodesFor("window cleaning company"), ["81221"]);
    assert.deepEqual(sicCodesFor("cleaning company"), ["81210"]);
  });

  it("returns nothing for a trade it has not reviewed, rather than guessing", () => {
    assert.deepEqual(sicCodesFor("dog groomer"), []);
    assert.deepEqual(sicCodesFor(""), []);
    // "bar" is a reviewed entry; "barbecue" must not match it.
    assert.deepEqual(sicCodesFor("barbecue caterer"), ["56210"]);
  });

  it("quotes the register's own description of the activity", () => {
    assert.equal(sicSummary(["43910"]), "SIC 43910 roofing activities");
    assert.equal(sicSummary(["99999"]), "SIC 99999");
    assert.equal(sicSummary(undefined), "");
  });
});

describe("the name-includes fallback", () => {
  it("picks the most distinctive word, not the whole phrase", () => {
    assert.equal(keywordFor("dog groomer"), "groomer");
    assert.equal(keywordFor("vegan bistro"), "bistro");
  });

  it("drops words that describe every company", () => {
    assert.equal(keywordFor("local cleaning services"), "cleaning");
    assert.equal(keywordFor("the best window cleaning company"), "cleaning");
    // The head noun comes last in English, and it is the word a registered name
    // actually carries: "… WINDOW CLEANING LTD".
    assert.equal(keywordFor("commercial roofing"), "roofing");
    assert.equal(keywordFor("emergency plumbing"), "plumbing");
  });

  it("falls back to the words typed when every word is generic", () => {
    assert.equal(keywordFor("services"), "services");
    assert.equal(keywordFor(""), "");
  });
});

describe("location", () => {
  it("accepts UK searches, with or without naming the country", () => {
    assert.equal(isUkLocation("Manchester, UK"), true);
    assert.equal(isUkLocation("Leeds"), true); // no country named — the register only holds UK rows
    assert.equal(isUkLocation("M20 4AB"), true);
    assert.equal(isUkLocation("Belfast, Northern Ireland"), true);
  });

  it("refuses a country the register cannot answer for", () => {
    assert.equal(isUkLocation("Austin, USA"), false);
    assert.equal(isUkLocation("Lahore, Pakistan"), false);
    assert.equal(isUkLocation("Manchester, United States"), false);
    assert.equal(isUkLocation("Dublin, Ireland"), false);
    assert.equal(isUkLocation("Milton Keynes, UK"), true); // a US-looking name, but it's ours
  });

  it("asks for the town the register indexes, not the user's full phrase", () => {
    assert.equal(locationQuery("Manchester, UK"), "Manchester");
    assert.equal(locationQuery("Leeds, West Yorkshire"), "Leeds");
    assert.equal(locationQuery("London"), "London");
    assert.equal(locationQuery("M20 4AB"), "M20 4AB");
  });

  it("never sends a street, which the register answers with a different town", () => {
    // Measured against the live service: location="High Street" returns 971
    // companies in Kidlington. A user who types their own address must get their
    // own town's businesses, not Kidlington's.
    assert.equal(locationQuery("10 High Street, Leeds"), "Leeds");
    assert.equal(locationQuery("Unit B, Roseville Road, Leeds"), "Leeds");
    assert.equal(locationQuery("Suite 4, 12 Main St, Manchester"), "Manchester");
    assert.equal(locationQuery("12 Main St, Honley, Holmfirth"), "Honley");
    // Everything looks like a street: the last segment is still the best guess.
    assert.equal(locationQuery("12 High Street, Roseville Road"), "Roseville Road");
  });

  it("prefers the postcode, which is the most precise thing it understands", () => {
    // Verified live: a full postcode resolves (LS18 4TJ → 146 companies).
    assert.equal(locationQuery("Leeds, LS1 4DY"), "LS1 4DY");
    assert.equal(locationQuery("Leeds LS1 4DY"), "LS1 4DY");
    assert.equal(locationQuery("12 Main St, Leeds ls1 4dy"), "LS1 4DY");
  });
});

describe("the request it sends", () => {
  const base = { location: "Manchester, UK", incorporatedFrom: "2024-09-21", size: 90 };

  it("filters the register to active trading companies", () => {
    const url = advancedSearchUrl({ ...base, sicCodes: ["43910"] });
    const q = new URL(url).searchParams;
    assert.equal(new URL(url).pathname, "/advanced-search/companies");
    assert.deepEqual(q.getAll("sic_codes"), ["43910"]);
    assert.deepEqual(q.getAll("company_type"), ["ltd", "llp"]);
    assert.equal(q.get("company_status"), "active");
    assert.equal(q.get("location"), "Manchester");
    assert.equal(q.get("incorporated_from"), "2024-09-21");
    assert.equal(q.get("size"), "90");
  });

  it("falls back to a name match for an unreviewed trade", () => {
    const q = new URL(advancedSearchUrl({ ...base, nameIncludes: "groomer" })).searchParams;
    assert.equal(q.get("company_name_includes"), "groomer");
    assert.equal(q.getAll("sic_codes").length, 0);
  });

  it("asks for a multiple of the window, because websites are checked afterwards", () => {
    assert.equal(requestSize(60), 180);
    assert.equal(requestSize(15), 60); // floor
    assert.equal(requestSize(1000), 300); // ceiling — one free request, not a bill
  });

  it("authenticates the way the service actually does — key as basic username", () => {
    const { headers, url } = companiesHouseRequest("roofer", "Manchester, UK", 20, "abc123");
    assert.equal(headers.Authorization, `Basic ${Buffer.from("abc123:").toString("base64")}`);
    assert.match(url, /sic_codes=43910/);
  });

  it("counts the recency window back in months, in UTC", () => {
    const now = new Date("2026-09-21T12:00:00Z");
    assert.equal(incorporatedFromIso(now, 24), "2024-09-21");
    assert.equal(incorporatedFromIso(now, 1), "2026-08-21");
    // A month-end date must not roll forward past the previous month.
    assert.equal(incorporatedFromIso(new Date("2026-03-31T00:00:00Z"), 1), "2026-02-28");
  });
});

describe("reading a register record", () => {
  it("turns a record into a lead with the register's facts in its notes", () => {
    const c = {
      company_name: "HALLIWELL ROOFING LIMITED",
      company_number: "12345678",
      company_status: "active",
      company_type: "ltd",
      date_of_creation: "2026-08-01",
      sic_codes: ["43910"],
      registered_office_address: {
        address_line_1: "12 Mill Street",
        locality: "Manchester",
        postal_code: "M4 1AB",
        country: "England",
      },
    };
    const lead = companyToLead(c, "roofer");
    assert.equal(lead.business_name, "Halliwell Roofing Limited");
    assert.equal(lead.address, "12 Mill Street, Manchester, M4 1AB, England");
    assert.equal(lead.website, "");
    assert.equal(lead.email, "");
    assert.equal(lead.source, "companies_house");
    assert.match(lead.notes, /Company no\. 12345678/);
    assert.match(lead.notes, /SIC 43910 roofing activities/);
    assert.match(lead.notes, /^Registered .* \(2026-08-01\)/);
  });

  it("survives a record with no address and no creation date", () => {
    const lead = companyToLead({ company_name: "SPARSE LTD" }, "roofer");
    assert.equal(lead.business_name, "Sparse Ltd");
    assert.equal(lead.address, "");
    assert.equal(lead.notes, "");
  });

  it("drops empty address lines instead of leaving double commas", () => {
    assert.equal(
      formatRegisteredAddress({ address_line_1: "1 High St", postal_code: "M1 1AA" }),
      "1 High St, M1 1AA"
    );
    assert.equal(formatRegisteredAddress(undefined), "");
  });

  it("says how new the business is, in words a person would use", () => {
    const now = new Date("2026-09-21T00:00:00Z");
    assert.equal(agePhrase("2026-09-21", now), "today");
    assert.equal(agePhrase("2026-09-20", now), "yesterday");
    assert.equal(agePhrase("2026-09-14", now), "7 days ago");
    assert.equal(agePhrase("2026-08-21", now), "4 weeks ago");
    assert.equal(agePhrase("2026-05-21", now), "4 months ago");
    assert.equal(agePhrase("2024-09-21", now), "2 years ago");
    assert.equal(agePhrase("not a date", now), "");
  });
});

describe("company names as the register publishes them", () => {
  it("stops shouting, without mangling the name", () => {
    assert.equal(titleCaseCompanyName("ROOFING PLUS SERVICES LIMITED"), "Roofing Plus Services Limited");
    assert.equal(titleCaseCompanyName("ACME ROOFING LTD"), "Acme Roofing Ltd");
    assert.equal(titleCaseCompanyName("J.HEMPSTOCK & CO LTD"), "J.Hempstock & Co Ltd");
    assert.equal(titleCaseCompanyName("MCGREGOR & SONS LLP"), "McGregor & Sons LLP");
    assert.equal(titleCaseCompanyName("O'BRIEN PLUMBING PLC"), "O'Brien Plumbing PLC");
    assert.equal(titleCaseCompanyName("THE LEEDS PLUMBER LTD"), "The Leeds Plumber Ltd");
  });

  it("leaves an already-cased name exactly as it was", () => {
    assert.equal(titleCaseCompanyName("McDonald & Sons Ltd"), "McDonald & Sons Ltd");
    assert.equal(titleCaseCompanyName("iPhone Repairs Ltd"), "iPhone Repairs Ltd");
  });
});

/**
 * Who runs the company.
 *
 * The register publishes no phone, no email and no trading address — but it does
 * name the people behind the business, and for a company incorporated weeks ago
 * that is the only way in that exists. It is also the one contact detail here
 * that is checked rather than guessed: the register's own record, quotable and
 * correctable, unlike a name inferred from a team page.
 */
describe("officers", () => {
  it("names active directors, in the register's own order", () => {
    const { directorNames } = ch;
    assert.deepEqual(
      directorNames([
        { name: "ENOCH, Darren Charles", officer_role: "director" },
        { name: "SMITH, Jane", officer_role: "secretary" },
        { name: "JONES, Alan", officer_role: "director", resigned_on: "2020-01-01" },
        { name: "LEE, Wei Ming", officer_role: "director" },
        { name: "PATEL, Ravi", officer_role: "director" },
      ]),
      ["Darren Charles Enoch", "Wei Ming Lee"]
    );
  });

  it("keeps LLP members, who are the people to reach at an LLP", () => {
    const { directorNames } = ch;
    assert.deepEqual(
      directorNames([
        { name: "SMITH, Jane Anne", officer_role: "llp-designated-member" },
        { name: "KHAN, Omar", officer_role: "llp-member" },
      ]),
      ["Jane Anne Smith", "Omar Khan"]
    );
  });

  it("survives a missing or unrecognised role instead of guessing", () => {
    const { directorNames } = ch;
    assert.deepEqual(directorNames(undefined), []);
    assert.deepEqual(directorNames([{ name: "SMITH, Jane" }]), []);
    assert.deepEqual(directorNames([{ officer_role: "director" }]), []);
  });

  it("re-cases a register name without shouting", () => {
    const { personName } = ch;
    assert.equal(personName("ENOCH, Darren Charles"), "Darren Charles Enoch");
    // The register writes the surname in capitals and leaves the forename alone,
    // so the company-name caster cannot be used here: it leaves mixed case as
    // published, which would hand over "Sean O'BRIEN".
    assert.equal(personName("O'BRIEN, Sean"), "Sean O'Brien");
    assert.equal(personName("SMITH"), "Smith");
    assert.equal(personName(""), "");
  });

  it("asks for the officers of one company, not the whole register", () => {
    const { officersUrl } = ch;
    assert.equal(
      officersUrl("17464629"),
      "https://api.company-information.service.gov.uk/company/17464629/officers?items_per_page=35"
    );
  });
});

describe("what a register lead admits about itself", () => {
  it("says the address is the registered office, not the trading one", () => {
    const { companyToLead } = ch;
    const lead = companyToLead(
      {
        company_name: "TOP LINE ROOFING LTD",
        company_number: "17464629",
        date_of_creation: "2026-09-17",
        sic_codes: ["43910"],
        registered_office_address: {
          address_line_1: "3 Hawkhill Drive",
          locality: "Leeds",
          postal_code: "LS15 7PZ",
        },
      },
      "roofers"
    );
    // A young company's registered office is frequently its accountant's or a
    // formation agent's. Saying so is the difference between a user writing to a
    // real door and standing outside an accountancy firm that has never heard of
    // them.
    assert.match(lead.notes, /registered office/);
    assert.match(lead.notes, /Company no\. 17464629/);
    assert.equal(lead.business_name, "Top Line Roofing Ltd");
    assert.equal(lead.source, "companies_house");
    // The register publishes no website, and this source must not pretend it has
    // one — the route fills this in from its own lookup and drops the lead if a
    // site turns up.
    assert.equal(lead.website, "");
    assert.equal(lead.phone, "");
    assert.equal(lead.email, "");
  });
});
