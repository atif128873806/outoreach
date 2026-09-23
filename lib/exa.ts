/**
 * Web-wide company search via Exa's public MCP endpoint (https://mcp.exa.ai/mcp).
 *
 * Exa's `category:company` semantic search returns company profiles that often
 * already include emails, phones, and addresses — richer than map data, and it
 * finds businesses that aren't on any map (agencies, online stores, SaaS).
 * Free, no API key. Integration approach borrowed from the agent-reach project
 * (https://github.com/Panniantong/agent-reach).
 */

import { extractInstagram, normalizeLinkedin, type Lead } from "./leads";
import {
  extractEmails,
  officialWebsiteFrom,
  pagePhone,
  peopleQuery,
  personNameMatchesAny,
  personProfileFromUrl,
  pickPhone,
  socialProfileMatches,
  splitSearchResults,
} from "./scrape";
import {
  countryAgrees,
  countryFromHost,
  countryOfText,
  locationTerms,
} from "./geo";
import {
  SearchAllowanceSpentError,
  allowanceResetFrom,
  allowanceResumesAt,
  utcClock,
} from "./search-budget";

const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

/**
 * The deployment's own search key, when it has one.
 *
 * Without it the endpoint serves a shared free allowance — measured on a real
 * session, and it is a *daily* budget the entire deployment draws on: once a few
 * searches have run, every user after that gets "provider is busy" until
 * midnight UTC, and the own-account key on a lead can't be fetched either. With
 * the key, requests are answered against the deployment's own plan instead.
 *
 * Held in the environment like COMPANIES_HOUSE_API_KEY and GROQ_API_KEY, so no
 * user is ever asked for it — they just get a search that works.
 */
function exaApiKey(): string {
  return (process.env.EXA_API_KEY ?? "").trim();
}

/** Whether this deployment runs on its own search key (surfaced in Settings). */
export function hasExaKey(): boolean {
  return Boolean(exaApiKey());
}

/**
 * When the endpoint last told us its allowance was gone (see `search-budget`).
 *
 * Remembered so one spent allowance costs one request instead of one per look-up:
 * a register search asks for a contact on every lead, and firing twenty calls at
 * an endpoint that has already refused them all only makes the wait longer.
 */
let allowanceSpentUntil = 0;

/** The moment the shared allowance comes back, or 0 when it is available. */
export function searchAllowanceResumesAt(): number {
  return allowanceResumesAt(allowanceSpentUntil);
}

/**
 * How many profiles one call may ask for, measured against the live endpoint:
 * `numResults: 100` returns 91 profiles (85 distinct hosts, 89 of them carrying
 * a phone, an email or a headquarters) in about 3 seconds, while 200 comes back
 * empty. So the ceiling is real, but it is nowhere near where this code put it:
 * the old limit here was 50, under a comment claiming that was the tool's own
 * ceiling. It was ours, and it is why anything above 50 could never be filled.
 * The cost of asking 100 instead of 50 is latency (1 second to 2-3), not money
 * and not quota — this endpoint is free and unmetered, and profiles the locality
 * gate later discards are never enriched.
 */
const MAX_RESULTS = 100;

/** The size to fall back to when a maxed-out call comes back empty. */
const RETRY_RESULTS = 50;

/**
 * How many profiles to ask for, given how many the caller can use.
 *
 * Deliberately more than `needed`. The retriever answers in rank order and the
 * pipeline then throws away every business whose own address isn't in the city
 * that was asked for — measured on a real roofer search at 24% of the top 25
 * results, 44% by rank 50 and 100% of rank 76+, so about half of a deep request
 * is discarded before enrichment. Sizing the request exactly to the enrichment
 * window (what this did last) meant the request could not supply the window: a
 * 40-lead search, whose window is 50 profiles, asked for 50, received 41
 * profiles of which 28 were in Manchester, and answered with about twenty rows.
 * Asking for 100 received 86 profiles, 44 of them local, and filled the
 * request. The retriever's output also runs a little short of what it is asked
 * for (~85%), which the same margin covers.
 *
 * A large search now fills its window; a small one gets a slightly deeper pool
 * to choose from at the cost of parsing a bigger reply. Nothing extra is ever
 * *enriched*: the slice is still `needed`, and profiles dropped by the locality
 * gate cost no probe, no audit and no quota.
 */
export function requestSize(needed: number): number {
  return Math.min(Math.max(Math.ceil(needed * 2), 1), MAX_RESULTS);
}

/** Result hosts that are platforms/directories, not a business's own site. */
const JUNK_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "wikipedia.org",
  "yelp.com",
  "tripadvisor.com",
  "yellowpages.com",
  "reddit.com",
  "medium.com",
  "quora.com",
  "glassdoor.com",
  "indeed.com",
  "crunchbase.com",
  "trustpilot.com",
  "google.com",
  "amazon.com",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isJunkHost(host: string): boolean {
  return JUNK_HOSTS.some((j) => host === j || host.endsWith(`.${j}`));
}

/** Calls a tool on the Exa MCP server and returns its text content. */
async function exaMcpCall(
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  const key = exaApiKey();
  // A key answers against its own plan, so a spent free allowance says nothing
  // about whether this deployment can search right now.
  if (!key) {
    const resumesAt = allowanceResumesAt(allowanceSpentUntil);
    if (resumesAt) throw new SearchAllowanceSpentError(resumesAt);
  }

  const res = await fetch(EXA_MCP_URL, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(key ? { "x-api-key": key } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  if (res.status === 429) {
    const resumesAt = allowanceResetFrom(res.headers);
    // A key answers against its own plan, so only the keyless path is a shared
    // allowance worth remembering.
    if (!key) allowanceSpentUntil = Math.max(allowanceSpentUntil, resumesAt);
    throw new SearchAllowanceSpentError(resumesAt);
  }
  if (!res.ok) {
    throw new Error(`Web search failed (${res.status}) — try again in a minute`);
  }

  // The endpoint answers as plain JSON or as an SSE stream, depending on mood.
  const raw = (await res.text()).trim();
  interface RpcReply {
    error?: { message?: string };
    result?: { isError?: boolean; content?: { type: string; text?: string }[] };
  }
  let reply: RpcReply | undefined;
  if (raw.startsWith("{")) {
    reply = JSON.parse(raw) as RpcReply;
  } else {
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const candidate = JSON.parse(line.slice(5).trim()) as RpcReply;
        if (candidate.result || candidate.error) {
          reply = candidate;
          break;
        }
      } catch {
        // partial/keepalive data line — keep looking
      }
    }
  }
  if (!reply) throw new Error("Web search returned an unreadable response");
  if (reply.error) {
    throw new Error(`Web search error: ${reply.error.message ?? "unknown"}`);
  }
  const text = reply.result?.content?.find((c) => c.type === "text")?.text ?? "";
  if (reply.result?.isError) {
    // The endpoint answers a rejected key inside a 200 response, so this is the
    // only place a bad deployment key is visible. Say whose key it is: the
    // person reading this cannot fix it, and the person who can isn't looking.
    if (key && /invalid api key|unauthoriz/i.test(text)) {
      throw new Error(`Web search error: the deployment's EXA_API_KEY was rejected — ${text.slice(0, 120)}`);
    }
    throw new Error(`Web search error: ${text.slice(0, 200) || "unknown"}`);
  }
  return text;
}

/**
 * Web search through one place, because the tool's schema marks `objective` as
 * REQUIRED and this code used to omit it. The parameter tells the retriever
 * which documents should rank first and which to exclude, so every search now
 * says what it actually wants.
 *
 * Measured, not assumed: an objective asking for Austin-only businesses did NOT
 * reduce out-of-area profiles for a real search (1 of 25 either way). The
 * retriever answers with pages, and a practice in Ohio whose page text mentions
 * Austin matches "dentist in Austin, USA" perfectly well. Locality is enforced
 * on the parsed records in the leads route — don't expect this field to do it.
 */
async function exaSearch(query: string, objective: string, numResults: number): Promise<string> {
  return exaMcpCall("web_search_exa", { query, objective, numResults });
}

/** Pulls a "Field: value" line (with or without a leading list dash). */
function field(entry: string, name: string): string {
  const m = entry.match(new RegExp(`^[-*\\s]*${name}:[ \\t]*(.+)$`, "mi"));
  return m ? m[1].trim() : "";
}

/**
 * Pulls the narrative description out of a company profile block — the prose
 * about what the business does, its size and founding. Imported into the
 * contact's notes, it gives the AI real material to personalize with.
 */
function extractDescription(entry: string): string {
  const afterHighlights = entry.split(/^Highlights:\s*$/m)[1] ?? entry;
  const parts: string[] = [];
  for (const line of afterHighlights.split("\n")) {
    const t = line.trim();
    if (!t || t === "..." || t === "…") continue;
    if (/^[-*#\[!>|]/.test(t)) continue; // field lists, headings, images, quotes
    if (/^(Title|URL|Published|Author):/i.test(t)) continue;
    if (t.length < 40) continue; // fragments
    parts.push(t);
    if (parts.join(" ").length > 260) break;
  }
  let out = parts.join(" ").replace(/\s+/g, " ");
  if (out.length > 300) out = out.slice(0, 297).trimEnd() + "…";
  return out;
}

/**
 * Searches the web for companies matching a niche + location. Results come
 * back as one text blob of profile blocks separated by `---`; each block is
 * parsed into a Lead. Many already carry an email, so enrichment only has to
 * fill the gaps.
 *
 * @param needed how many profiles the caller can actually put to use — its
 *   enrichment window. The *request* is sized above that window by
 *   `requestSize`, because the locality gate discards much of a deep reply, and
 *   sizing the request to the window itself is what left 40-lead searches
 *   answering with half of what was asked for. What is enriched is still
 *   exactly this many.
 */
export async function searchExaCompanies(
  niche: string,
  location: string,
  needed: number
): Promise<Lead[]> {
  const query = `category:company ${niche.trim()} in ${location.trim()}`;
  const objective = `Company profile pages for ${niche.trim()} businesses in ${location.trim()}: each company's own website, email, phone number and headquarters address. Exclude directories, listicles and news articles.`;

  const seen = new Set<string>();
  // Loop-invariant, and the country decides how every phone in the reply is read.
  const uk = locationTerms(location).country === "GB";

  /** Parses one reply into leads, skipping hosts already collected. */
  const parse = (text: string): Lead[] => {
    const leads: Lead[] = [];
    for (const entry of text.split(/\n-{3,}\n/)) {
      const name = field(entry, "Title");
      const url = field(entry, "URL");
      if (!name || !url) continue;

      const host = hostOf(url);
      if (!host || isJunkHost(host) || seen.has(host)) continue;
      seen.add(host);

      // Prefer the profile's explicit Emails field; fall back to scanning the block.
      const emailField = field(entry, "Emails?");
      const emails = extractEmails(emailField || entry);

      const homepage = field(entry, "Homepage");
      const website = homepage
        ? homepage.startsWith("http")
          ? homepage
          : `https://${homepage}`
        : url;

      // Web search labels all sorts of things "Phone" — copyright ranges
      // ("2000-2025"), company IDs, archival timestamps — and publishes the field
      // as a comma list where the first entry is often the broken one. Pick the
      // first entry a person could actually dial, repairing the UK trunk prefix
      // when that's the market being searched.
      leads.push({
        business_name: name,
        category: niche.trim(),
        website,
        phone: pickPhone(field(entry, "Phone"), { uk }),
        email: emails[0] ?? "",
        instagram: extractInstagram(entry),
        linkedin: normalizeLinkedin(field(entry, "LinkedIn")),
        address: field(entry, "Headquarters") || field(entry, "Address"),
        notes: extractDescription(entry),
        source: "web_search",
      });
    }
    return leads;
  };

  const size = requestSize(needed);
  let leads = parse(await exaSearch(query, objective, size));
  // A size the endpoint won't serve comes back empty rather than short (200 does
  // exactly that), and the caller cannot tell that apart from "no businesses
  // here". One retry at a size we have seen work turns a mysteriously empty
  // search into the results the user asked for.
  if (leads.length === 0 && size > RETRY_RESULTS) {
    leads = parse(await exaSearch(query, objective, RETRY_RESULTS));
  }

  // Leads that already have contact info first, same as the other sources.
  leads.sort(
    (a, b) =>
      Number(Boolean(b.email)) * 4 + Number(Boolean(b.website)) * 2 + Number(Boolean(b.instagram)) -
      (Number(Boolean(a.email)) * 4 + Number(Boolean(a.website)) * 2 + Number(Boolean(a.instagram)))
  );
  return leads;
}

// ---------- decision-maker finder (category:people) ----------

export interface PersonCandidate {
  name: string;
  /** LinkedIn path, e.g. "in/janedoe" — "" when the person was found on X. */
  linkedin: string;
  /** X (Twitter) handle, without the @ — "" when found on LinkedIn. */
  x: string;
  role: string;
  /** true when the role looks like owner/founder/C-level */
  isOwner: boolean;
  /**
   * The name was checked against a name from an official record, so this is the
   * person the register names rather than whoever ranks for the company.
   */
  verified?: boolean;
}

const OWNER_RE = /\b(owner|founder|co-?founder|ceo|president|managing director|principal|proprietor)\b/i;

/**
 * Finds the people behind a business via Exa's LinkedIn people search.
 * Returns candidates ranked owner-ish roles first — results can include
 * employees or alumni, so the user picks which one to attach.
 */
export async function searchExaPeople(
  businessName: string,
  location: string,
  opts: { people?: string[] } = {}
): Promise<PersonCandidate[]> {
  const who = (opts.people ?? []).map((p) => (p ?? "").trim()).filter(Boolean);
  const { query, objective } = peopleQuery(businessName, location, who);
  const text = await exaSearch(query, objective, 6);

  const seen = new Set<string>();
  const candidates: PersonCandidate[] = [];

  for (const entry of text.split(/\n-{3,}\n/)) {
    const name = field(entry, "Title");
    const url = field(entry, "URL");
    if (!name || !url) continue;

    const { linkedin, x } = personProfileFromUrl(url);
    if (!linkedin && !x) continue;

    // A known name is a check, not a hint: when the register has named the
    // directors, only one of them may be attached to the lead. Everything else
    // the search returned is somebody else, however plausible their headline.
    const verified = who.length ? personNameMatchesAny(name, who) : false;
    if (who.length && !verified) continue;

    const id = linkedin || `x/${x}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // Role lines look like "### <Role> - [Company](…)" or "<Role> at <Company>"
    let role = "";
    const heading = entry.match(/^#{2,4}\s+(.{3,70}?)\s+-\s+\[/m);
    if (heading) role = heading[1].trim();
    if (!role) {
      const atLine = entry.match(/^([A-Z][^\n]{3,60}?) at [A-Z][^\n]{2,50}$/m);
      if (atLine) role = atLine[1].trim();
    }

    candidates.push({
      name,
      linkedin,
      x,
      role,
      // A person the register names as a director is a decision maker whatever
      // their profile headline says.
      isOwner: verified || OWNER_RE.test(role) || OWNER_RE.test(entry.slice(0, 600)),
      verified,
    });
  }

  candidates.sort(
    (a, b) => Number(b.verified) - Number(a.verified) || Number(b.isOwner) - Number(a.isOwner)
  );
  return candidates.slice(0, 4);
}

// ---------- offline-business contact hunt ----------

/**
 * A business with no website usually still has a public footprint — an
 * Instagram page, a directory listing with a phone, sometimes an email.
 * One web search per business digs those up so offline leads become
 * actually reachable (IG DM campaigns / calls).
 */
export async function findOfflineContact(
  businessName: string,
  location: string,
  // The market, when the caller has already worked it out from the results.
  // Without it the location box is the only evidence, and "Leeds" names no
  // country — which is how a truncated UK number survives a digit count.
  opts: { country?: "GB" | "US" | null } = {}
): Promise<{ instagram: string; phone: string; email: string; website: string }> {
  try {
    const text = await exaSearch(
      `"${businessName}" ${location} instagram contact phone`,
      `The business's own pages and listings — official website, Google Business Profile, Instagram, Facebook — with a phone number or email if one is published. It is the "${businessName}" in ${location}; exclude businesses of the same name elsewhere.`,
      5
    );
    const country = opts.country ?? locationTerms(location).country;
    const uk = country === "GB";
    const results = splitSearchResults(text);

    // A page that places the business in another country is a different
    // business, however well the name agrees. Measured: the register's Leeds
    // roofer "Ironpeak Roofing Services Ltd" matched ironpeakroofingservices.com
    // — a company of the same name serving California's Inland Empire — and its
    // Californian phone number went out on the lead as the roofer's own.
    const inSameMarket = (host: string, body: string) =>
      countryAgrees(country, countryFromHost(host) ?? countryOfText(body, country));

    /**
     * The only pages allowed to speak for this business: a social profile
     * wearing its name, matched on the handle its owner chose.
     *
     * A website is deliberately *not* in that set, though it looks like the
     * obvious candidate. This function runs only for the "no website" search,
     * where a page that really is the business's own site means the business has
     * one — and the route drops such a lead rather than showing it. So an "own
     * site" block left standing here is, by construction, a different business
     * that shares words with the name.
     *
     * Measured over 24 real register leads, that branch produced eight contact
     * details for a single lead and every one belonged to somebody else: a
     * Californian company of the same name as a Leeds roofer, then — once
     * ownership was tightened to agree on two words — a Leeds phone number
     * belonging to "Yorkshire Roofing", which this product lists as a separate
     * business, matched only because both names contain "roofing" and
     * "Yorkshire". A domain is a bag of trade and place words; a handle is an
     * identifier its owner chose. Only the second is evidence.
     */
    const speaksFor = results.filter(
      (r) => socialProfileMatches(r.host, r.url, businessName) && inSameMarket(r.host, r.body)
    );

    let instagram = "";
    for (const r of speaksFor) {
      const handle = extractInstagram(r.body);
      if (handle) {
        instagram = handle;
        break;
      }
    }

    let phone = "";
    for (const r of speaksFor) {
      // Same trunk-prefix repair and same UK shape rule as the company source:
      // these numbers go on a dial list for the same user, and a directory
      // page's "17858 182-184" is a street number beside a register id.
      const found = pagePhone(r.body, { uk });
      if (found) {
        phone = found;
        break;
      }
    }

    let email = "";
    for (const r of speaksFor) {
      const found = extractEmails(r.body, r.host)[0];
      if (found) {
        email = found;
        break;
      }
    }

    return {
      instagram,
      phone,
      email,
      // Answers whether the business has a website at all, which a register that
      // lists none cannot tell us. This one *does* read the whole reply: their
      // real site may sit below a mirror of their register record. Empty when
      // nothing matches its own name — and the same country rule applies, because
      // a namesake's site abroad would silently drop a real lead out of a
      // "no website" list while looking like diligence.
      website: officialWebsiteFrom(
        results
          .filter((r) => inSameMarket(r.host, r.body))
          .map((r) => r.body)
          .join("\n---\n"),
        businessName
      ),
    };
  } catch {
    // Best-effort — never fail the search.
    return { instagram: "", phone: "", email: "", website: "" };
  }
}
