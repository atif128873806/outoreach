import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * The product is sold as lead intelligence. Sending still exists behind the
 * outreach flag, but no public page may promise it — a marketing page that
 * advertises an inbox pipeline sells a feature the user cannot see.
 *
 * This reads the pages as text (no JSX parsing needed), so it is cheap and
 * keeps holding as the copy changes.
 */

const PAGES = [
  "app/page.tsx",
  "app/features/page.tsx",
  "app/docs/page.tsx",
  "app/demo/page.tsx",
  "app/layout.tsx",
  "app/pricing/page.tsx",
  "app/components/PublicFooter.tsx",
];

/**
 * Words that only appear when a page is selling the sending pipeline. Chosen so
 * that navigation labels for the standalone free tools ("SPF, DKIM & DMARC
 * checker", "Spam checker") don't trip it — those are tools, not promises.
 */
const FORBIDDEN: [RegExp, string][] = [
  [/\bsmtp\b/i, "SMTP"],
  [/\bimap\b/i, "IMAP"],
  [/\bmailbox(es)?\b/i, "mailbox"],
  [/\binbox(es)?\b/i, "inbox"],
  [/\bcampaigns?\b/i, "campaign"],
  [/\bfollow-?ups?\b/i, "follow-up"],
  [/\bunsubscribe\b/i, "unsubscribe"],
  [/\bwarm-?up\b/i, "warm-up"],
  [/\bopen rate\b/i, "open rate"],
  [/\bclick rate\b/i, "click rate"],
  [/\bbounces?\b|\bbounced\b/i, "bounce"],
  [/\bemails?\s*\/\s*day\b/i, "emails/day"],
  [/\bsends?\b|\bsending\b|\bsent\b/i, "sends"],
];

for (const page of PAGES) {
  test(`${page} promises nothing about sending`, () => {
    // Comments are for us, not for visitors, so strip them first — otherwise
    // "the proxy sends them to the app" in a doc block reads as a promise.
    const source = fs
      .readFileSync(new URL(`../${page}`, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const found: string[] = [];
    for (const [re, label] of FORBIDDEN) {
      const match = source.match(re);
      if (!match) continue;
      const at = source.indexOf(match[0]);
      found.push(`${label}: …${source.slice(Math.max(0, at - 45), at + 45).replace(/\s+/g, " ")}…`);
    }
    assert.deepEqual(found, [], `${page} still advertises sending:\n${found.join("\n")}`);
  });
}

/**
 * "New businesses" is parked for now (see lib/product.ts, NEW_BUSINESSES_ENABLED):
 * the page and the register job still exist, but the app does not offer them — and
 * a landing page, a pricing bullet or a docs section still selling them would
 * promise a feature no visitor can open. This is the copy half of that hide, and
 * it fails the moment someone re-adds the words without the flag.
 */
const PARKED_FEATURE = /\bnew businesses\b|\bnewly incorporated\b|\bweekly list\b/i;

test("no public page advertises the parked New businesses feature", () => {
  const found: string[] = [];
  for (const page of PAGES) {
    const source = fs
      .readFileSync(new URL(`../${page}`, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const match = source.match(PARKED_FEATURE);
    if (!match) continue;
    const at = source.indexOf(match[0]);
    found.push(`${page}: …${source.slice(Math.max(0, at - 45), at + 45).replace(/\s+/g, " ")}…`);
  }
  assert.deepEqual(found, [], `these pages still sell the parked feature:\n${found.join("\n")}`);
});

test("the browser title describes lead intelligence, not outreach", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const title = layout.match(/default:\s*"([^"]+)"/)?.[1] ?? "";
  assert.ok(title.length > 0, "no default title found");
  // The brand name is allowed to say "Outreach Studio"; the promise next to it
  // is what must describe lead intelligence.
  const promise = title.replace(/outreach studio/gi, "");
  assert.ok(/business|lead|prospect/i.test(promise), `title doesn't describe finding businesses: ${title}`);
  assert.ok(
    !/outreach|campaign|email|inbox|smtp/i.test(promise),
    `default title still reads as a sending product: ${title}`
  );
});
