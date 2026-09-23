import { test } from "node:test";
import assert from "node:assert/strict";

const digest = await import("../lib/digest.ts");
const {
  DIGEST_MAX_DAYS,
  DIGEST_MEMORY_DAYS,
  digestWindow,
  newCompanies,
  memoryCutoff,
  digestLine,
  digestEmail,
  digestByAccount,
  watchWindow,
} = digest;

/** A fixed "now" so these assertions do not drift with the clock. */
const NOW = Date.UTC(2026, 8, 22, 9, 30, 0); // 2026-09-22T09:30Z

test("a first check looks back a week, not at everything recent", () => {
  // A watch created a minute ago has nothing to catch up on. Asking for the
  // register's default two years would introduce a brand-new watch to 800
  // companies and call them all new.
  const w = digestWindow(null, NOW);
  assert.equal(w.first, true);
  assert.equal(w.days, DIGEST_MAX_DAYS);
  assert.equal(w.since, "2026-09-15");
  assert.equal(w.truncated, false);
});

test("a normal week is asked for exactly once, and never twice", () => {
  // The stamp is the moment the last check covered, so a company incorporated
  // just before it is not asked for again.
  const w = digestWindow("2026-09-15T09:30:00.000Z", NOW);
  assert.equal(w.first, false);
  assert.equal(w.since, "2026-09-15");
  assert.equal(w.truncated, false);

  // A check that ran an hour ago still covers today: the register takes whole
  // days, and rounding in would exclude a company registered this morning.
  const soon = digestWindow("2026-09-22T08:30:00.000Z", NOW);
  assert.equal(soon.since, "2026-09-22");
  assert.ok(soon.days >= 1);
});

test("a long gap is capped, and says so", () => {
  // Somebody back after a month should see a week of companies and be told that
  // is what happened — not believe that a week is all there was.
  const w = digestWindow("2026-08-01T00:00:00.000Z", NOW);
  assert.equal(w.days, DIGEST_MAX_DAYS);
  assert.equal(w.truncated, true);
  assert.equal(w.since, "2026-09-15");
});

test("an unusable stamp is treated as now, never as the beginning of time", () => {
  // A restored backup or a moved clock can leave a stamp in the future; asking
  // the register for a window that starts tomorrow returns nothing, for ever.
  for (const bad of ["", "not-a-date", "2027-01-01T00:00:00.000Z"]) {
    const w = digestWindow(bad, NOW);
    assert.equal(w.days, DIGEST_MAX_DAYS);
    assert.ok(w.since <= "2026-09-22", `${bad} produced a future window: ${w.since}`);
  }
});

test("a company is never reported twice", () => {
  const found = [
    { company_number: "17465659", business_name: "33 Degrees Roofing" },
    { company_number: "17464629", business_name: "Topline Roofing" },
    { company_number: "17465659", business_name: "33 Degrees Roofing (again)" },
  ];
  const fresh = newCompanies(found, new Set(["17464629"]));
  assert.deepEqual(
    fresh.map((c) => c.company_number),
    ["17465659"],
    "already-reported companies and duplicates within one reply must both be dropped"
  );
});

test("a company with no number is dropped rather than repeated for ever", () => {
  // Deduplication is by number because that is the register's identity for a
  // company. Without one there is nothing to remember it by, so it would come
  // back as new on every check — which is how a digest becomes untrustworthy.
  const fresh = newCompanies(
    [{ company_number: "", business_name: "No Number Ltd" }, { business_name: "Missing Field Ltd" }, { company_number: "12345678" }],
    new Set()
  );
  assert.deepEqual(fresh.map((c) => c.company_number), ["12345678"]);
});

test("memory outlives the window it has to cover", () => {
  // If a company could fall out of memory while still inside the range being
  // asked about, it would be reported twice after a gap. The margin is the point.
  assert.ok(
    DIGEST_MEMORY_DAYS > DIGEST_MAX_DAYS,
    "remembering companies for less time than a check can look back is a duplicate"
  );
  const cutoff = memoryCutoff(NOW);
  assert.equal(cutoff, new Date(NOW - DIGEST_MEMORY_DAYS * 24 * 60 * 60 * 1000).toISOString());
});

test("the count reads like a sentence a person would say", () => {
  assert.equal(digestLine("roofers", "Leeds, UK", 3), "3 new roofers in Leeds, UK");
  // One of them is not a roofer*s*.
  assert.equal(digestLine("roofers", "Leeds, UK", 1), "1 new roofer in Leeds, UK");
  assert.equal(digestLine("plumbing", "", 2), "2 new plumbing");
});

test("the digest email names companies and links to the register", () => {
  const { subject, text } = digestEmail({
    name: "Atif",
    watches: [
      {
        niche: "roofers",
        location: "Leeds, UK",
        companies: [
          { business_name: "33 Degrees Roofing and Cladding Ltd", company_number: "17465659", incorporated_on: "2026-09-17" },
        ],
      },
    ],
    total: 1,
    url: "https://app.example.com/watches",
  });
  assert.match(subject, /^1 new roofer in Leeds, UK — your weekly digest$/);
  assert.match(text, /Atif, 1 business has registered since you last looked/);
  assert.match(text, /33 Degrees Roofing and Cladding Ltd \(registered 2026-09-17\)/);
  assert.match(text, /company\/17465659/);
  assert.match(text, /https:\/\/app\.example\.com\/watches/);
  // The one thing a user must not assume: these have not been audited.
  assert.match(text, /have not been checked for a website/);
  assert.doesNotMatch(text, /unsubscribe/i, "this is a product email to the account owner, not outreach");
});

test("a watch that has never been checked looks back a week, not at today", () => {
  // The column defaults to the creation time, so a naive read would ask the
  // register for companies registered from *now* onwards and report nothing for
  // a search's entire first week — the one week a new user is watching.
  const neverChecked = watchWindow(
    { checkedThrough: new Date(NOW).toISOString(), lastCheckedAt: null },
    NOW
  );
  assert.equal(neverChecked.first, true);
  assert.equal(neverChecked.since, "2026-09-15");
  assert.equal(neverChecked.days, DIGEST_MAX_DAYS);

  // Once a check has succeeded the column is the boundary again, so nothing is
  // asked for twice.
  const checkedTwoDaysAgo = watchWindow(
    { checkedThrough: "2026-09-20T09:30:00.000Z", lastCheckedAt: "2026-09-20T09:30:00.000Z" },
    NOW
  );
  assert.equal(checkedTwoDaysAgo.first, false);
  assert.equal(checkedTwoDaysAgo.since, "2026-09-20");
});

test("the weekly email is one per account, and only when something happened", () => {
  const company = (n: string) => ({
    business_name: n,
    company_number: n,
    incorporated_on: "2026-09-21",
  });
  const byAccount = digestByAccount([
    { userId: 7, niche: "roofers", location: "Leeds, UK", companies: [company("A")] },
    { userId: 7, niche: "cleaners", location: "Leeds, UK", companies: [company("B")] },
    // Nothing was registered here — this account is not written to at all.
    { userId: 8, niche: "plumbers", location: "York, UK", companies: [] },
    { userId: 9, niche: "tilers", location: "Hull, UK", companies: [company("C")] },
  ]);

  assert.deepEqual([...byAccount.keys()], [7, 9]);
  // Two searches, one message — the order the user set them up in.
  assert.deepEqual(
    byAccount.get(7)?.map((w) => w.niche),
    ["roofers", "cleaners"]
  );
  assert.equal(byAccount.get(8), undefined, "a quiet account gets no email");
  assert.equal(byAccount.get(9)?.[0].companies.length, 1);
});

test("several watches are summarised per search", () => {
  const { subject, text } = digestEmail({
    name: "",
    watches: [
      { niche: "roofers", location: "Leeds, UK", companies: [{ business_name: "A", company_number: "1", incorporated_on: "" }] },
      { niche: "cleaners", location: "Manchester, UK", companies: [{ business_name: "B", company_number: "2", incorporated_on: "" }] },
    ],
    total: 2,
    url: "https://x.test/watches",
  });
  assert.match(subject, /2 new businesses across 2 searches/);
  assert.match(text, /1 new roofer in Leeds, UK/);
  assert.match(text, /1 new cleaner in Manchester, UK/);
});
