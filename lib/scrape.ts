/**
 * Pure scraping primitives shared by the lead sources (lib/leads.ts,
 * lib/exa.ts): pulling contact details out of page text and fingerprinting what
 * a website is built with.
 *
 * Deliberately dependency-free — no fetches, no imports — so it can be unit
 * tested directly, and so lead sources never grow a hidden network dependency
 * just by reusing a helper.
 */

// The match may open on "+" or "(" so a real "(512) 671-6464" is kept whole
// rather than reduced to "512) 671-6464" — this value ends up on a dial list.
const PHONE_RE = /\+?\(?\d[\d\s().\-]{7,}\d/g;

/**
 * An IPv4 address or a dotted version number, e.g. "45.41.177.67". Scraped
 * contact blocks are full of these, and nine digits in four dot-separated
 * groups looks exactly like a phone number to a digit count.
 */
function isDottedQuad(raw: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(raw.trim());
}

/** "2000-2025", "2019 – 2025": a copyright span, not a number to dial. */
function isYearRange(raw: string): boolean {
  const m = raw.trim().match(/^(\d{4})\s*[-–—]\s*(\d{4})$/);
  if (!m) return false;
  const from = Number(m[1]);
  const to = Number(m[2]);
  return from >= 1900 && from <= 2099 && to >= 1900 && to <= 2099;
}

/**
 * Could a human dial this? Gates phone numbers that arrive as an opaque
 * "Phone" field from web search, which happily labels a copyright range, a
 * server's IP address or a company ID as a phone. Handing a user a number that
 * isn't one costs them a call and their confidence in the list.
 */
export function isPlausiblePhone(raw: string, opts: { uk?: boolean } = {}): boolean {
  const value = (raw ?? "").trim();
  if (!value || !/\d/.test(value) || /[a-z]/i.test(value)) return false;
  if (isYearRange(value) || isDottedQuad(value)) return false;
  // An ellipsis means the text was truncated, and the digits around it were
  // never one number: a register page's company number glued to the first
  // digits of an address arrived as "(17164805) ... 54" and cleared a digit
  // count. Nothing dialable is ever spelled with an ellipsis in it.
  if (/\.{3}|…/.test(value)) return false;
  if (opts.uk) return isPlausibleUkPhone(value);
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 13;
}

/**
 * A number a UK network would actually connect.
 *
 * A UK national number — everything after the trunk zero — is always exactly 10
 * digits: 0113 271 8830, 07467 224271, 0800 458 7751, 0300 123 4567. So the
 * rule is one number of the right length, and both ways of getting it wrong are
 * caught by it:
 *
 *  11 digits — two things that are not one number were glued together: a
 *              register id onto an address ("17858 182-184"), a country code
 *              onto a number that already carried its trunk zero
 *              ("+44 (0)330 088 7111"), or an area code onto a digit run that
 *              was never a phone at all ("+44 (1783) 1097778").
 *   9 digits — a number with a digit missing, which is what a search snippet
 *              truncating it produces ("+44 113 275 262" for 0113 275 2629).
 *              It looks like a number and dials nobody.
 *
 * Both were handed to real users on a dial list. A digit count accepts them; a
 * phone does not.
 */
export function isPlausibleUkPhone(raw: string): boolean {
  const value = (raw ?? "").trim();
  if (!value) return false;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0044")) digits = digits.slice(4);
  else if (value.startsWith("+") && digits.startsWith("44")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^[1-9]\d{9}$/.test(digits);
}

/**
 * A date or timestamp that reads as a phone number to a digit count:
 * "2021-08-13 10:30" is twelve digits. Scraped contact blocks are full of
 * these, and a call to a date reaches nobody.
 */
function isDateLike(raw: string): boolean {
  const value = raw.trim();
  if (/^(?:19|20)\d{2}[.\-/]/.test(value)) return true; // starts on a year
  return /\d{1,2}:\d{2}/.test(value); // carries a clock time
}

/**
 * UK numbers are published with a leading 0 — the national trunk prefix. Web
 * search and company databases routinely drop it ("161 7966995",
 * "7467224271"), and the result is not dialable from anywhere: 07467 224271 is
 * a Manchester mobile, 7467224271 is nothing. When the search is for the UK and
 * what's left is a UK national number shape, the zero goes back on.
 *
 * Only the presence of the zero is repaired; the number itself is untouched.
 */
export function restoreTrunkPrefix(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  // The opposite mistake, and just as undialable: a national number written
  // with an international prefix still carrying its trunk zero. "+44-0113 242
  // 8411" reaches nobody — after a country code the zero has no place.
  const international = value.match(/^(\+44|0044)[\s\-.]*0(\d[\d\s().\-]*)$/);
  if (international) return `+44 ${international[2]}`.trim();
  if (value.startsWith("+") || value.startsWith("0")) return value;
  const digits = value.replace(/\D/g, "");
  // 01/02/03 geographic, 07 mobile, 08 freephone — 9 or 10 digits once the
  // trunk zero is gone. Anything else (a US 512…, a 3-digit country code) is
  // left exactly as it arrived rather than guessed at.
  if ((digits.length === 9 || digits.length === 10) && /^[12378]/.test(digits)) return `0${value}`;
  return value;
}

/**
 * Best plausible phone number in a blob of text. Prefers international
 * (+…) formats; 9–13 digits keeps real numbers and drops the long numeric
 * IDs (Facebook, tracking) that lurk in search results.
 */
export function extractPhone(text: string, opts: { uk?: boolean } = {}): string {
  const candidates = (text.match(PHONE_RE) ?? [])
    .map((raw) => raw.trim().replace(/\s+/g, " "))
    // The pattern tolerates spaces and dots, so it glues a nearby year onto the
    // number ("serving Austin since 1997. 512.454.4211" matches as one run and
    // then fails the digit count, losing a real number). Drop a leading year
    // fragment and keep the part that is actually dialable.
    .map((raw) => raw.replace(/^\+?\(?(?:19|20)\d{2}\)?[.\- ]+/, ""))
    .map((raw) => (opts.uk ? restoreTrunkPrefix(raw) : raw))
    .filter((raw) => isPlausiblePhone(raw, opts) && !isDateLike(raw));
  candidates.sort(
    (a, b) =>
      Number(b.startsWith("+")) - Number(a.startsWith("+")) ||
      Number(/[ ().-]/.test(b)) - Number(/[ ().-]/.test(a))
  );
  return candidates[0] ?? "";
}

/**
 * The visible words on a page, with everything that only looks like text gone.
 *
 * Scraped markup is full of number-like runs that are not phone numbers: an
 * inline SVG carries `data-bbox="20 20 160 160"`, embedded data URIs carry
 * coordinates and hashes, stylesheets carry pixel values. All of them can pass
 * a digit-count check, and one of them (a real Wix page) was handed to the user
 * as the business's phone number. Attributes, scripts and styles are not what a
 * visitor reads, so they are removed before anything is extracted from them.
 */
export function visibleText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The phone number a page actually publishes.
 *
 * A `tel:` link is the page telling a browser which number to dial, so it wins
 * outright. Only if there is none does the visible text get scanned — never the
 * raw markup, where coordinates and tracking IDs masquerade as phone numbers.
 */
export function pagePhone(html: string, opts: { uk?: boolean } = {}): string {
  if (!html) return "";
  for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    const phone = extractPhone(m[1], opts);
    if (phone) return phone;
  }
  return extractPhone(visibleText(html), opts);
}

/**
 * A number reduced to its national digits, so two spellings of the same line
 * can be compared: "+44 (0)330 088 7111", "03300887111" and "+443300887111"
 * are all the same number, and "(512) 454-4211" is the same as "+1 512 454 4211".
 */
function nationalDigits(value: string, opts: { uk?: boolean } = {}): string {
  let digits = (value ?? "").replace(/\D/g, "");
  if (opts.uk) {
    if (digits.startsWith("0044")) digits = digits.slice(4);
    else if (digits.startsWith("44") && digits.length >= 9) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);
  } else {
    if (digits.startsWith("001")) digits = digits.slice(3);
    else if (digits.startsWith("1") && digits.length === 11) digits = digits.slice(1);
  }
  return digits;
}

/**
 * Decides between the number we were handed and the one the site publishes.
 *
 * Source fields carry truncated copies of real numbers: one lead arrived as
 * "0113 271883" where the site says 0113 2718830, another as "+44 (0)330 088 7"
 * for +44 (0)330 088 7111. A number that dials nobody is worse than no number,
 * so a number whose national digits are a strict prefix of the published one is
 * replaced by it — and nothing else is ever touched, because a genuinely
 * different number (a second line, a mobile) belongs to the business too.
 */
export function reconcilePhone(
  current: string,
  published: string,
  opts: { uk?: boolean } = {}
): string {
  if (!published) return current;
  if (!current) return published;
  const have = nationalDigits(current, opts);
  const site = nationalDigits(published, opts);
  if (have.length >= 6 && site.length > have.length && site.startsWith(have)) return published;
  return current;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Directories, marketplaces and social platforms — never a business's own site. */
const DIRECTORY_HOST =
  /(facebook|instagram|linkedin|twitter|x|youtube|tiktok|pinterest|wikipedia|yelp|tripadvisor|yell|thomsonlocal|checkatrade|trustpilot|google|bing|apple|amazon|ebay|etsy|gumtree|indeed|glassdoor|crunchbase|reddit|medium|quora|foursquare|nextdoor|justdial|trustatrader|ratedpeople|mybuilder|bark|freeindex|cylex|hotfrog|companieshouse|gov\.uk|nhs\.uk)\b/i;

/**
 * Company-register mirrors and data brokers.
 *
 * These republish a register record — or list thousands of them — and print the
 * *publisher's* own contact details on every page. A lookup for one Leeds
 * roofer returned b2bhint, opencorpdata and clarity-project beside the real
 * result, and the directory's own site-wide address (ukclaritypro@gmail.com,
 * carried by every page clarity-project publishes) was handed to nine different
 * businesses across three cities in one test run.
 *
 * A mirror knows a company's name, number and incorporation date and nothing
 * else about it: no phone of its own, no email of the business's, no website to
 * redesign. So they are refused wherever a contact or a website is decided —
 * not merely deprioritised, because deprioritising is what let them win.
 */
const REGISTRY_MIRROR_HOST =
  /(b2bhint|opencorpdata|clarity-project|companyatlas|newcohunter|opengovuk|doogal|endole|companycheck|companydigger|companiesintheuk|bizdb|ukbusinessdirectory|duedil|globaldatabase|opencorporates|company-information\.service\.gov|find-and-update|bizapedia|northdata|zoominfo|apollo\.io|dnb\.com|bloomberg|pitchbook|tracxn|creditsafe|experian|owler|datanyze|lead411|hunter\.io|rocketreach|signalhire|apollo|leadiq|mattermark|growjo|craft\.co)/i;

/** True for a host that can only ever tell us what the register already said. */
export function isDirectoryHost(host: string): boolean {
  const h = (host ?? "").toLowerCase();
  if (!h) return true;
  return DIRECTORY_HOST.test(h) || REGISTRY_MIRROR_HOST.test(h);
}

/** Words that say nothing about which business a domain belongs to. */
const GENERIC_NAME_WORD =
  /^(ltd|limited|llc|inc|plc|co|com|the|and|of|for|services?|service|group|holdings|company|uk|gb|usa|us|website|site|online|official|home|contact|about)$/;

/**
 * The business's own website inside a blob of search results, or "".
 *
 * Used to answer one question honestly: does this business have a website at
 * all? A directory listing or a Facebook page is not a website the owner can
 * fix, so those are refused, and a domain has to share a real word with the
 * business name — "thompsonheating.co.uk" for "Thompson Heating Ltd", not some
 * other firm's site that appeared in the same search. When in doubt it returns
 * nothing: the caller uses this to *exclude* a lead from a "no website" list, so
 * silence keeps the list honest.
 */
export function officialWebsiteFrom(text: string, businessName: string): string {
  const nameWords = distinctiveNameWords(businessName);
  if (!nameWords.length || !text) return "";

  const candidates: string[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s)\]"'<>]+/gi)) {
    candidates.push(m[0].replace(/[.,;:)\]"']+$/, ""));
  }

  let best: { url: string; hits: number } | null = null;
  for (const url of candidates) {
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (isDirectoryHost(host)) continue;
    const hits = hostNameHits(host, nameWords);
    if (hits === 0) continue;
    // More of the name on the domain means less chance of a namesake.
    if (!best || hits > best.hits) best = { url, hits };
  }
  return best?.url ?? "";
}

/**
 * The same check against every person an official record named.
 *
 * A register company often has two or three directors, and the one who keeps a
 * profile is frequently not the first one listed. Asking about all of them in a
 * single lookup costs one search instead of one per director, and it stays a
 * *check*: the person returned still has to be one of the names on the record,
 * so widening the candidate set cannot let a stranger through.
 */
export function personNameMatchesAny(candidateName: string, knownNames: string[]): boolean {
  return (knownNames ?? []).some((n) => personNameMatches(candidateName, n));
}

/**
 * Short forms whose formal name is not merely a longer version of them.
 *
 * Most English diminutives *are* prefixes — Chris/Christopher, Dan/Daniel,
 * Greg/Gregory, Alex/Alexander, Ed/Edward, Jon/Jonathan, Sam/Samuel — and the
 * prefix rule below catches those. Tom/Thomas is the case that proved a prefix
 * rule is not enough ("thomas" does not start with "tom"), and it is far too
 * common a name to drop.
 *
 * Deliberately a short, auditable table of everyday spellings rather than an
 * attempt at completeness: a pair missing from it costs one lookup, which is the
 * safe direction. Both names must be listed to match, and the surname is checked
 * separately, so an entry here can only ever rename somebody who already has the
 * right surname.
 */
const SHORT_FORMS: Record<string, string[]> = {
  tom: ["thomas"], tommy: ["thomas"],
  bill: ["william"], billy: ["william"], will: ["william"],
  bob: ["robert"], rob: ["robert"],
  jim: ["james"], jimmy: ["james"],
  jack: ["john"], johnny: ["john"],
  nick: ["nicholas"],
  jenny: ["jennifer"], jen: ["jennifer"],
  kate: ["katherine", "kathryn", "catherine"], katie: ["katherine", "kathryn"],
  liz: ["elizabeth"], beth: ["elizabeth"], betty: ["elizabeth"],
  sue: ["susan"], peg: ["margaret"], maggie: ["margaret"],
  harry: ["henry"], tony: ["anthony"], joe: ["joseph"], rick: ["richard"],
  pat: ["patrick", "patricia"], mick: ["michael"],
};

/**
 * Is one first name the same person's name as another, allowing for the short
 * form its holder actually goes by?
 *
 * The register writes the name on the passport; a profile carries the name the
 * person chose. "Thomas Pritchard" on the record is "Tom Pritchard" on LinkedIn,
 * and a check that only accepts identical first names silently loses that person
 * — the exact failure this lookup exists to avoid.
 *
 * Both rules are bounded so a nickname can only ever rename somebody whose
 * surname already matches: the prefix rule needs at least three characters (so
 * "Jo" and "Al", as likely to be a different person as a nickname, are not waved
 * through), and the table above is a fixed list.
 */
function firstNameAgrees(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 3 && long.startsWith(short)) return true;
  return (SHORT_FORMS[a] ?? []).includes(b) || (SHORT_FORMS[b] ?? []).includes(a);
}

/**
 * Does a profile name match a name already known from an official record?
 *
 * The register gives an exact name ("GREENSHAIELDS, Damian Marcus") and a
 * profile gives however that person writes themselves ("Damian Greenshields"),
 * so the comparison has to survive the differences that are not identity:
 * middle names dropped, initials, order flipped, accents kept or lost. The check
 * that survives all of them is the first name and the last name together. A
 * middle name is allowed to be missing and never required, and the first name is
 * allowed its short form (see `firstNameAgrees`) — the register writes the name
 * on a passport, the profile carries the name the person goes by. Nothing else
 * is allowed to differ.
 *
 * Strict on purpose: this decides whether a stranger's profile gets attached to
 * a lead the user is about to write to, so a missed match costs one lookup while
 * a wrong match sends a message to someone who has never heard of them.
 */
export function personNameMatches(candidateName: string, knownName: string): boolean {
  const words = (value: string): string[] =>
    (value ?? "")
      // Accents are dropped rather than compared: the register and a profile
      // disagree about them constantly ("Jose" / "José"), and that is a
      // difference in a keyboard, not in a person.
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .filter((w) => w.length >= 2 && !GENERIC_NAME_WORD.test(w));
  const known = words(knownName);
  const candidate = words(candidateName);
  if (!known.length || !candidate.length) return false;
  // A mononym has nothing to compare but itself.
  if (known.length === 1) return candidate.includes(known[0]);
  const first = known[0];
  const last = known[known.length - 1];
  if (first === last) return candidate.includes(first);
  // First name and surname together, the first name allowed its short form.
  return candidate.includes(last) && candidate.some((w) => firstNameAgrees(w, first));
}

/**
 * The words in a business name that actually identify it.
 *
 * "Ltd", "Services" and "The" appear in thousands of names, so a domain has to
 * share a real word to count as this business's: "thompsonheating.co.uk" for
 * "Thompson Heating Ltd".
 */
export function distinctiveNameWords(businessName: string): string[] {
  return (businessName ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !GENERIC_NAME_WORD.test(w));
}

/**
 * How much of the name a host carries — "decroofing.co.uk" carries two words.
 *
 * This exists to rank search results and to answer "does this business have a
 * website?" — it is deliberately NOT an ownership test any more, and should not
 * be turned back into one. Name agreement cannot decide whose page a domain is:
 * measured across 24 register leads, a domain carrying both "roofing" and
 * "Yorkshire" was matched to "Dec Roofing (Yorkshire) Limited" while belonging
 * to "Yorkshire Roofing" — a business this product lists separately. Two words,
 * and still the wrong company's phone number. A domain is a bag of trade and
 * place words; a handle or an email is an identifier its owner chose.
 */
function hostNameHits(host: string, words: string[]): number {
  const label = (host ?? "").replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9]/g, "");
  return words.filter((w) => label.includes(w)).length;
}

// ---------- finding a person ----------

/** X paths that are the site's own furniture, never somebody's handle. */
const RESERVED_X = new Set([
  "home", "explore", "i", "intent", "share", "search", "hashtag", "settings",
  "messages", "notifications", "compose", "login", "signup", "tos", "privacy",
]);

/**
 * A person's own profile on either network, or nothing.
 *
 * Both are *personal* paths — `linkedin.com/in/…` and `x.com/<handle>` — because
 * a company page on either network is not the human being looked for. The
 * reserved paths are X's own navigation, which a result URL can land on and
 * which would otherwise be handed over as a person's handle.
 */
export function personProfileFromUrl(url: string): { linkedin: string; x: string } {
  const linkedin = (url ?? "").match(/linkedin\.com\/(in\/[a-zA-Z0-9\-_.%]{2,60})/i);
  if (linkedin) return { linkedin: linkedin[1], x: "" };
  const m = (url ?? "").match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,15})(?:[/?#]|$)/i);
  if (m && !RESERVED_X.has(m[1].toLowerCase())) return { linkedin: "", x: m[1] };
  return { linkedin: "", x: "" };
}

/**
 * The search that finds a person.
 *
 * Two different questions wear the same words. Without a name it is "who runs
 * this company?", which can only answer with whoever ranks for it. With a name
 * it is "where is this specific person?" — and that name comes from a public
 * record, so the result can be *checked* against it rather than trusted.
 */
export function peopleQuery(
  businessName: string,
  location: string,
  person?: string | string[]
): { query: string; objective: string } {
  const who = (Array.isArray(person) ? person : [person ?? ""])
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  const biz = (businessName ?? "").trim();
  const where = (location ?? "").trim();
  if (who.length) {
    // Every name is quoted so the retriever sees names rather than phrases, and
    // a single name stays a single quoted term — the shape the live endpoint was
    // checked with.
    const names = who.map((n) => `"${n}"`).join(" OR ");
    return {
      query: `category:people ${names} ${biz}${where ? ` ${where}` : ""} linkedin twitter`,
      objective:
        `The personal LinkedIn or X (Twitter) profile of ${who.join(" or ")}, ` +
        `${who.length > 1 ? "directors" : "a director"} of ${biz}` +
        `${where ? `, ${where}` : ""}. Their own profile, not the company's account and not a ` +
        `different person with a similar name.`,
    };
  }
  return {      query: `category:people founder or owner of ${biz}${where ? ` ${where}` : ""}`,
      objective:
        `LinkedIn profile of the owner, founder or senior decision maker at ${biz}` +
        `${where ? `, in ${where}` : ""}. Exclude employees and people at unrelated companies ` +
        `with a similar name.`,
  };
}

// ---------- reading a web-search reply ----------

/** One result out of a search reply: where it came from and what it says. */
export interface SearchResult {
  url: string;
  host: string;
  title: string;
  body: string;
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Splits a search reply into its individual results.
 *
 * A reply is a list of blocks — "Title:", "URL:", "Published:", then the page's
 * text — separated by a horizontal rule. Splitting it apart is what makes
 * attribution possible at all: the code this replaces scanned the *whole* reply
 * for the first email, so a directory page sitting between two real results
 * decided the answer for whichever business was being looked up.
 */
export function splitSearchResults(text: string): SearchResult[] {
  if (!text) return [];
  return text
    .split(/\n\s*-{3,}\s*\n/)
    .map((block) => {
      const url = (block.match(/^URL:\s*(\S+)/m) ?? [])[1] ?? "";
      const title = (block.match(/^Title:\s*(.+)$/m) ?? [])[1]?.trim() ?? "";
      return { url, host: hostOfUrl(url), title, body: block };
    })
    .filter((r) => r.host);
}

/** Social platforms, where a profile's *handle* is the identity, not the host. */
const SOCIAL_HOST =
  /(instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|pinterest\.com)$/i;

/**
 * Is this a social profile for the business?
 *
 * The host says nothing here (every profile lives on instagram.com), so the
 * handle is matched against the name instead — "roofingleeds" carries the word
 * "roofing" for a business called "Dec Roofing". A profile that matches is the
 * business speaking for itself, which is exactly what an offline prospect's
 * reachable contact usually is.
 */
export function socialProfileMatches(host: string, url: string, businessName: string): boolean {
  if (!SOCIAL_HOST.test(host ?? "")) return false;
  const words = distinctiveNameWords(businessName);
  if (!words.length) return false;
  let handle = "";
  try {
    handle = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return false;
  }
  const flat = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (flat.length < 2) return false;
  return words.some((w) => flat.includes(w));
}

/** Undo the common ways sites hide emails from scrapers: entities and [at]/[dot]. */
function deobfuscate(text: string): string {
  return text
    .replace(/&#0?64;|&commat;/gi, "@")
    .replace(/&#0?46;|&period;/gi, ".")
    .replace(/\s*[[(]\s*(?:at|@)\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*(?:dot|\.)\s*[\])]\s*/gi, ".");
}

const JUNK_EMAIL =
  /example\.|sentry|wixpress|your-email|email@|no-?reply|donotreply|godaddy|\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/;

/**
 * Strips URL-encoded padding off the front of an address found in markup.
 *
 * Sites write `mailto:%20info@example.co.uk` when a space crept into the link,
 * and the matcher reads "%20info" as the local part — handing the user an
 * address that bounces where a mailable one was sitting right next to it. The
 * padding is the author's typo, not part of the address.
 */
function unpadEmail(raw: string): string {
  let value = raw;
  while (/^%[0-9a-f]{2}/i.test(value)) value = value.slice(3);
  return value;
}

/**
 * All plausible emails in a page, best first. When `siteHost` is given,
 * addresses on the business's own domain outrank gmail/hotmail catch-alls.
 */
export function extractEmails(html: string, siteHost?: string): string[] {
  const found = deobfuscate(html).match(EMAIL_RE) ?? [];
  const clean = new Set<string>();
  for (const raw of found) {
    const e = unpadEmail(raw).toLowerCase();
    // Anything still carrying a percent-escape came out of a URL query string,
    // not an address someone typed.
    if (!e || e.includes("%") || JUNK_EMAIL.test(e)) continue;
    clean.add(e);
  }
  const list = [...clean];
  if (siteHost) {
    const root = siteHost.replace(/^www\./, "");
    list.sort((a, b) => Number(b.endsWith(root)) - Number(a.endsWith(root)));
  }
  return list;
}

/**
 * Picks the number to hand the user out of a web-search "Phone" field.
 *
 * That field is a comma-separated list that mixes real numbers with whatever
 * else the page showed — timestamps, archival dates, a second number written
 * without its trunk prefix:
 *
 *   "0161-230-7651, 021-10-05, 07792-703-612, 161 230 7651, 2007-2025, 2021-08-13"
 *   "7467224271"
 *
 * Taking only the first entry hands the user a number that dials nobody when
 * that entry happens to be junk, and gives up on a list that contains a good
 * number further along. So scan the whole list for the first entry a person
 * could actually dial.
 */
export function pickPhone(raw: string, opts: { uk?: boolean } = {}): string {
  for (const entry of (raw ?? "").split(/[,;/]/)) {
    const value = (opts.uk ? restoreTrunkPrefix(entry) : entry).trim();
    if (isPlausiblePhone(value, opts) && !isDateLike(value)) return value;
  }
  return "";
}

/** Platform fingerprints, checked in order — first match wins. */
const STACK_SIGNATURES: [string, RegExp][] = [
  ["WordPress", /wp-content\/|wp-includes\/|content=["']WordPress/i],
  ["Shopify", /cdn\.shopify\.com|\.myshopify\.com|Shopify\.theme/i],
  ["Wix", /wixstatic\.com|parastorage\.com|X-Wix-/i],
  ["Squarespace", /squarespace\.com|squarespace-cdn\.com/i],
  ["Webflow", /website-files\.com|data-wf-page/i],
  ["GoDaddy Builder", /wsimg\.com|websitebuilder\.godaddy/i],
  ["Weebly", /weebly\.com\/uploads|_weebly/i],
  ["Joomla", /content=["']Joomla/i],
  ["Drupal", /Drupal\.settings|content=["']Drupal/i],
  ["Blogger", /content=["']blogger["']/i],
];

const PIXEL_SIGNATURES: [string, RegExp][] = [
  ["Facebook Pixel", /connect\.facebook\.net|fbq\s*\(/i],
  ["Google Analytics", /googletagmanager\.com|google-analytics\.com|gtag\s*\(/i],
  ["Google Ads tag", /googleadservices\.com|googleads\.g\.doubleclick/i],
  ["TikTok Pixel", /analytics\.tiktok\.com/i],
];

export interface TechProfile {
  /** Detected platform, or undefined when unrecognized/custom. */
  stack?: string;
  /** Marketing/tracking tags present — a "this business invests in marketing" signal. */
  pixels: string[];
}

/**
 * Reads what a site is built with and which marketing tags it runs — pure.
 *
 * The `stack` names produced here are also what lib/siteaudit.ts keys on to
 * avoid false positives on client-rendered builders, so keep them in sync.
 */
export function detectTech(html: string): TechProfile {
  if (!html) return { pixels: [] };
  const stack = STACK_SIGNATURES.find(([, re]) => re.test(html))?.[0];
  const pixels = PIXEL_SIGNATURES.filter(([, re]) => re.test(html)).map(([name]) => name);
  return { stack, pixels };
}

// ---------- structured data a site publishes about itself ----------

/**
 * What a business publishes about itself in schema.org markup.
 *
 * This is the most trustworthy contact data on a website: the owner typed it
 * into the page's structured fields for Google, so the phone number is the one
 * they want called — no guessing from a footer full of unrelated digits. Sites
 * that publish it at all usually publish it on every page.
 */
export interface LocalBusinessData {
  name: string;
  phone: string;
  email: string;
  address: string;
  /** Same-as links (Instagram, Facebook, LinkedIn) the business declares. */
  socials: string[];
}

/** Types that describe a business the user could sell a website to. */
const BUSINESS_TYPE = /(business|organisation|organization|store|restaurant|foodestablishment|professionalservice|corporation|establishment|agency|contractor|plumber|electrician|roofer|locksmith|painter|hvac|salon|dentist|clinic|lawyer|attorney|realestateagent|travelagency|autorepair|sports|entertainment|financialservice)/i;
/** Types that are about the page, not the business. */
const NOT_BUSINESS_TYPE = /^(website|webpage|breadcrumblist|itemlist|faqpage|imageobject|product|offer|service|person|searchaction|sitenavigationelement|postaladdress|geoordinates|interactioncounter|aggregaterating|review|creativework|article|blog)$/i;

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return asText(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return asText(obj["@value"] ?? obj.name ?? obj.text ?? "");
  }
  return "";
}

function addressText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  const list = Array.isArray(value) ? value : [value];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const parts = [
      a.streetAddress,
      a.addressLocality,
      a.addressRegion,
      a.postalCode,
      a.addressCountry,
    ]
      .map(asText)
      .filter(Boolean);
    if (parts.length) return [...new Set(parts)].join(", ");
  }
  return "";
}

/**
 * The business block from a page's JSON-LD, merged across the objects a site
 * publishes (many sites split name/telephone/address across `@graph` entries).
 * Returns empty strings when the page publishes nothing usable.
 */
export function extractLocalBusiness(html: string): LocalBusinessData {
  const out: LocalBusinessData = { name: "", phone: "", email: "", address: "", socials: [] };
  if (!html) return out;

  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];
  const objects: Record<string, unknown>[] = [];
  const walk = (node: unknown, depth = 0) => {
    if (depth > 6 || !node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    objects.push(obj);
    if (obj["@graph"]) walk(obj["@graph"], depth + 1);
  };
  for (const block of blocks.slice(0, 20)) {
    try {
      walk(JSON.parse(block[1]));
    } catch {
      // Malformed or templated JSON-LD — the next block may still be fine.
    }
  }

  for (const obj of objects) {
    const types = (Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]])
      .map(asText)
      .filter(Boolean);
    if (!types.some((t) => BUSINESS_TYPE.test(t) && !NOT_BUSINESS_TYPE.test(t))) continue;
    if (!out.name && asText(obj.name)) out.name = asText(obj.name);
    if (!out.phone && asText(obj.telephone)) out.phone = asText(obj.telephone);
    if (!out.email) {
      const email = asText(obj.email).replace(/^mailto:/i, "");
      if (email) out.email = email;
    }
    if (!out.address) out.address = addressText(obj.address);
    const sameAs = obj.sameAs ?? obj.url;
    for (const link of Array.isArray(sameAs) ? sameAs : [sameAs]) {
      const url = asText(link);
      if (url && !out.socials.includes(url)) out.socials.push(url);
    }
  }
  return out;
}

// ---------- the person behind the business ----------

/**
 * The owner's name, when the site states it next to a role.
 *
 * Deliberately strict. A wrong name in a cold opener ("Hi Sarah") costs more
 * than no name at all, so this only reports a two-word human name that sits
 * beside an ownership role, and refuses anything that looks like the business
 * itself, a job advert, or a marketing headline.
 */
export interface OwnerMention {
  name: string;
  /** The role as the site wrote it, so the user can quote it. */
  role: string;
}

/** Roles that mean "this person can buy", best first. */
const OWNER_ROLES: [RegExp, number, string][] = [
  [/\b(?:co[- ]?founder|founder)\b/i, 5, "founder"],
  [/\b(?:co[- ]?owner|owner|proprietor|proprietress)\b/i, 5, "owner"],
  [/\bmanaging director\b/i, 4, "managing director"],
  [/\bdirector\b/i, 3, "director"],
  [/\bprincipal\b/i, 3, "principal"],
  [/\bCEO\b/i, 3, "CEO"],
  [/\bmanaging partner\b/i, 3, "managing partner"],
];

/** Words that look like a name but never are. */
const NOT_A_NAME = new Set(
  [
    "our", "the", "meet", "contact", "about", "team", "us", "we", "company", "business",
    "services", "service", "solutions", "ltd", "limited", "llc", "inc", "plc", "group",
    "holdings", "plumbing", "roofing", "electrical", "heating", "building", "construction",
    "finance", "funding", "occupier", "operator", "manager", "management", "marketing",
    "sales", "support", "office", "head", "chief", "executive", "director", "directors",
    "founder", "founders", "owner", "owners", "staff", "people", "family", "call", "email",
    "phone", "get", "more", "read", "find", "home", "page", "site", "online", "local",
    "free", "quote", "quotes", "reviews", "google", "facebook", "instagram", "linkedin",
    "driven", "established", "welcome", "why", "what", "how", "all", "your",
    "their", "his", "her", "new", "old", "best", "top", "trusted", "award", "winning",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  ].map((w) => w.toLowerCase())
);
/** Business words that end a company name — "Acme Plumbing Ltd" is not a person. */
const COMPANY_WORD = /\b(ltd|limited|llc|inc|plc|co|corp|group|holdings|partners|associates|solutions|services|systems|specialists|contractors|contracting)\b/i;

function isHumanName(raw: string): boolean {
  const name = raw.trim().replace(/\s+/g, " ");
  const parts = name.split(" ");
  if (parts.length < 2 || parts.length > 3) return false;
  if (COMPANY_WORD.test(name)) return false;
  if (/\d/.test(name)) return false;
  // Each word: a capitalised word of letters (O'Brien, Anne-Marie) or an
  // initial, which is how "John A. Smith" is written.
  return parts.every(
    (p) =>
      (/^[A-Z][\p{L}'’-]{1,19}$/u.test(p) || /^[A-Z]\.$/u.test(p)) &&
      !NOT_A_NAME.has(p.replace(/\.$/, "").toLowerCase())
  );
}

/**
 * Scans the text around each ownership role for a human name. Reads a tight
 * window — an address, a job advert or a headline near the word "owner" is not
 * a person — and prefers the strongest role (founder/owner over director).
 */
export function extractOwnerName(text: string): OwnerMention | null {
  if (!text) return null;
  // Tags and entities would otherwise split names and glue words together.
  const plain = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");

  let top: { mention: OwnerMention; score: number } | null = null;

  for (const [roleRe, roleScore, roleLabel] of OWNER_ROLES) {
    const re = new RegExp(roleRe.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain))) {
      // A tight window either side of the role word: "owner" in a headline, an
      // address or a job ad must not borrow a name from somewhere else. The
      // window is stretched to word boundaries — a name cut in half
      // ("Paul Sm") is a person who does not exist.
      let from = Math.max(0, m.index - 48);
      let to = Math.min(plain.length, m.index + m[0].length + 28);
      while (from > 0 && /\S/.test(plain[from - 1])) from--;
      while (to < plain.length && /\S/.test(plain[to - 1])) to++;
      const window = plain.slice(from, to);
      const roleAt = m.index - from;
      // Words with positions, so every overlapping pair is considered —
      // "Owner Rachel Green" must find "Rachel Green", not stop at "Owner
      // Rachel" just because the words touch the role.
      const words = [...window.matchAll(/[\p{Lu}][\p{L}'’.-]+|\S+/gu)].map((w) => ({
        raw: w[0],
        at: w.index ?? 0,
      }));
      // A sentence's full stop is punctuation, not part of the name; an
      // initial's full stop is part of it. Punctuation-only tokens are kept in
      // the list so a name never bridges across a full stop into the next
      // sentence ("Jane Doe. Accounts" is one person, not two joined).
      const clean = (t: string) => (/^[A-Z]\.$/u.test(t) ? t : t.replace(/[.,;:!?]+$/u, ""));

      for (let i = 0; i < words.length; i++) {
        // Three-word names are initials, not optimism: "John A. Smith" is a
        // name, "Jane Doe Accounts" is two names glued to a heading.
        const maxLen = /^[A-Z]\.$/u.test(clean(words[i + 1]?.raw ?? "")) ? 3 : 2;
        for (let len = maxLen; len >= 2; len--) {
          if (i + len > words.length) continue;
          const parts = words.slice(i, i + len).map((w) => clean(w.raw));
          if (parts.some((p) => !p)) continue;
          const name = parts.join(" ");
          if (!isHumanName(name)) continue;
          const distance = Math.abs(words[i].at - roleAt);
          const score = roleScore * 100 - distance;
          if (!top || score > top.score) top = { mention: { name, role: roleLabel }, score };
          break; // the longest name that reads as human wins for this spot
        }
      }
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  return top?.mention ?? null;
}
