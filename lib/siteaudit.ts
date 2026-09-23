import tls from "node:tls";

/**
 * Website audit — the intelligence layer of Lead Finder.
 *
 * Two halves, deliberately separated so both are testable:
 *  - `probeSite` / `checkBrokenLinks`: network facts (status, timing, size, TLS,
 *    which links 404). They never throw and never guess.
 *  - `analyzeSite`: a PURE function turning those facts into scored, quotable
 *    findings. No I/O, so the whole scoring model is unit-tested.
 *
 * Platform/marketing-tag detection stays in lib/leads.ts (it's enrichment, not
 * auditing) and arrives here as `options.stack` / `options.pixels`.
 *
 * Design rule: PRECISION OVER RECALL. A finding is only emitted when the
 * evidence is something the seller can stand behind in front of the business
 * owner — "your site returns a 500" is safe, "your site is bad" is not. When a
 * signal is ambiguous (403 bot-blocking, a timeout that may be our own network,
 * a JS-rendered shell with a small HTML payload) we stay silent or downgrade it.
 * A false accusation costs the user the deal and the product its credibility.
 *
 * The only import is a node builtin, so this module stays self-contained and
 * directly unit-testable by the repo's `node --test` runner.
 *
 * Everything here was validated against real businesses: findings are phrased
 * from what we measured on the live page, and no number we quote (a response
 * time, a torn certificate) is one the owner can open a browser and refute.
 */

// ---------- types ----------

export type SiteSeverity = "critical" | "high" | "medium" | "low";

/** `unknown` = we could not get a reliable look at the site; don't judge it. */
export type SiteGrade = "broken" | "poor" | "fair" | "good" | "unknown";

export interface SiteCheck {
  id: string;
  severity: SiteSeverity;
  /** Score points removed — also the ranking weight. */
  weight: number;
  /** Short, quotable phrase: safe to put in an email. */
  label: string;
  /** The concrete evidence behind the label. */
  detail: string;
}

/** Why a certificate check failed — each one is a different thing to say. */
export type TlsProblem = "mismatch" | "expired" | "untrusted" | "unknown";

export interface SiteProbe {
  /** The server answered at all (a 404 still counts — the host is alive). */
  reachable: boolean;
  /** HTTP status, 0 when nothing came back. */
  status: number;
  /**
   * Status of a second check, taken only when the first answered 5xx. Lets the
   * report tell a site that is down from one that wobbled: 0 means the retry
   * itself failed, which is not evidence the site recovered.
   */
  statusRetry?: number;
  /** URL after redirects (or the requested URL when we never got that far). */
  finalUrl: string;
  /** Milliseconds until the response body was read — page weight, not the server. */
  ms: number;
  /**
   * Milliseconds until the first byte arrived: how fast the *server* answers.
   * This is the number we quote, so when the first sample lands in the slow
   * band we take a second one and keep the faster of the two — a speed claim
   * the user repeats must never be contradicted by a re-check.
   */
  ttfb?: number;
  /** How many response-time samples `ttfb` is the minimum of. */
  ttfbSamples?: number;
  /** Bytes of HTML received (the true size, not the parsed sample). */
  bytes: number;
  /** The page was larger than the analysis sample, so `bytes` is a floor. */
  htmlTruncated?: boolean;
  html: string;
  /** True when the failure was a TLS/certificate problem. */
  tlsInvalid: boolean;
  /** Why it failed, when we can tell (TLS failures only). */
  tlsProblem?: TlsProblem;
  /** Hostnames the server's certificate actually covers (mismatch only). */
  tlsCertNames?: string[];
  /** The plain http:// variant answered with markup, so the site does work. */
  plainUrl?: string;
  plainStatus?: number;
  /** The www variant answered over https — the certificate just doesn't cover the bare host. */
  httpsAlt?: boolean;
  error?: string;
}

export interface BrokenLink {
  url: string;
  /** Only 404/410 are reported — those are unambiguous. */
  status: number;
  /** How many anchors on the homepage point at this URL (default 1). */
  anchors?: number;
}

/**
 * Result of the homepage link check. `truncated` means we stopped sampling
 * early, so the count is a floor and the finding must say "at least".
 */
export interface BrokenLinkReport {
  links: BrokenLink[];
  truncated: boolean;
}

export interface SiteOptions {
  /** Detected platform (WordPress, Shopify…) — used to suppress false positives. */
  stack?: string;
  /** Marketing tags found — their absence is itself a (soft) finding. */
  pixels?: string[];
  brokenLinks?: BrokenLink[];
  /** The link check stopped early, so more broken links may exist. */
  brokenLinksTruncated?: boolean;
}

export interface SiteAudit {
  /** 0–100, higher is healthier. */
  score: number;
  grade: SiteGrade;
  checks: SiteCheck[];
  /**
   * True when there's at least one serious, quotable defect — the lead is worth
   * pitching a website project to. Computed here so the server route, the UI
   * and any future consumer all apply the same rule.
   */
  needsWork: boolean;
  /** Pitch-worthy one-liners only (critical + high), safe to quote to a prospect. */
  flags: string[];
  /** One plain-language sentence summarizing what's wrong. */
  summary: string;
  facts: {
    status: number;
    ms: number;
    /** True HTML size; a floor when the page exceeded the analysis sample. */
    bytes: number;
    htmlTruncated: boolean;
    /** Time to first byte — the response time we quote. 0 when unknown. */
    ttfb: number;
    /** How many samples the quoted response time is the minimum of. */
    ttfbSamples: number;
    https: boolean;
    finalUrl: string;
    host: string;
    stack?: string;
    pixels: string[];
    brokenLinks: BrokenLink[];
    /** The link check stopped early, so more broken links may exist. */
    brokenLinksTruncated?: boolean;
    tlsProblem?: TlsProblem;
    tlsCertNames?: string[];
    /** The plain http:// address that does work, when https is broken. */
    plainUrl?: string;
    /** The site works over https at its www address, so only this one is broken. */
    httpsAlt?: boolean;
    /** A failed check that may have been our network, not their site. */
    needsManualCheck: boolean;
  };
}

// ---------- fingerprints ----------

/** Hosts that mean "no real website" — a free builder or a social page. */
const BUILDER_HOSTS =
  /(\.|^)(wixsite\.com|weebly\.com|blogspot\.\w+|wordpress\.com|sites\.google\.com|business\.site|webnode\.\w+|jimdofree\.com|000webhostapp\.com|neocities\.org|facebook\.com|instagram\.com|linktr\.ee)$/i;

/** Builders that render client-side — their homepage HTML is short by design. */
const CLIENT_RENDERED_STACKS = new Set(["Wix", "Squarespace", "Webflow", "GoDaddy Builder", "Weebly"]);

/** A JS app shell, not a thin homepage. */
const SPA_RE =
  /__NEXT_DATA__|id=["'](root|app|__next)["']|data-reactroot|window\.__NUXT__|ng-version|data-v-app/i;

const PLACEHOLDER_TITLES = new Set([
  "home", "homepage", "home page", "untitled", "untitled document", "new page",
  "index", "index.html", "page 1", "welcome", "my site", "website", "default",
]);

/**
 * Real mixed content only — subresources the browser actually fetches over
 * http on an https page, which it blocks or warns about.
 *
 * Deliberately excluded: <a> links and <link> *hints*. WordPress themes ship
 * `<link rel="profile" href="http://gmpg.org/xfn/11">` and Squarespace ships
 * `<link rel="image_src" href="http://...">`; neither loads anything, neither
 * triggers a browser warning, and neither is something the owner can change.
 * "Your site loads insecure content" is a serious accusation and must be true.
 */
const MIXED_RESOURCE_RE =
  /<(?:script|img|iframe|source|video|audio|embed|object)[^>]*\ssrc\s*=\s*["']http:\/\//i;

/** A form posting to http from an https page is blocked by the browser too. */
const MIXED_FORM_RE = /<form[^>]*\saction\s*=\s*["']http:\/\//i;

/** A stylesheet/manifest/icon over http is genuinely loaded — real mixed content. */
const LINK_TAG_RE = /<link\b[^>]*>/gi;
const RESOURCE_REL_RE = /rel\s*=\s*["'][^"']*(?:stylesheet|manifest|preload|icon)[^"']*["']/i;
const HTTP_HREF_RE = /href\s*=\s*["']http:\/\//i;

function hasMixedContent(html: string): boolean {
  if (MIXED_RESOURCE_RE.test(html) || MIXED_FORM_RE.test(html)) return true;
  for (const tag of html.match(LINK_TAG_RE) ?? []) {
    if (RESOURCE_REL_RE.test(tag) && HTTP_HREF_RE.test(tag)) return true;
  }
  return false;
}

const CONTACT_PATH_RE = /mailto:|tel:|<form[\s>]|href=["'][^"']*(?:contact|support|get-in-touch|reach-us|book)/i;

/**
 * Statuses that mean "this site refused OUR request", not "this site is down":
 * bot walls, rate limits, auth walls and legal blocks all answer like this to
 * a datacenter IP while serving visitors perfectly. Accusing a working site of
 * being broken is the one failure mode this engine must never have.
 */
const BLOCKED_STATUSES = new Set([401, 403, 405, 406, 429, 451]);

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * How many distinct homepage URLs we're willing to test. Every anchor is still
 * counted (free), but only this many targets get a request.
 */
const LINK_BUDGET = 12;

/**
 * Markup size bands. HTML alone, before a single image or script.
 *
 * Live measurement of one Tucson HVAC market put four of eight homepages
 * between 440 KB and 690 KB, so a half-megabyte page is common, not a defect
 * worth flagging — it's recorded (medium) and shown in the audit, but it can't
 * drag a modern site into a "needs work" list. Over 1 MB is the extreme that
 * is worth a flag, and it's rare.
 */
const HEAVY_HTML_HIGH = 1_000_000;
const HEAVY_HTML_MEDIUM = 400_000;

/** The analysis cap for markup we actually parse. */
const HTML_SAMPLE = 500_000;

const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": BROWSER_UA,
};

/** Response-time bands. Below SLOW_MS we say nothing — noise is not a pitch. */
const SLOW_MS = 1_000;
const SLOW_STRONG_MS = 2_000;

// ---------- helpers ----------

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Visible text with scripts, styles and tags stripped. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** A URL the way a business owner would recognise it: no scheme, no #anchor. */
function shortUrl(u: string): string {
  return u
    .replace(/^https?:\/\/(www\.)?/i, "")
    .split("#")[0]
    .replace(/\/$/, "")
    .slice(0, 45);
}

/**
 * The certificate finding, phrased from what the server actually presented.
 *
 * "Invalid certificate" is true but useless in a conversation. "It serves a
 * certificate issued for a different website (mindseyesports.com)" is something
 * the owner can check in ten seconds — and it is the version that survives being
 * argued with. The www case gets its own, softer wording on purpose: that site
 * works, only the bare address we were handed warns, and saying otherwise would
 * be a false accusation.
 */
function describeTls(
  probe: SiteProbe,
  host: string
): { severity: SiteSeverity; weight: number; label: string; detail: string } {
  const site = host || "the site";
  const names = probe.tlsCertNames ?? [];
  const plain = probe.plainStatus
    ? ", and the site itself only loads over plain http://, which browsers label 'Not secure'"
    : "";

  /**
   * The address we were handed fails, but the site answers over https at its
   * www address. That is a different finding from "no https": the business has
   * a working secure site and a broken bare domain — which is what anyone who
   * types the name, or clicks a Google result, actually lands on. Saying "your
   * site has no HTTPS" here would be refuted by the owner in ten seconds, and
   * we would deserve it.
   */
  // (When the certificate does name www.<host>, the older, more specific
  // wording below is the better one — the certificate is the whole story there.)
  const altWorks =
    Boolean(probe.httpsAlt) &&
    Boolean(host) &&
    !names.some(
      (n) => n.toLowerCase() === host || n.toLowerCase() === `www.${host}`
    );
  if (altWorks) {
    const why = names.length
      ? `it serves a certificate issued for ${names.slice(0, 2).join(" and ")}`
      : "its certificate doesn't check out";
    return {
      severity: "high",
      weight: 18,
      label: `the address we checked is broken, but https://www.${site} works`,
      detail: `https://${site} can't be opened safely — ${why} — while https://www.${site} is fine, so the problem is the address people type and click`,
    };
  }

  if (probe.tlsProblem === "mismatch") {
    const wwwName = names.find((n) => n.toLowerCase() === `www.${host}`);
    const coversBare = names.some((n) => n.toLowerCase() === host);
    if (wwwName && !coversBare) {
      return probe.httpsAlt
        ? {
            severity: "high",
            weight: 18,
            label: `the certificate only covers ${wwwName}, not the address we checked`,
            detail: `https://${wwwName} works fine; https://${site} makes browsers warn 'your connection is not private'`,
          }
        : {
            severity: "high",
            weight: 18,
            label: `the certificate doesn't cover ${site} (it's issued for ${wwwName})`,
            detail: `browsers warn 'your connection is not private' on https://${site}; check https://${wwwName} before pitching${plain}`,
          };
    }
    if (names.length) {
      return {
        severity: "critical",
        weight: 45,
        label: `the https address serves a certificate issued for a different website (${names[0]})`,
        detail: `browsers refuse to open https://${site} — the certificate presented there was issued for ${names
          .slice(0, 2)
          .join(" and ")}${plain}`,
      };
    }
    return {
      severity: "critical",
      weight: 45,
      label: "the security certificate doesn't match the site's own address",
      detail: `browsers warn 'your connection is not private' on https://${site}${plain}`,
    };
  }
  if (probe.tlsProblem === "expired") {
    return {
      severity: "critical",
      weight: 45,
      label: "the security certificate has expired",
      detail: `browsers warn 'your connection is not private' until it's renewed${plain}`,
    };
  }
  if (probe.tlsProblem === "untrusted") {
    return {
      severity: "critical",
      weight: 45,
      label: "the security certificate isn't trusted by browsers",
      detail: `it isn't signed by an authority browsers recognise, so the warning can't be clicked away${plain}`,
    };
  }
  return {
    severity: "critical",
    weight: 45,
    label: "the security certificate is invalid",
    detail: `browsers warn 'your connection is not private' on https://${site}${plain}`,
  };
}

// ---------- network: probe ----------

/**
 * Fetches a homepage and records the facts an audit needs. Never throws —
 * a failure IS the finding. TLS problems are recorded rather than retried,
 * because "your certificate is invalid" is exactly what the user needs to know.
 */
export async function probeSite(url: string, timeoutMs = 12_000): Promise<SiteProbe> {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const started = Date.now();
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: FETCH_HEADERS,
    });
    const ttfb = Date.now() - started;
    const type = res.headers.get("content-type") ?? "";
    // Only read (and size) actual markup — a PDF or image link isn't a homepage.
    // The full size is measured before sampling, so a genuine page weight can
    // be reported even when the analysis only parses the first slice.
    const raw = type === "" || type.includes("text/html") ? await res.text() : "";
    const html = raw.slice(0, HTML_SAMPLE);
    const declared = Number(res.headers.get("content-length")) || 0;
    const ms = Date.now() - started;
    // A slow response is a claim the user will repeat out loud, so it has to
    // survive a re-measurement: take a second sample and quote the faster one.
    let bestTtfb = ttfb;
    let ttfbSamples = 1;
    if (ttfb > SLOW_MS && res.status < 400) {
      const second = await sampleTtfb(target, html ? timeoutMs : 6_000);
      if (second > 0) {
        bestTtfb = Math.min(ttfb, second);
        ttfbSamples = 2;
      }
    }
    // "Your homepage is down" is the strongest claim this engine makes, and a
    // 5xx is also just a bad minute on someone's server — one Manchester roofer
    // answered six errors in a row and then nine clean pages. Same rule as the
    // speed sample: re-check before putting the claim in a user's mouth.
    let statusRetry: number | undefined;
    if (res.status >= 500) statusRetry = await sampleStatus(target, timeoutMs);
    return {
      reachable: true,
      status: res.status,
      finalUrl: res.url || target,
      ms,
      ttfb: bestTtfb,
      ttfbSamples,
      bytes: raw ? byteLength(raw) : declared,
      htmlTruncated: raw.length > HTML_SAMPLE,
      html,
      statusRetry,
      tlsInvalid: false,
    };
  } catch (err) {
    const ms = Date.now() - started;
    const raw = err instanceof Error ? err.message : String(err);
    const code = String((err as { cause?: { code?: string } })?.cause?.code ?? "");
    const tlsProblem = classifyTls(`${code} ${raw}`);
    if (!tlsProblem) {
      return {
        reachable: false,
        status: 0,
        finalUrl: target,
        ms,
        ttfb: ms,
        ttfbSamples: 1,
        bytes: 0,
        html: "",
        tlsInvalid: false,
        error: `${code} ${raw}`.trim().slice(0, 160),
      };
    }

    // A certificate failure is the one accusation that needs the most care, so
    // spend two extra requests on it: what the certificate actually covers, and
    // whether the site works at all over plain http (which is what the owner
    // will say when they check).
    const base = hostOf(target);
    const askedWww = hostnameOf(target).startsWith("www.");
    const certNames = tlsProblem === "mismatch" ? await readCertNames(hostnameOf(target) || base) : [];
    const plain = await probePlainHttp(base);
    const covers = (n: string) => certNames.some((c) => c.toLowerCase() === n);
    // The certificate covers only the www address, and we asked the bare one —
    // the site is probably fine, so say exactly that instead of "invalid".
    const wwwOnly = tlsProblem === "mismatch" && !askedWww && covers(`www.${base}`) && !covers(base);
    // "Broken" and "no https at all" are different findings, and only the second
    // is a critical one. So whenever the address we were handed fails on TLS,
    // check the www address too: a bare domain pointed at a hosting default
    // (lrl.ltd → CloudNS's own certificate) fails while the real site is up.
    const httpsAlt =
      !askedWww && base ? await httpsWorks(`https://www.${base}`) : undefined;

    return {
      reachable: false,
      status: 0,
      finalUrl: target,
      ms,
      ttfb: ms,
      ttfbSamples: 1,
      bytes: 0,
      html: "",
      tlsInvalid: true,
      tlsProblem,
      tlsCertNames: certNames,
      plainUrl: plain?.url,
      plainStatus: plain?.status,
      httpsAlt,
      error: `${code} ${raw}`.trim().slice(0, 160),
    };
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Why a TLS attempt failed, from the error code — each kind is a different pitch. */
function classifyTls(message: string): TlsProblem | null {
  if (/altname|hostname\/ip does not match|cert_altname/i.test(message)) return "mismatch";
  if (/has expired|expired|expir/i.test(message)) return "expired";
  if (/self.?signed|unable to verify|unable_to_verify|untrusted|issuer|chain/i.test(message)) {
    return "untrusted";
  }
  if (/cert|ssl|tls/i.test(message)) return "unknown";
  return null;
}

/** One more response-time sample: headers only, body cancelled. */
async function sampleTtfb(target: string, timeoutMs: number): Promise<number> {
  const started = Date.now();
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: FETCH_HEADERS,
    });
    const ttfb = Date.now() - started;
    await (res.body?.cancel() ?? Promise.resolve()).catch(() => {});
    return ttfb;
  } catch {
    return 0;
  }
}

/** Status of one more request to the same address, or 0 if it never answered. */
async function sampleStatus(target: string, timeoutMs: number): Promise<number> {
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: FETCH_HEADERS,
    });
    await (res.body?.cancel() ?? Promise.resolve()).catch(() => {});
    return res.status;
  } catch {
    return 0;
  }
}

/**
 * The hostnames a server's certificate actually covers. Only used after a
 * verification failure, where the interesting question is whose certificate it
 * is — "issued for a different website" is checkable by the owner, "invalid"
 * is not.
 */
async function readCertNames(host: string): Promise<string[]> {
  if (!host) return [];
  return new Promise((resolve) => {
    let settled = false;
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      timeout: 6_000,
    });
    const finish = (names: string[]) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(names);
    };
    socket.on("secureConnect", () => {
      try {
        const cert = socket.getPeerCertificate();
        const san = String(cert?.subjectaltname ?? "")
          .split(",")
          .map((s) => s.trim().replace(/^DNS:/i, ""))
          .filter(Boolean);
        const cn = cert?.subject?.CN ? [String(cert.subject.CN)] : [];
        finish(san.length ? san : cn);
      } catch {
        finish([]);
      }
    });
    socket.on("error", () => finish([]));
    socket.on("timeout", () => finish([]));
  });
}

/**
 * Does the site work over plain http? After a certificate failure this is the
 * difference between "your secure address is broken" and "your site only loads
 * over http, which browsers label Not secure" — two very different things to
 * say to an owner.
 */
async function probePlainHttp(host: string): Promise<{ url: string; status: number } | null> {
  if (!host) return null;
  try {
    const res = await fetch(`http://${host}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: FETCH_HEADERS,
    });
    const type = res.headers.get("content-type") ?? "";
    const html = type === "" || type.includes("text/html") ? (await res.text()).slice(0, 20_000) : "";
    if (res.status >= 400 || !/<html|<body|<!doctype/i.test(html)) return null;
    // Landing back on https means this site does NOT serve plain http at all —
    // it upgrades, which is the correct setup. Counting the redirect's final
    // response as "works over plain http" is how a site that is fine at
    // https://www.… gets accused of having no https (lrl.ltd: a 301 to the www
    // address, whose certificate is valid).
    if (/^https:\/\//i.test(res.url || "")) return null;
    return { url: res.url || `http://${host}`, status: res.status };
  } catch {
    return null;
  }
}

/** Does an alternative address answer over https? Used only for the www-only case. */
async function httpsWorks(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: FETCH_HEADERS,
    });
    await (res.body?.cancel() ?? Promise.resolve()).catch(() => {});
    return res.status < 400;
  } catch {
    return false;
  }
}

/**
 * Follows the homepage's own links and reports pages that definitively don't
 * exist (404/410). Bot-blocking (403), rate limits (429), server errors and
 * network failures are ignored on purpose: they don't prove anything about the
 * link, and a wrong "your link is broken" is worse than a missed one.
 *
 * Only real <a href> links are checked. WordPress themes put
 * `<link rel="alternate" href="/feed">` and `<link rel="https://api.w.org/"
 * href="/wp-json">` in the <head>; those genuinely 404 on some hosts, but no
 * visitor can click them and the owner never sees them. Reporting them as
 * "broken links on the homepage" gets the user contradicted the moment they
 * say it out loud.
 */
export async function checkBrokenLinks(
  baseUrl: string,
  html: string,
  limit = 3
): Promise<BrokenLinkReport> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return { links: [], truncated: false };
  }

  const counts = new Map<string, number>();
  const seen = new Set<string>();
  const candidates: string[] = [];
  let truncated = false;
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = tag.match(/href\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!href || href.startsWith("#")) continue;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    let abs: URL;
    try {
      abs = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (abs.origin !== origin) continue; // only the business's own pages
    if (/\.(png|jpe?g|gif|webp|svg|css|js|pdf|zip|ico|woff2?|mp4|xml)$/i.test(abs.pathname)) continue;
    // Cloudflare injects its own endpoints, notably the email-obfuscation
    // anchor `<a href="/cdn-cgi/l/email-protection#...">`. That path 404s to a
    // direct request but resolves fine in a browser, so counting it as a
    // broken homepage link is a false accusation against a healthy site.
    if (/^\/cdn-cgi\//i.test(abs.pathname)) continue;
    // A menu can point at the same dead page nine times. One request answers
    // all nine, but the user needs the count a visitor sees: a nav full of dead
    // links reads very differently from "one broken link".
    const key = abs.pathname + abs.search;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (seen.has(key)) continue;
    // Keep counting every anchor even once we stop collecting new candidates:
    // counting costs nothing, and a cap that truncated the count would
    // understate a menu full of dead links — the exact bug this fixes.
    if (candidates.length >= LINK_BUDGET) {
      truncated = true;
      continue;
    }
    seen.add(key);
    candidates.push(abs.toString());
  }

  const broken: BrokenLink[] = [];
  let i = 0;
  for (; i < candidates.length && broken.length < limit; i += 3) {
    const batch = candidates.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (u) => {
        try {
          const res = await fetch(u, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(4_000),
            headers: { "User-Agent": BROWSER_UA },
          });
          return { url: u, status: res.status };
        } catch {
          return { url: u, status: 0 }; // our network, not their site — ignore
        }
      })
    );
    for (const r of results) {
      if (r.status === 404 || r.status === 410) {
        broken.push({ ...r, anchors: counts.get(keyOf(r.url, baseUrl)) ?? 1 });
      }
    }
  }
  if (broken.length >= limit && i < candidates.length) truncated = true;
  return { links: broken, truncated };
}

/** The dedupe key for a candidate URL: path + query, ignoring any #fragment. */
function keyOf(u: string, baseUrl: string): string {
  try {
    const abs = new URL(u, baseUrl);
    return abs.pathname + abs.search;
  } catch {
    return u;
  }
}

// ---------- pure: analyze ----------

/**
 * Turns a probe into scored findings. Everything here is a statement about
 * measured facts, phrased the way the user could say it to the business owner.
 */
export function analyzeSite(probe: SiteProbe, opts: SiteOptions = {}): SiteAudit {
  const url = probe.finalUrl || "";
  const html = probe.html ?? "";
  const hasHtml = html.length > 0;
  const httpsUrl = /^https:\/\//i.test(url);
  const host = hostOf(url);

  const checks: SiteCheck[] = [];
  const add = (
    id: string,
    severity: SiteSeverity,
    weight: number,
    label: string,
    detail: string
  ) => checks.push({ id, severity, weight, label, detail });

  // A timeout or DNS blip may well be our own network — don't condemn the site.
  const transient = Boolean(
    probe.error && /timeout|abort|eai_again|econnreset|socket|fetch failed|und_err/i.test(probe.error)
  );
  // Nor is a bot wall evidence of anything. Both cases mean "we couldn't get a
  // reliable look", which is a state we report honestly instead of guessing.
  const refused = probe.reachable && BLOCKED_STATUSES.has(probe.status);
  const unjudgeable = (!probe.reachable && transient && !probe.tlsInvalid) || refused;
  // A 5xx response IS an error page, not the site. Reading it for content —
  // "no contact link", "barely any content", "not mobile-friendly" — describes
  // the host's error page and then bills the business for it, which is the one
  // way this engine can be shown to be wrong by a single page load (a real
  // Manchester roofer that answers 500 was told it had no way to get in touch
  // and no mobile viewport). A site that is down gets exactly one finding: the
  // one that matters.
  const serverError = probe.reachable && (probe.status ?? 0) >= 500;

  // ---- transport: measured, never inferred ----
  if (!probe.reachable) {
    if (probe.tlsInvalid) {
      const tlsFinding = describeTls(probe, host);
      add(
        "tls_invalid",
        tlsFinding.severity,
        tlsFinding.weight,
        tlsFinding.label,
        tlsFinding.detail
      );
    } else if (transient) {
      // Could equally be our network as theirs. Recorded, but never a pitch
      // line and never enough to call a site broken.
      add(
        "could_not_load",
        "medium",
        12,
        "we couldn't load the homepage when we checked",
        "the request timed out — verify it manually before pitching"
      );
    } else {
      add(
        "unreachable",
        "critical",
        55,
        "the website doesn't load",
        "the homepage didn't respond when we checked"
      );
    }
  } else {
    if (probe.status >= 400) {
      if (refused) {
        add(
          "blocked",
          "medium",
          12,
          "the site refused our automated check",
          `it answered HTTP ${probe.status} to our server — the page may be perfectly fine in a browser`
        );
      } else if (probe.status >= 500 && probe.statusRetry !== undefined && probe.statusRetry > 0 && probe.statusRetry < 500) {
        // It errored once and answered fine a moment later. A flapping site is
        // worth a call, but "visitors and Google see an error page" is not ours
        // to say from one sample — the owner would load it, see a working page,
        // and be right to distrust the rest of the list.
        add(
          "http_error_intermittent",
          "high",
          18,
          `the homepage was returning an HTTP ${probe.status} error when we checked`,
          "it answered normally on a second check, so the error comes and goes — open with 'your site was down when I looked' rather than 'your site is broken'"
        );
      } else {
        add(
          "http_error",
          "critical",
          50,
          `the homepage returns an HTTP ${probe.status} error`,
          "visitors and Google see an error page"
        );
      }
    }
    if (!httpsUrl && !serverError) {
      add(
        "no_https",
        "high",
        25,
        "no HTTPS",
        "browsers label it 'Not secure' next to the address"
      );
    }
    // Speed is quoted from the server's response, not from how long the page's
    // kilobytes took to arrive — and in whole seconds down, so the number the
    // user repeats stays true when the owner checks the site themselves.
    // Zeroing these on an error page keeps the transport findings off it too:
    // how fast a 500 page answers, or how heavy it is, says nothing about the
    // site behind it.
    const ttfb = serverError ? 0 : probe.ttfb ?? 0;
    if (ttfb > SLOW_STRONG_MS) {
      add(
        "slow",
        "high",
        14,
        `the homepage takes over ${Math.floor(ttfb / 1000)}s just to respond`,
        `it took ${(ttfb / 1000).toFixed(1)}s to start responding${(probe.ttfbSamples ?? 1) > 1 ? " (best of 2 checks)" : ""} — that's the server, not the visitor's connection`
      );
    } else if (ttfb > SLOW_MS) {
      add(
        "slow",
        "medium",
        6,
        "the homepage is slow to start responding",
        `it took ${(ttfb / 1000).toFixed(1)}s to start responding; most sites answer in well under a second`
      );
    }
    // Page weight is exact, unlike a timing sample, and a heavy homepage is slow
    // on a phone however fast the server is. (The old 3.5 MB threshold was
    // unreachable: the markup sample caps out at 0.5 MB, so it never fired for
    // the half-megabyte homepages it was meant to catch.)
    const bytes = serverError ? 0 : probe.bytes;
    if (bytes > HEAVY_HTML_HIGH) {
      add(
        "heavy",
        "high",
        12,
        `the homepage ships over ${(bytes / 1_000_000).toFixed(1)} MB of HTML before any images`,
        "that's the markup alone, and it's what a phone has to download and render first"
      );
    } else if (bytes > HEAVY_HTML_MEDIUM) {
      add(
        "heavy",
        "medium",
        6,
        `the homepage carries a lot of markup (about ${Math.round(bytes / 1000)} KB)`,
        "more to download and render before anything appears on a phone"
      );
    }
  }

  // ---- content: only when we actually have the site's own markup to read ----
  if (hasHtml && !serverError) {
    const text = visibleText(html);
    const clientRendered = SPA_RE.test(html) || CLIENT_RENDERED_STACKS.has(opts.stack ?? "");
    // A homepage larger than the analysis sample is only partly read here, so
    // checks that look for something ANYWHERE in the page (a footer copyright,
    // a contact link at the bottom, the total amount of text) must stay silent:
    // "no contact link" about a page whose footer we never saw is exactly the
    // kind of false accusation this engine exists to avoid.
    const fullDoc = !probe.htmlTruncated;

    if (!/name=["']?viewport/i.test(html)) {
      add(
        "no_viewport",
        "high",
        22,
        "not mobile-friendly",
        "no responsive viewport tag, so phones show a shrunken desktop layout"
      );
    }
    if (/<frameset|<marquee|<blink|\.swf\b/i.test(html)) {
      add(
        "legacy_markup",
        "high",
        20,
        "built with 2000s-era web technology",
        "the page still uses frames/marquee/Flash-era markup"
      );
    }
    if (host && BUILDER_HOSTS.test(host)) {
      add(
        "builder_host",
        "high",
        20,
        `hosted on a free builder or social page (${host})`,
        "the business doesn't have a real website of its own"
      );
    }
    if (httpsUrl && hasMixedContent(html)) {
      add(
        "mixed_content",
        "high",
        18,
        "insecure content on a secure page",
        "the https page still loads resources over http://"
      );
    }
    if (opts.brokenLinks?.length) {
      // Count the links a visitor can click, not the URLs we happened to
      // request: a product menu where all nine entries lead to the same dead
      // page is not "1 broken link".
      const anchors = opts.brokenLinks.reduce((sum, b) => sum + (b.anchors ?? 1), 0);
      const one = opts.brokenLinks.length === 1;
      // Sampling a partial page is the same kind of truncation as stopping
      // early: the count becomes a floor either way.
      const sampled = Boolean(opts.brokenLinksTruncated || probe.htmlTruncated);
      const targets = opts.brokenLinks
        .map((b) =>
          one
            ? shortUrl(b.url)
            : `${shortUrl(b.url)}${(b.anchors ?? 1) > 1 ? ` (${b.anchors} links)` : ""}`
        )
        .slice(0, 3)
        .join(", ");
      add(
        "broken_links",
        "high",
        16,
        `${sampled ? "at least " : ""}${anchors} broken link${anchors > 1 ? "s" : ""} on the homepage`,
        one
          ? `all of them point at ${targets}, which doesn't exist`
          : targets
      );
    }

    // Softer signals: real, but not enough alone to call a site broken.
    if (fullDoc && !clientRendered && text.length < 350) {
      add(
        "thin_content",
        "medium",
        12,
        "barely any content on the homepage",
        `only ~${text.length} characters of visible text`
      );
    }
    const years = fullDoc
      ? [...html.matchAll(/(?:©|&copy;|&#169;|copyright)[^\d]{0,20}(\d{4})/gi)]
          .map((m) => parseInt(m[1], 10))
          .filter((y) => y >= 1995 && y <= new Date().getFullYear())
      : [];
    if (years.length) {
      const latest = Math.max(...years);
      const age = new Date().getFullYear() - latest;
      if (age >= 3) {
        add(
          "stale_copyright",
          "medium",
          12,
          `site last touched around ${latest} (copyright notice)`,
          `the footer copyright still says ${latest}`
        );
      }
    }
    if (fullDoc && /lorem ipsum|under construction/i.test(text)) {
      add(
        "placeholder_content",
        "medium",
        10,
        "placeholder content left in place",
        "unfinished filler text is still visible on the page"
      );
    }
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
    if (!title) {
      add("no_title", "medium", 8, "the homepage has no page title", "the browser tab and Google result show the URL");
    } else if (PLACEHOLDER_TITLES.has(title.toLowerCase())) {
      add("placeholder_title", "low", 3, `the page title is still "${title}"`, "the browser tab and Google result look unfinished");
    }
    if (fullDoc && !CONTACT_PATH_RE.test(html)) {
      add(
        "no_contact_on_homepage",
        "medium",
        6,
        "no way to get in touch from the homepage",
        "no email link, phone link, form, or contact-page link on the homepage"
      );
    }
    const description = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "";
    if (description.trim().length < 20) {
      add("no_meta_description", "low", 3, "no meta description", "Google has to invent the text under the search result");
    }
    if (!/<h1[\s>]/i.test(html)) {
      add("no_h1", "low", 3, "no main heading (H1)", "there's no top-level heading for Google to read");
    }
    if (!(opts.pixels?.length ?? 0)) {
      add("no_analytics", "low", 2, "no analytics or ad tags detected", "nothing detected on the homepage, so site performance is invisible");
    }
  }

  const score = Math.max(0, Math.min(100, 100 - checks.reduce((sum, c) => sum + c.weight, 0)));
  const grade: SiteGrade =
    unjudgeable
      ? "unknown"
      : score >= 85
        ? "good"
        : score >= 65
          ? "fair"
          : score >= 40
            ? "poor"
            : "broken";

  // Only serious, quotable findings become flags — the UI badge and the notes
  // the AI personalizes from. A missing meta description must never make a
  // healthy business look "broken" in front of its owner.
  const flags = checks
    .filter((c) => c.severity === "critical" || c.severity === "high")
    .map((c) => (c.detail && c.detail.length <= 80 ? `${c.label} (${c.detail})` : c.label));

  const top = [...checks].sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => c.label);
  const summary =
    grade === "unknown"
      ? "The site blocked or didn't answer our automated check, so there's nothing reliable to audit — open it in a browser before pitching."
      : checks.length === 0
        ? "No concrete website problems found on the homepage."
        : `${checks.length} concrete problem${checks.length > 1 ? "s" : ""} found on the homepage: ${top.join("; ")}.`;

  // Only serious defects count. A missing meta description must never make a
  // healthy business look "broken" in front of its owner.
  const needsWork =
    grade !== "unknown" && checks.some((c) => c.severity === "critical" || c.severity === "high");

  return {
    score,
    grade,
    checks,
    needsWork,
    flags,
    summary,
    facts: {
      status: probe.status,
      ms: probe.ms,
      bytes: probe.bytes,
      htmlTruncated: Boolean(probe.htmlTruncated),
      ttfb: probe.ttfb ?? 0,
      ttfbSamples: probe.ttfbSamples ?? 0,
      https: httpsUrl,
      finalUrl: url,
      host,
      stack: opts.stack,
      pixels: opts.pixels ?? [],
      brokenLinks: opts.brokenLinks ?? [],
      brokenLinksTruncated: opts.brokenLinksTruncated,
      tlsProblem: probe.tlsProblem,
      tlsCertNames: probe.tlsCertNames,
      plainUrl: probe.plainUrl,
      /** The site answers over https at its www address (see `httpsAlt`). */
      httpsAlt: probe.httpsAlt,
      needsManualCheck: unjudgeable,
    },
  };
}

/**
 * Whether this lead is a genuine "your website needs work" prospect. Thin
 * wrapper over the value analyzeSite already computed, kept as a named
 * predicate so server code reads the way it reasons.
 */
export function isRedesignProspect(audit: SiteAudit | null | undefined): boolean {
  return audit?.needsWork === true;
}
