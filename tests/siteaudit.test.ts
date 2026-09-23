import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import type { SiteProbe } from "../lib/siteaudit.ts";

const { analyzeSite, isRedesignProspect, checkBrokenLinks } = await import("../lib/siteaudit.ts");
const { extractPhone, pickPhone, restoreTrunkPrefix, detectTech, isPlausiblePhone } =
  await import("../lib/scrape.ts");
const { extractEmails } = await import("../lib/scrape.ts");

/**
 * The audit engine's contract: every finding is a measured fact, and a healthy
 * site is never sold to its owner as broken.
 */

const MODERN = `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acme Dental — Austin, TX</title>
<meta name="description" content="Family dental care in Austin, Texas. Book an appointment online in under a minute.">
</head><body>
<h1>Dentistry in Austin</h1>
<form action="/book"><input name="name"></form>
<p>${"Real content about the practice, its team and its opening hours. ".repeat(20)}</p>
<a href="mailto:hello@acme.com">Email us</a>
<a href="/contact">Contact</a>
<footer>© ${new Date().getFullYear()} Acme Dental</footer>
</body></html>`;

function probe(over: Partial<SiteProbe> = {}): SiteProbe {
  return {
    reachable: true,
    status: 200,
    finalUrl: "https://acme.com",
    ms: 400,
    bytes: 4_800,
    html: MODERN,
    tlsInvalid: false,
    ...over,
  };
}

const HEALTHY = { pixels: ["Google Analytics"] };

test("anchor counts are complete even when the link budget runs out", async () => {
  // Live case: the dead product menu sat late in the page, after the budget
  // was spent on other links — so the count said 1 when a visitor saw 13.
  const html =
    `<a href="/products/#a">Product A</a>` +
    Array.from({ length: 13 }, (_, i) => `<a href="/other-${i}">O${i}</a>`).join("") +
    ["b", "c", "d"].map((x) => `<a href="/products/#${x}">Product ${x}</a>`).join("");
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string) => ({
    status: new URL(String(u)).pathname === "/products/" ? 404 : 200,
  })) as unknown as typeof fetch;
  try {
    const report = await checkBrokenLinks("https://acme.com", html);
    assert.equal(report.links.length, 1);
    assert.equal(report.links[0].anchors, 4);
    assert.equal(report.truncated, true);
  } finally {
    globalThis.fetch = real;
  }
});

test("a heavy homepage is measured by weight, and only an extreme one is a flag", () => {
  // Live measurement: four of eight homepages in one Tucson market shipped
  // 440–690 KB of HTML. That's common, so it's recorded — not used to call a
  // modern site broken.
  const common = analyzeSite(probe({ bytes: 466_000, htmlTruncated: true }), HEALTHY);
  const recorded = common.checks.find((c) => c.id === "heavy");
  assert.equal(recorded?.severity, "medium");
  assert.match(recorded?.label ?? "", /about 466 KB/);
  assert.equal(common.needsWork, false);

  // Over a megabyte of markup is the extreme worth a flag.
  const extreme = analyzeSite(probe({ bytes: 1_400_000 }), HEALTHY);
  const check = extreme.checks.find((c) => c.id === "heavy");
  assert.equal(check?.severity, "high");
  assert.match(check?.label ?? "", /over 1\.4 MB of HTML before any images/);
  assert.equal(extreme.needsWork, true);

  assert.ok(!analyzeSite(probe({ bytes: 80_000 }), HEALTHY).checks.some((c) => c.id === "heavy"));
});

test("a page too large to read fully never yields absence findings we didn't check", () => {
  // If the footer is beyond the sample, "no contact link on the homepage" and
  // "barely any content" would be accusations about text we never saw.
  const tail = { htmlTruncated: true, bytes: 900_000 };
  const noContact = MODERN.replace(/<a href="mailto:[^"]*">Email us<\/a>/, "")
    .replace(/<a href="\/contact">Contact<\/a>/, "")
    .replace(/<form action="\/book">[\s\S]*?<\/form>/, "");
  const audit = analyzeSite(
    probe({ html: noContact, ...tail }),
    HEALTHY
  );
  assert.ok(!audit.checks.some((c) => c.id === "no_contact_on_homepage"));
  const thin = analyzeSite(probe({ html: "<html><body><h1>Hi</h1></body></html>", ...tail }), HEALTHY);
  assert.ok(!thin.checks.some((c) => c.id === "thin_content"));
  // A complete page still gets both checks — this only silences the partial read.
  const full = analyzeSite(probe({ html: noContact, bytes: 4_800 }), HEALTHY);
  assert.ok(full.checks.some((c) => c.id === "no_contact_on_homepage"));
});

test("a healthy modern site is clean and never called broken", () => {
  const audit = analyzeSite(probe(), HEALTHY);
  assert.deepEqual(audit.checks, []);
  assert.equal(audit.score, 100);
  assert.equal(audit.grade, "good");
  assert.deepEqual(audit.flags, []);
  assert.equal(isRedesignProspect(audit), false);
  assert.match(audit.summary, /No concrete website problems/);
});

test("missing viewport is a pitch-worthy finding", () => {
  const html = MODERN.replace(/<meta name="viewport"[^>]*>/, "");
  const audit = analyzeSite(probe({ html }), HEALTHY);
  assert.ok(audit.flags.some((f) => f.includes("mobile-friendly")));
  assert.equal(audit.grade, "fair");
  assert.equal(isRedesignProspect(audit), true);
});

test("http-only sites are flagged for having no HTTPS", () => {
  const audit = analyzeSite(probe({ finalUrl: "http://acme.com" }), HEALTHY);
  assert.ok(audit.flags.some((f) => f.includes("no HTTPS")));
});

test("a free builder or social page is a real defect", () => {
  const wix = analyzeSite(probe({ finalUrl: "https://myshop.wixsite.com/home" }), HEALTHY);
  assert.ok(wix.flags.some((f) => f.includes("free builder")));
  const fb = analyzeSite(probe({ finalUrl: "https://www.facebook.com/myshop" }), HEALTHY);
  assert.ok(fb.flags.some((f) => f.includes("free builder")));
});

test("an HTTP error is critical, quotable evidence", () => {
  const audit = analyzeSite(probe({ status: 500 }), HEALTHY);
  assert.ok(audit.flags.some((f) => f.includes("HTTP 500")));
  assert.equal(audit.grade, "poor");
  assert.equal(isRedesignProspect(audit), true);
});

test("a dead site is flagged, but a timeout is not judged", () => {
  const dead = analyzeSite(
    probe({ reachable: false, status: 0, html: "", error: "ENOTFOUND getaddrinfo" }),
    HEALTHY
  );
  assert.ok(dead.flags.some((f) => f.includes("doesn't load")));
  assert.equal(dead.grade, "poor");
  assert.equal(isRedesignProspect(dead), true);

  // A timeout may be our own network. It must never become a pitch line.
  const timedOut = analyzeSite(
    probe({ reachable: false, status: 0, html: "", error: "The operation was aborted due to timeout" }),
    HEALTHY
  );
  assert.equal(timedOut.grade, "unknown");
  assert.equal(timedOut.facts.needsManualCheck, true);
  assert.equal(isRedesignProspect(timedOut), false);
  assert.ok(!timedOut.flags.some((f) => f.includes("doesn't load")));
  assert.match(timedOut.summary, /before pitching/);
});

test("a bot wall or rate limit is never called a broken site", () => {
  for (const status of [403, 429, 451]) {
    const audit = analyzeSite(probe({ status, html: "" }), HEALTHY);
    assert.equal(audit.grade, "unknown", `HTTP ${status} must not be judged`);
    assert.equal(audit.needsWork, false);
    assert.equal(audit.facts.needsManualCheck, true);
    assert.ok(!audit.flags.some((f) => f.includes(String(status))));
    assert.ok(audit.checks.some((c) => c.id === "blocked"));
  }
  // A genuine server error is still the site's problem.
  const down = analyzeSite(probe({ status: 503 }), HEALTHY);
  assert.ok(down.flags.some((f) => f.includes("HTTP 503")));
  assert.equal(down.needsWork, true);
});

test("an invalid certificate is critical and never mistaken for a timeout", () => {
  const audit = analyzeSite(
    probe({ reachable: false, status: 0, html: "", tlsInvalid: true, error: "ERR_TLS_CERT_ALTNAME" }),
    HEALTHY
  );
  assert.ok(audit.flags.some((f) => f.includes("certificate")));
  assert.equal(audit.grade, "poor");
  assert.equal(isRedesignProspect(audit), true);
});

test("a certificate belonging to another website is named, not just called invalid", () => {
  // Verified live on a Tucson HVAC company: https served a valid, unexpired
  // certificate for mindseyesports.com, so every visitor got a warning. The
  // domain is the part the owner can check — "invalid" is not.
  const audit = analyzeSite(
    probe({
      reachable: false,
      status: 0,
      html: "",
      tlsInvalid: true,
      tlsProblem: "mismatch",
      tlsCertNames: ["mindseyesports.com", "www.mindseyesports.com"],
      plainStatus: 200,
      plainUrl: "http://www.tucsonairconditioningaz.com/",
    }),
    HEALTHY
  );
  assert.ok(audit.flags.some((f) => f.includes("mindseyesports.com")));
  assert.equal(audit.checks[0].severity, "critical");
  assert.equal(audit.grade, "poor");
  // The working address is part of the finding: it's what the owner will say.
  assert.match(audit.checks[0].detail, /only loads over plain http/);
  assert.equal(audit.facts.plainUrl, "http://www.tucsonairconditioningaz.com/");
});

test("a certificate that only misses the bare address is not called broken", () => {
  // The site works at www; only the address we were handed warns. Saying
  // "your certificate is invalid" here would be a false accusation.
  const confirmed = analyzeSite(
    probe({
      reachable: false,
      status: 0,
      html: "",
      tlsInvalid: true,
      tlsProblem: "mismatch",
      tlsCertNames: ["www.acme.com"],
      httpsAlt: true,
    }),
    HEALTHY
  );
  const check = confirmed.checks.find((c) => c.id === "tls_invalid");
  assert.equal(check?.severity, "high");
  assert.match(check?.label ?? "", /only covers www\.acme\.com/);
  assert.match(check?.detail ?? "", /https:\/\/www\.acme\.com works fine/);

  // Couldn't confirm the www address: same softer severity, honest wording.
  const unconfirmed = analyzeSite(
    probe({
      reachable: false,
      status: 0,
      html: "",
      tlsInvalid: true,
      tlsProblem: "mismatch",
      tlsCertNames: ["www.acme.com"],
    }),
    HEALTHY
  );
  const softer = unconfirmed.checks.find((c) => c.id === "tls_invalid");
  assert.equal(softer?.severity, "high");
  assert.match(softer?.label ?? "", /doesn't cover acme\.com/);
});

test("an expired or untrusted certificate says which it is", () => {
  const expired = analyzeSite(
    probe({ reachable: false, status: 0, html: "", tlsInvalid: true, tlsProblem: "expired" }),
    HEALTHY
  );
  assert.match(expired.checks[0].label, /has expired/);
  const selfSigned = analyzeSite(
    probe({ reachable: false, status: 0, html: "", tlsInvalid: true, tlsProblem: "untrusted" }),
    HEALTHY
  );
  assert.match(selfSigned.checks[0].label, /isn't trusted/);
  assert.equal(expired.checks[0].severity, "critical");
});

test("response time comes from the server, not from the page's weight", () => {
  // Live case: a 466 KB homepage was reported as "very slow — it took 4.6s to
  // respond" when the server answered in 2.1s. Speed is a claim the owner will
  // re-measure, so it must be the server's own response time.
  const server = analyzeSite(probe({ ttfb: 2_380, ttfbSamples: 2, ms: 9_000, bytes: 466_000 }), HEALTHY);
  const slow = server.checks.find((c) => c.id === "slow");
  assert.equal(slow?.severity, "high");
  // Bound in whole seconds: "over 2s" stays true on a lucky re-check.
  assert.match(slow?.label ?? "", /takes over 2s just to respond/);
  assert.match(slow?.detail ?? "", /2\.4s to start responding \(best of 2 checks\)/);

  // Fast server, heavy download — that is not a slow server, and we won't say so.
  const heavyButFast = analyzeSite(probe({ ttfb: 320, ttfbSamples: 1, ms: 9_500 }), HEALTHY);
  assert.ok(!heavyButFast.checks.some((c) => c.id === "slow"));

  // A soft band exists, but it can never flag a lead on its own.
  const soft = analyzeSite(probe({ ttfb: 1_240, ttfbSamples: 2 }), HEALTHY);
  const medium = soft.checks.find((c) => c.id === "slow");
  assert.equal(medium?.severity, "medium");
  assert.equal(soft.needsWork, false);
  assert.ok(!analyzeSite(probe({ ttfb: 700 }), HEALTHY).checks.some((c) => c.id === "slow"));
});

test("broken links are counted the way a visitor sees them", () => {
  const audit = analyzeSite(probe(), {
    ...HEALTHY,
    brokenLinks: [{ url: "https://acme.com/products/#products-77", status: 404, anchors: 9 }],
  });
  // Live case: a product menu where all nine entries led to one 404 page. It
  // was reported as "1 broken link" — true of the URL, false of the menu.
  assert.ok(audit.flags.some((f) => f.includes("9 broken links on the homepage")));
  assert.match(audit.checks.find((c) => c.id === "broken_links")?.detail ?? "", /acme\.com\/products, which doesn't exist/);
  assert.equal(audit.facts.brokenLinks.length, 1);
});

test("a sampled link check says at least, never an exact count", () => {
  const audit = analyzeSite(probe(), {
    ...HEALTHY,
    brokenLinks: [{ url: "https://acme.com/old-page", status: 404, anchors: 1 }],
    brokenLinksTruncated: true,
  });
  assert.ok(audit.flags.some((f) => f.includes("at least 1 broken link")));
  assert.equal(audit.facts.brokenLinksTruncated, true);
});

test("vendor-injected links are not reported as broken", async () => {
  // Cloudflare rewrites mailto: links into /cdn-cgi/l/email-protection
  // anchors. The URL 404s on a direct request but works fine in a browser.
  const html = `<body><a href="/cdn-cgi/l/email-protection#761f181019">Email us</a></body>`;
  assert.deepEqual((await checkBrokenLinks("https://acme.com", html)).links, []);
});

test("head metadata links are not reported as broken homepage links", async () => {
  // WordPress emits these in <head>; on some hosts they 404. No visitor can
  // click them, so calling them "broken links on the homepage" would get the
  // user contradicted. No candidates means no network calls — deterministic.
  const html = `<head>
    <link rel="alternate" type="application/rss+xml" href="/feed">
    <link rel="https://api.w.org/" href="/wp-json">
    <link rel="canonical" href="/home">
  </head><body><a href="#top">Top</a></body>`;
  assert.deepEqual((await checkBrokenLinks("https://acme.com", html)).links, []);
});

test("a menu pointing at one dead page is counted as the links a visitor sees", async () => {
  // Three menu entries, one shared target: one request, three broken links.
  const html = `<nav>${[77, 81, 86]
    .map((n) => `<a href="/products/#products-${n}">Product ${n}</a>`)
    .join("")}</nav><a href="/about">About</a>`;
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string) => ({
    status: new URL(String(u)).pathname === "/products/" ? 404 : 200,
  })) as unknown as typeof fetch;
  try {
    const report = await checkBrokenLinks("https://acme.com", html);
    assert.equal(report.links.length, 1);
    assert.equal(report.links[0].anchors, 3);
    assert.equal(report.truncated, false);
  } finally {
    globalThis.fetch = real;
  }
});

test("a link check that stops early reports itself as truncated", async () => {
  // More links than the budget allows: the count must become a floor.
  const html = Array.from({ length: 20 }, (_, i) => `<a href="/page-${i}">P${i}</a>`).join("");
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string) => ({
    status: new URL(String(u)).pathname === "/page-1" ? 404 : 200,
  })) as unknown as typeof fetch;
  try {
    const report = await checkBrokenLinks("https://acme.com", html);
    assert.equal(report.links.length, 1);
    assert.equal(report.truncated, true);
  } finally {
    globalThis.fetch = real;
  }
});

test("2000s-era markup is still a defect", () => {
  const html = MODERN.replace("<body>", "<body><marquee>WELCOME</marquee>");
  assert.ok(analyzeSite(probe({ html }), HEALTHY).flags.some((f) => f.includes("2000s-era")));
});

test("a JS app shell is not mistaken for an empty homepage", () => {
  const shell = `<html><head><title>Acme</title><meta name="viewport" content="width=device-width"></head>
<body><div id="root"></div><script src="/static/app.js"></script></body></html>`;
  const spa = analyzeSite(probe({ html: shell, bytes: 200 }), HEALTHY);
  assert.ok(!spa.checks.some((c) => c.id === "thin_content"));
  const wix = analyzeSite(probe({ html: shell, bytes: 200 }), { ...HEALTHY, stack: "Wix" });
  assert.ok(!wix.checks.some((c) => c.id === "thin_content"));
});

test("a stale copyright is a finding but never a pitch flag", () => {
  const html = MODERN.replace(String(new Date().getFullYear()), "2016");
  const audit = analyzeSite(probe({ html }), HEALTHY);
  assert.ok(audit.checks.some((c) => c.id === "stale_copyright"));
  assert.ok(audit.checks.some((c) => c.label.includes("2016")));
  // Precision guarantee: a five-year-old footer must not make a site look broken.
  assert.equal(audit.flags.some((f) => f.includes("2016")), false);
  assert.equal(isRedesignProspect(audit), false);
});

test("soft SEO gaps alone never make a site a redesign prospect", () => {
  const html = MODERN
    .replace(/<meta name="description"[^>]*>/, "")
    .replace("<h1>Dentistry in Austin</h1>", "");
  const audit = analyzeSite(probe({ html }), { pixels: [] });
  assert.ok(audit.checks.some((c) => c.id === "no_meta_description"));
  assert.ok(audit.checks.some((c) => c.id === "no_h1"));
  assert.ok(audit.checks.some((c) => c.id === "no_analytics"));
  assert.equal(audit.grade, "good");
  assert.equal(isRedesignProspect(audit), false);
  assert.equal(isRedesignProspect(undefined), false);
});

test("empty html yields only url-based findings", () => {
  const audit = analyzeSite(probe({ html: "", bytes: 0, finalUrl: "http://acme.com" }), HEALTHY);
  assert.deepEqual(audit.checks.map((c) => c.id), ["no_https"]);
  assert.equal(audit.flags.length, 1);
});

test("extractPhone prefers international formats and rejects long IDs", () => {
  const text = "id 680305583769994 call +92 336 4486193 or 042-35714286 today";
  assert.equal(extractPhone(text), "+92 336 4486193");
  assert.equal(extractPhone("no numbers here"), "");
  assert.equal(extractPhone("year 2016 2020 2024"), "");
});

test("an error page is not the site: a 5xx gets one finding, not the page's", () => {
  // Live case: a Manchester roofer answering 500 was told it had no contact
  // link, no mobile viewport and barely any content — all of which described
  // the host's error page, and all of which the owner would refute in seconds.
  const broken = analyzeSite(
    probe({ status: 500, html: "<!doctype html><html><body><h1>500 Internal Server Error</h1></body></html>" })
  );
  assert.equal(broken.checks.length, 1);
  assert.equal(broken.checks[0].id, "http_error");
  assert.equal(broken.checks[0].label, "the homepage returns an HTTP 500 error");
  assert.equal(
    broken.checks.some((c) => c.id === "no_viewport" || c.id === "no_contact" || c.id === "thin"),
    false
  );
  // For the outdated filter this is still a prospect: the site is down.
  assert.equal(isRedesignProspect(broken), true);
  // And the same page served fine still gets the normal content findings.
  const served = analyzeSite(
    probe({ status: 200, html: "<!doctype html><html><body><h1>500 Internal Server Error</h1></body></html>" })
  );
  assert.equal(served.checks.some((c) => c.id === "no_viewport"), true);
});

test("a 5xx that clears on a re-check is not called a broken homepage", () => {
  // Live case: impwood.co.uk answered 500 six times in a row, then 200 nine
  // times in a row minutes later. One sample is a moment, not a fact.
  const once = analyzeSite(
    probe({ status: 500, statusRetry: 200, html: "<html><body>500</body></html>" })
  );
  assert.equal(once.checks[0].id, "http_error_intermittent");
  assert.match(once.checks[0].label, /was returning an HTTP 500 error when we checked/);
  // Confirmed twice: the accusation stands, at full weight.
  const twice = analyzeSite(probe({ status: 500, statusRetry: 500, html: "<html><body>500</body></html>" }));
  assert.equal(twice.checks[0].id, "http_error");
  assert.equal(twice.checks[0].severity, "critical");
  // A retry that never answered is not evidence the site recovered.
  const silent = analyzeSite(probe({ status: 500, statusRetry: 0, html: "<html><body>500</body></html>" }));
  assert.equal(silent.checks[0].id, "http_error");
});

test("a site that works at its www address isn't reported as having no HTTPS", () => {
  // Live case: lrl.ltd's bare host serves a CloudNS default certificate
  // (*.cloudns.net) and answers a security warning, while https://www.lrl.ltd
  // has a valid certificate of its own. "No HTTPS" there is false; what's true
  // and sellable is that the address people type is broken.
  const audit = analyzeSite(
    probe({
      reachable: false,
      status: 0,
      finalUrl: "https://lrl.ltd/",
      tlsInvalid: true,
      tlsProblem: "mismatch",
      tlsCertNames: ["*.cloudns.net", "cloudns.net"],
      httpsAlt: true,
      plainStatus: 301,
      html: "",
      bytes: 0,
    })
  );
  const tls = audit.checks[0];
  assert.equal(tls.id, "tls_invalid");
  assert.equal(tls.severity, "high");
  assert.match(tls.label, /https:\/\/www\.lrl\.ltd works/);
  assert.match(tls.detail, /can't be opened safely/);
  assert.equal(tls.detail.includes("only loads over plain http"), false);
  assert.equal(audit.facts.httpsAlt, true);
});

test("extractPhone recovers a number glued to a nearby year", () => {
  // The pattern tolerates spaces and dots, so this used to match as one
  // 14-digit run and fail the digit count — a real number silently lost.
  assert.equal(extractPhone("serving Austin since 1997. 512.454.4211"), "512.454.4211");
  assert.equal(extractPhone("Est. 1985. Call 512.451.7577 today"), "512.451.7577");
  // The opening bracket belongs to the number, not to the discarded prefix.
  assert.equal(extractPhone("Sushi Nini (512) 671-6464"), "(512) 671-6464");
  // A copyright span is not a number to dial.
  assert.equal(extractPhone("© 2000-2025 Tarrytown Dental"), "");
});

test("pickPhone scans a Phone field instead of trusting its first entry", () => {
  // The exact shape web search returns for a real Manchester roofer: the first
  // entry is a timestamp fragment, the dialable number is further along.
  assert.equal(pickPhone("021-10-05, 0161-230-7651"), "0161-230-7651");
  assert.equal(
    pickPhone("2007-2025, 2021-08-13, 07792-703-612"),
    "07792-703-612"
  );
  // A field with nothing dialable stays empty rather than passing junk on.
  assert.equal(pickPhone("2007-2025, 2021-08-13"), "");
  assert.equal(pickPhone(""), "");
  // Semicolons and slashes separate entries in the wild too.
  assert.equal(pickPhone("n/a; 0161 509 4250"), "0161 509 4250");
});

test("a UK number published without its trunk zero gets it back", () => {
  // Both of these were handed to the user by a live Manchester search.
  assert.equal(restoreTrunkPrefix("7467224271"), "07467224271");
  assert.equal(restoreTrunkPrefix("161 7966995"), "0161 7966995");
  assert.equal(pickPhone("7467224271", { uk: true }), "07467224271");
  assert.equal(pickPhone("161 7966995", { uk: true }), "0161 7966995");
  // Anything already dialable is left exactly as it arrived.
  assert.equal(restoreTrunkPrefix("0161 509 4250"), "0161 509 4250");
  assert.equal(restoreTrunkPrefix("+44 161 225 9696"), "+44 161 225 9696");
  assert.equal(restoreTrunkPrefix("07929 377 043"), "07929 377 043");
  // A US number has no trunk prefix to restore, so nothing is invented for it.
  assert.equal(restoreTrunkPrefix("512.454.4211"), "512.454.4211");
  assert.equal(pickPhone("512.454.4211", { uk: true }), "512.454.4211");
  // Only ever applied to a UK search.
  assert.equal(pickPhone("7467224271"), "7467224271");
  // A date with a clock time is not a phone number in either market.
  assert.equal(pickPhone("2021-08-13 10:30"), "");
});

test("extractPhone repairs UK trunk prefixes when the market is the UK", () => {
  assert.equal(extractPhone("Call 161 7966995 today", { uk: true }), "0161 7966995");
  assert.equal(extractPhone("Call 161 7966995 today"), "161 7966995");
  assert.equal(extractPhone("ring +44 7467 224271", { uk: true }), "+44 7467 224271");
});

test("an email padded with a URL escape is cleaned up, not passed on", () => {
  // Live case: the page links mailto:%20info@roofingplusservices.co.uk while a
  // gmail catch-all sits next to it. The padded form matched as the local part.
  const html =
    '<a href="mailto:%20info@roofingplusservices.co.uk">Email</a><a href="mailto:roofingplusservices@gmail.com">Email</a>';
  const found = extractEmails(html, "roofingplusservices.co.uk");
  assert.equal(found[0], "info@roofingplusservices.co.uk");
  assert.equal(found.includes("%20info@roofingplusservices.co.uk"), false);
  // A leading escape is a stray space in a link, so the address underneath is
  // still a mailable address and is kept.
  assert.deepEqual(extractEmails("share?to=%20sales@acme.com&subject=hi"), ["sales@acme.com"]);
  // An escape inside the address means the text is a URL fragment, not a
  // contact someone wrote — unpadding the front would invent one.
  assert.deepEqual(extractEmails("mailto:a%20b@acme.com"), []);
  assert.deepEqual(extractEmails("mailto:hello@acme.com"), ["hello@acme.com"]);
});

test("isPlausiblePhone gates numbers that arrive as opaque fields", () => {
  assert.equal(isPlausiblePhone("512.454.4211"), true);
  assert.equal(isPlausiblePhone("+1 512 454 2744"), true);
  assert.equal(isPlausiblePhone("2000-2025"), false);
  // Nine digits in four dot-separated groups is a host, not a phone. A real
  // offline lead came back with its server's IP where its number should be.
  assert.equal(isPlausiblePhone("45.41.177.67"), false);
  assert.equal(isPlausiblePhone("192.168.0.1"), false);
  assert.equal(extractPhone("Server 45.41.177.67 — call 512.478.3283"), "512.478.3283");
  assert.equal(isPlausiblePhone("call us for a quote"), false);
  assert.equal(isPlausiblePhone("680305583769994"), false);
  assert.equal(isPlausiblePhone(""), false);
});

test("theme boilerplate is never sold as insecure content", () => {
  // WordPress ships the XFN profile link and Squarespace ships image_src.
  // Neither loads a subresource, so neither is mixed content — accusing a
  // working site of being insecure is the one failure this engine must avoid.
  const wp = MODERN.replace(
    "<title>",
    '<link rel="profile" href="http://gmpg.org/xfn/11"><title>'
  );
  const wpAudit = analyzeSite(probe({ html: wp }), HEALTHY);
  assert.ok(!wpAudit.checks.some((c) => c.id === "mixed_content"));
  assert.equal(isRedesignProspect(wpAudit), false);

  const sq = MODERN.replace(
    "<title>",
    '<link rel="image_src" href="http://static1.squarespace.com/static/x.png"><title>'
  );
  assert.ok(!analyzeSite(probe({ html: sq }), HEALTHY).checks.some((c) => c.id === "mixed_content"));

  // A stylesheet over http IS blocked by the browser — that one is real.
  const css = MODERN.replace(
    "<title>",
    '<link rel="stylesheet" href="http://acme.com/style.css"><title>'
  );
  assert.ok(analyzeSite(probe({ html: css }), HEALTHY).checks.some((c) => c.id === "mixed_content"));

  // As are scripts and images loaded over http.
  const js = MODERN.replace("<title>", '<script src="http://acme.com/w.js"></script><title>');
  assert.ok(analyzeSite(probe({ html: js }), HEALTHY).checks.some((c) => c.id === "mixed_content"));
  const img = MODERN.replace("<h1>", '<img src="http://acme.com/logo.png"><h1>');
  assert.ok(analyzeSite(probe({ html: img }), HEALTHY).checks.some((c) => c.id === "mixed_content"));
});

test("detectTech identifies platforms and marketing tags", () => {
  const wp = detectTech(
    '<link href="/wp-content/themes/x/style.css"><script src="https://connect.facebook.net/en_US/fbevents.js"></script>'
  );
  assert.equal(wp.stack, "WordPress");
  assert.deepEqual(wp.pixels, ["Facebook Pixel"]);

  const shop = detectTech(
    '<img src="https://cdn.shopify.com/s/x.png"><script src="https://www.googletagmanager.com/gtag/js"></script>'
  );
  assert.equal(shop.stack, "Shopify");
  assert.deepEqual(shop.pixels, ["Google Analytics"]);

  const custom = detectTech("<html><body>hand-rolled site</body></html>");
  assert.equal(custom.stack, undefined);
  assert.deepEqual(custom.pixels, []);

  assert.deepEqual(detectTech(""), { pixels: [] });
});

test("the number of checks advertised is the number of checks that run", () => {
  // /features tells visitors "N checks per website". That number was stale by two
  // the moment it was written, which is what a hand-maintained count does — so it
  // is read back from the engine here. Adding a check to lib/siteaudit.ts now
  // fails this test until the page says so too, which is the only version of that
  // claim worth making.
  const engine = fs.readFileSync(new URL("../lib/siteaudit.ts", import.meta.url), "utf8");
  const distinct = new Set(
    [...engine.matchAll(/add\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1])
  );
  assert.ok(distinct.size > 15, `only found ${distinct.size} checks — is the parse still right?`);

  const page = fs.readFileSync(new URL("../app/features/page.tsx", import.meta.url), "utf8");
  const match = page.match(/\["(\d+)", "checks per website"\]/);
  assert.ok(match, "the features page no longer states a checks-per-website number");
  assert.equal(
    Number(match[1]),
    distinct.size,
    `the features page claims ${match[1]} checks but the engine applies ${distinct.size}`
  );
});

test("the same figure is not contradicted elsewhere in the marketing copy", () => {
  // A stale number in one place is worse than either number being wrong: a reader
  // who spots two different counts stops believing the audit findings themselves.
  const files = ["app/page.tsx", "app/docs/page.tsx", "app/features/page.tsx"];
  for (const file of files) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const [re, label] of [
      [/(\d+)\s*checks\b/i, "a check count"],
      [/(\d+)\s*different\s+checks\b/i, "a check count"],
    ] as [RegExp, string][]) {
      const m = source.match(re);
      if (!m) continue;
      // Only the guarded 23 is allowed anywhere; the pattern above catches the
      // "23 checks" wording, and the features page's own tuple is asserted above.
      assert.equal(
        Number(m[1]),
        23,
        `${file} states ${m[1]} ${label}, which disagrees with the engine`
      );
    }
  }
});
