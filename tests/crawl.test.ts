import { test } from "node:test";
import assert from "node:assert/strict";

const {
  parseRobots,
  robotsAllows,
  pacingWait,
  parseSitemap,
  contactPageUrls,
  rankContactUrls,
  crawlVerdict,
  crawlPage,
  MIN_INTERVAL_MS,
} = await import("../lib/crawl.ts");

/**
 * A stand-in network. The politeness rules only exist in how the crawler
 * actually behaves over the wire, so these tests replace fetch and count the
 * requests it makes — "does not fetch" is the thing worth asserting.
 */
function withFakeNetwork(handler: (url: string) => Response | Error) {
  const real = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const result = handler(url);
    if (result instanceof Error) throw result;
    return result;
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

const reply = (body: string, status = 200, type = "text/plain") =>
  new Response(status >= 300 && !body ? null : body, { status, headers: { "content-type": type } });


/**
 * The crawler's contract: it asks permission before reading anything, it spaces
 * its requests, and the order in which it picks pages is a policy, not an
 * accident. All three are pure functions, so they are tested directly.
 */

test("robots.txt: the group that names us wins over the wildcard group", () => {
  const rules = parseRobots(
    [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: Googlebot",
      "Disallow: /private",
      "",
      "User-agent: OutreachStudio",
      "Disallow: /wp-admin/",
      "Allow: /wp-admin/admin-ajax.php",
      "Crawl-delay: 5",
    ].join("\n")
  );
  // Our own group, not Googlebot's and not the blanket ban.
  assert.equal(robotsAllows(rules, "/contact"), true);
  assert.equal(robotsAllows(rules, "/wp-admin/options.php"), false);
  // Longest match wins, so the Allow inside the disallowed tree holds.
  assert.equal(robotsAllows(rules, "/wp-admin/admin-ajax.php"), true);
  assert.equal(rules.crawlDelayMs, 5_000);
});

test("robots.txt: silence means yes, and Crawl-delay can only slow us down", () => {
  const empty = parseRobots("");
  assert.equal(robotsAllows(empty, "/anything"), true);
  assert.equal(empty.crawlDelayMs, MIN_INTERVAL_MS);

  // A host asking for 0.1s still gets our polite minimum.
  const fast = parseRobots("User-agent: *\nCrawl-delay: 0.1");
  assert.equal(fast.crawlDelayMs, MIN_INTERVAL_MS);

  // A blanket ban is a blanket ban.
  const banned = parseRobots("User-agent: *\nDisallow: /");
  assert.equal(robotsAllows(banned, "/"), false);
  assert.equal(robotsAllows(banned, "/contact"), false);
});

test("robots.txt: comments, wildcards and the $ anchor behave", () => {
  const rules = parseRobots(
    ["User-agent: *", "Disallow: /*.pdf$   # no PDFs", "Disallow: /search", "Allow: /search-only"].join(
      "\n"
    )
  );
  assert.equal(robotsAllows(rules, "/brochure.pdf"), false);
  assert.equal(robotsAllows(rules, "/brochure.pdfx"), true); // $ anchors the end
  assert.equal(robotsAllows(rules, "/search"), false);
  assert.equal(robotsAllows(rules, "/search?q=x"), false); // prefix match
  assert.equal(robotsAllows(rules, "/search-only"), true); // longer Allow
});

test("pacing: never faster than one request per second to a host", () => {
  assert.equal(pacingWait(0, 10_000), 0); // first request, no wait
  assert.equal(pacingWait(10_000, 10_000), 1_000); // immediately after
  assert.equal(pacingWait(10_000, 10_400), 600);
  assert.equal(pacingWait(10_000, 12_000), 0); // long enough already
  assert.equal(pacingWait(10_000, 10_000, 5_000), 5_000); // host asked for more
});

test("sitemaps: urlset, index, CDATA and escaped ampersands", () => {
  const urlset = `<?xml version="1.0"?><urlset><url><loc>https://acme.com/</loc></url>
    <url><loc><![CDATA[https://acme.com/contact]]></loc></url>
    <url><loc>https://acme.com/about?a=1&amp;b=2</loc></url></urlset>`;
  assert.deepEqual(parseSitemap(urlset), {
    urls: ["https://acme.com/", "https://acme.com/contact", "https://acme.com/about?a=1&b=2"],
    sitemaps: [],
  });

  const index = `<sitemapindex><sitemap><loc>https://acme.com/sitemap-1.xml</loc></sitemap></sitemapindex>`;
  assert.deepEqual(parseSitemap(index), {
    urls: [],
    sitemaps: ["https://acme.com/sitemap-1.xml"],
  });
  assert.deepEqual(parseSitemap("not xml at all"), { urls: [], sitemaps: [] });
});

test("page picking: contact beats about beats team, and stays on the site", () => {
  const html = `
    <a href="/blog/how-to-choose-a-roofer">Read our guide</a>
    <a href="/about-us">About</a>
    <a href="/contact-us">Contact us</a>
    <a href="/our-team">Meet the team</a>
    <a href="https://facebook.com/acme">Facebook</a>
    <a href="/brochure.pdf">Brochure</a>
    <a href="mailto:hi@acme.com">Email</a>
    <a href="/deep/blog/contact">Old contact post</a>`;
  const picked = contactPageUrls(html, "https://acme.com/", 3);
  assert.equal(picked[0], "https://acme.com/contact-us");
  assert.equal(picked[1], "https://acme.com/about-us");
  assert.equal(picked[2], "https://acme.com/our-team");
  // Off-site links, non-markup files and mailto are not crawl targets.
  assert.equal(picked.some((u) => u.includes("facebook.com") || u.endsWith(".pdf")), false);
  // A shallow page beats the same word buried in a blog path.
  const withDeep = contactPageUrls(
    `<a href="/deep/blog/contact">a</a><a href="/contact">b</a>`,
    "https://acme.com/",
    2
  );
  assert.equal(withDeep[0], "https://acme.com/contact");
});

test("page picking: nothing to pick is not an error", () => {
  assert.deepEqual(contactPageUrls("", "https://acme.com/"), []);
  assert.deepEqual(contactPageUrls(`<a href="/blog/x">x</a>`, "https://acme.com/"), []);
});

/**
 * The rules above only matter if the crawler obeys them over the wire. These
 * tests replace fetch and count requests: a path robots.txt disallows must cost
 * the host *nothing*, and a host whose rules cannot be read must not be walked
 * at all.
 */

test("robots.txt that cannot be read: the host is skipped, not crashed on", async () => {
  // The prospects this product hunts are the ones with broken sites, so an
  // expired certificate or dead DNS must end as "skip this host".
  const net = withFakeNetwork(() => new Error("certificate has expired"));
  try {
    const verdict = await crawlVerdict("https://tls-broken.test/contact");
    assert.equal(verdict.allowed, false);
    assert.match(verdict.reason ?? "", /unavailable — host skipped/);

    const page = await crawlPage("https://tls-broken.test/");
    assert.equal(page, null);
    // One attempt at robots.txt; never a request for the page itself.
    assert.deepEqual(net.calls, ["https://tls-broken.test/robots.txt"]);
  } finally {
    net.restore();
  }
});

test("robots.txt answering 5xx: the host is left alone", async () => {
  const net = withFakeNetwork(() => reply("", 503));
  try {
    const verdict = await crawlVerdict("https://busy.test/");
    assert.equal(verdict.allowed, false);
    assert.equal(await crawlPage("https://busy.test/"), null);
    assert.equal(net.calls.length, 1);
  } finally {
    net.restore();
  }
});

test("robots.txt answering 404: that is permission, and the page is read", async () => {
  const net = withFakeNetwork((url) =>
    url.endsWith("/robots.txt") ? reply("", 404) : reply("<html>hi</html>", 200, "text/html")
  );
  try {
    assert.deepEqual(await crawlVerdict("https://norules.test/"), { allowed: true });
    const page = await crawlPage("https://norules.test/");
    assert.equal(page?.status, 200);
    assert.equal(page?.html, "<html>hi</html>");
  } finally {
    net.restore();
  }
});

test("a disallowed path is never requested, and the reason names it", async () => {
  const net = withFakeNetwork((url) =>
    url.endsWith("/robots.txt")
      ? reply("User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n")
      : reply("<html>secret</html>", 200, "text/html")
  );
  try {
    const denied = await crawlVerdict("https://wp.test/wp-admin/options.php");
    assert.equal(denied.allowed, false);
    assert.match(denied.reason ?? "", /disallowed by robots\.txt \(\/wp-admin\/options\.php\)/);

    assert.equal(await crawlPage("https://wp.test/wp-admin/options.php"), null);
    // The carve-out a site deliberately allows still works.
    assert.equal((await crawlVerdict("https://wp.test/wp-admin/admin-ajax.php")).allowed, true);

    const page = await crawlPage("https://wp.test/contact");
    assert.equal(page?.status, 200);
    // Exactly one request for the page: the file itself was honoured.
    assert.deepEqual(
      net.calls.filter((u) => u.includes("options.php")),
      []
    );
  } finally {
    net.restore();
  }
});

test("a fetched page carries the crawler's own name and is capped in size", async () => {
  const huge = `<html>${"x".repeat(500_000)}</html>`;
  let seenUa = "";
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/robots.txt")) return reply("", 404);
    seenUa = String((init?.headers as Record<string, string>)?.["User-Agent"] ?? "");
    return reply(huge, 200, "text/html");
  }) as typeof fetch;
  try {
    const page = await crawlPage("https://big.test/");
    assert.match(seenUa, /OutreachStudio/);
    assert.equal(page?.html.length, 400_000, "a giant page is truncated, not swallowed");
    assert.ok((page?.bytes ?? 0) > 400_000, "the real size is still reported");
  } finally {
    globalThis.fetch = real;
  }
});

test("page picking: a sitemap's page list is ranked by the same policy", () => {
  const picked = rankContactUrls(
    [
      "https://acme.com/",
      "https://acme.com/contact-us",
      "https://acme.com/about-us",
      "https://acme.com/our-team",
      "https://acme.com/deep/blog/contact",
      "https://acme.com/wp-content/uploads/hero.jpg",
      "https://facebook.com/acme",
      "https://acme.com/services/plumbing",
    ],
    "https://acme.com/",
    3
  );
  assert.deepEqual(picked, [
    "https://acme.com/contact-us",
    "https://acme.com/about-us",
    "https://acme.com/our-team",
  ]);
});

test("page picking: a sitemap of nothing useful picks nothing", () => {
  assert.deepEqual(rankContactUrls([], "https://acme.com/"), []);
  assert.deepEqual(
    rankContactUrls(["https://acme.com/blog/post-1", "https://acme.com/"], "https://acme.com/"),
    []
  );
});
