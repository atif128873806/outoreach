/**
 * Companies House — the official UK register of companies.
 *
 * Why this source exists: the register publishes the one thing the open web
 * cannot be asked for reliably — *when a business came into existence*. A
 * company incorporated weeks ago has usually not built a website yet, which is
 * exactly the prospect this product sells to, and the register states it as a
 * fact rather than as a guess. It also names the SIC activity, so "roofer" is
 * answered by the register's own classification instead of by keyword luck.
 *
 * What it does NOT publish is a website, a phone number or an email address —
 * so it can only ever serve the "No website" search. That is why it is declared
 * `gives.website: false`: the route then performs its own lookup per business
 * and drops any that turn out to have a site, rather than mis-selling a
 * redesign of nothing. The registry refuses to let such a source near a filter
 * that promises an audit.
 *
 * The contract below was read off Companies House's own OpenAPI specification
 * rather than recalled:
 *
 *   GET https://api.company-information.service.gov.uk/advanced-search/companies
 *   auth      HTTP Basic — the API key as the username, empty password. Called
 *             without one the service answers 401 "Empty Authorization header",
 *             and a wrong key is rejected with the same status. (The spec's
 *             `api_key` header definition is stale; the service is Basic.)
 *   filters   sic_codes, company_name_includes, company_status, company_type,
 *             location, incorporated_from, incorporated_to, size (1..5000),
 *             start_index
 *   response  { items: [...], hits: "12", kind, top_hit, etag }, each item with
 *             company_name, company_number, company_status, company_type,
 *             company_subtype, date_of_creation, date_of_cessation, sic_codes
 *             and registered_office_address { address_line_1, address_line_2,
 *             locality, region, postal_code, country }.
 *
 * Unlike the web search source, this endpoint really can page (start_index with
 * size up to 5000) — but one request already returns far more records than a
 * search can use, so this asks once and does not page.
 */

// The only import is a type, so it disappears at runtime: this module has no
// runtime dependencies and is unit-testable on its own, the same reason
// lib/crawl.ts and lib/sources/meta.ts are kept dependency-free.
import type { Lead } from "./leads";

export const CH_API = "https://api.company-information.service.gov.uk";

/** How far back "recently incorporated" reaches. See RECENT_MONTHS below. */
export const RECENT_MONTHS = 24;

/**
 * The company forms a trading local business actually uses. A plc, a charity or
 * a member of a group is not the prospect this product sells to, and the
 * register is full of them — so the search is narrowed to these two forms.
 */
export const COMPANY_TYPES = ["ltd", "llp"] as const;

// ---------- the register's own classification ----------

/**
 * Official SIC descriptions, quoted from Companies House's condensed list
 * (resources.companieshouse.gov.uk/sic). Only the codes this file can return
 * are listed, so a lead's notes can say what the register says the business
 * does — not what a keyword guessed.
 */
const SIC_LABEL: Record<string, string> = {
  "41100": "development of building projects",
  "41201": "construction of commercial buildings",
  "41202": "construction of domestic buildings",
  "43110": "demolition",
  "43120": "site preparation",
  "43210": "electrical installation",
  "43220": "plumbing, heat and air-conditioning installation",
  "43290": "other construction installation",
  "43310": "plastering",
  "43320": "joinery installation",
  "43330": "floor and wall covering",
  "43341": "painting",
  "43342": "glazing",
  "43390": "other building completion and finishing",
  "43910": "roofing activities",
  "43991": "scaffold erection",
  "43999": "other specialised construction activities",
  "45111": "sale of new cars and light motor vehicles",
  "45112": "sale of used cars and light motor vehicles",
  "45200": "maintenance and repair of motor vehicles",
  "45400": "sale, maintenance and repair of motorcycles",
  "47220": "retail sale of meat and meat products",
  "47240": "retail sale of bread, cakes and confectionery",
  "47760": "retail sale of flowers, plants and pet supplies",
  "49320": "taxi operation",
  "49420": "removal services",
  "55100": "hotels and similar accommodation",
  "56101": "licenced restaurants",
  "56102": "unlicenced restaurants and cafes",
  "56103": "take-away food shops and mobile food stands",
  "56210": "event catering activities",
  "56302": "public houses and bars",
  "68209": "letting and operating of own or leased real estate",
  "68310": "real estate agencies",
  "69102": "solicitors",
  "69201": "accounting and auditing activities",
  "69202": "bookkeeping activities",
  "71111": "architectural activities",
  "73110": "advertising agencies",
  "74201": "portrait photographic activities",
  "74202": "other specialist photography",
  "75000": "veterinary activities",
  "80100": "private security activities",
  "80200": "security systems service activities",
  "81210": "general cleaning of buildings",
  "81221": "window cleaning services",
  "81222": "specialised cleaning services",
  "81229": "other building and industrial cleaning activities",
  "81291": "disinfecting and exterminating services",
  "81299": "other cleaning services",
  "81300": "landscape service activities",
  "85530": "driving school activities",
  "86230": "dental practice activities",
  "86900": "other human health activities",
  "87300": "residential care activities for the elderly and disabled",
  "87900": "other residential care activities",
  "88910": "child day-care activities",
  "93130": "fitness facilities",
  "96010": "washing and dry-cleaning of textiles",
  "96020": "hairdressing and other beauty treatment",
  "96030": "funeral and related activities",
  "96040": "physical well-being activities",
};

/**
 * The niche the user typed, in the register's language. Only reviewed entries
 * appear here: a wrong code is worse than no code, because it returns a
 * confident list of the wrong trade. An unmapped niche falls back to matching
 * the words in the company's registered name.
 */
const SIC_BY_NICHE: Record<string, string[]> = {
  // Construction and the trades
  roofer: ["43910"], roofers: ["43910"], roofing: ["43910"],
  "roof repair": ["43910"], "flat roofing": ["43910"],
  scaffolder: ["43991"], scaffolders: ["43991"], scaffolding: ["43991"],
  builder: ["41202", "41201", "41100"], builders: ["41202", "41201", "41100"],
  construction: ["41202", "41201", "41100"], "building contractor": ["41202", "41201"],
  "building company": ["41202", "41201"], "general builder": ["41202", "41100"],
  plumber: ["43220"], plumbers: ["43220"], plumbing: ["43220"],
  "heating engineer": ["43220"], "gas engineer": ["43220"],
  electrician: ["43210"], electricians: ["43210"], electrical: ["43210"],
  carpenter: ["43320"], carpenters: ["43320"],  joiner: ["43320"], joiners: ["43320"], joinery: ["43320"],
  // 43330 is the register's own answer for tilers — of 50 active companies with
  // "tiling" in the name, 18 filed 43330 ("floor and wall covering").
  tiler: ["43330"], tilers: ["43330"], tiling: ["43330"],
  plasterer: ["43310"], plasterers: ["43310"], plastering: ["43310"],
  painter: ["43341"], painters: ["43341"], decorator: ["43341"], decorators: ["43341"],
  decorating: ["43341"], "painter and decorator": ["43341"], painting: ["43341"],
  glazier: ["43342"], glaziers: ["43342"], glazing: ["43342"],
  flooring: ["43330"], "floor fitter": ["43330"],
  handyman: ["43390", "43999"], handymen: ["43390", "43999"],
  demolition: ["43110"],

  // Cleaning, grounds, security
  // 81222 is included on the strength of the register itself: of 50 active
  // companies with "cleaning" in the name, 16 filed 81210, 12 filed 81222 and 7
  // filed 81299 — leaving out the middle one drops a fifth of the trade.
  cleaner: ["81210", "81222", "81229", "81299"], cleaners: ["81210", "81222", "81229", "81299"],
  cleaning: ["81210", "81222", "81229", "81299"], "office cleaning": ["81210"], "cleaning company": ["81210"],
  "window cleaner": ["81221"], "window cleaners": ["81221"], "window cleaning": ["81221"],
  // Pest control has no code of its own in the SIC list, and the register does
  // not spread it around: 25 of 50 active "pest control" companies filed 81291
  // (disinfecting and exterminating services), the next code having 9.
  "pest control": ["81291"], pest: ["81291"], "pest control company": ["81291"],
  gardener: ["81300"], gardeners: ["81300"], gardening: ["81300"],
  landscaper: ["81300"], landscapers: ["81300"], landscaping: ["81300"],
  security: ["80100", "80200"], "security company": ["80100"], "security guard": ["80100"],

  // Food and accommodation
  restaurant: ["56101", "56102"], restaurants: ["56101", "56102"],
  cafe: ["56102"], cafes: ["56102"], "coffee shop": ["56102"], "coffee shops": ["56102"],
  takeaway: ["56103"], takeaways: ["56103"], "take-away": ["56103"], "fish and chips": ["56103"],
  catering: ["56210"], caterer: ["56210"], caterers: ["56210"],
  pub: ["56302"], pubs: ["56302"], bar: ["56302"], bars: ["56302"],
  hotel: ["55100"], hotels: ["55100"], "guest house": ["55100"], "bed and breakfast": ["55100"],

  // Beauty and wellbeing
  hairdresser: ["96020"], hairdressers: ["96020"], hairdressing: ["96020"],
  barber: ["96020"], barbers: ["96020"], "hair salon": ["96020"], "beauty salon": ["96020"],
  beautician: ["96020"], salon: ["96020"],
  massage: ["96040"], masseuse: ["96040"], "physical therapy": ["96040"],
  gym: ["93130"], gyms: ["93130"], fitness: ["93130"], "personal trainer": ["93130"],

  // Health and care
  dentist: ["86230"], dentists: ["86230"], dental: ["86230"], "dental practice": ["86230"],
  vet: ["75000"], vets: ["75000"], veterinary: ["75000"],
  physiotherapist: ["86900"], physiotherapy: ["86900"],
  "care home": ["87300", "87900"], "nursing home": ["87300"],
  nursery: ["88910"], nurseries: ["88910"], childcare: ["88910"],

  // Vehicles
  mechanic: ["45200"], mechanics: ["45200"], garage: ["45200"],
  "car garage": ["45200"], "car repair": ["45200"],
  "car dealer": ["45112", "45111"], "car dealers": ["45112", "45111"],
  "used cars": ["45112"], "car sales": ["45112"],
  motorcycles: ["45400"],

  // Property, professional services, photography
  "estate agent": ["68310"], "estate agents": ["68310"],
  "letting agent": ["68310", "68209"], lettings: ["68310", "68209"],
  "property management": ["68209"],
  accountant: ["69201", "69202"], accountants: ["69201", "69202"],
  accounting: ["69201"], bookkeeper: ["69202"], bookkeeping: ["69202"],
  solicitor: ["69102"], solicitors: ["69102"], "law firm": ["69102"], conveyancing: ["69102"],
  architect: ["71111"], architects: ["71111"],
  photographer: ["74201", "74202"], photographers: ["74201", "74202"], photography: ["74201", "74202"],
  "advertising agency": ["73110"], "marketing agency": ["73110"],

  // Moving and driving
  taxi: ["49320"], taxis: ["49320"], minicab: ["49320"],
  removals: ["49420"], "removal company": ["49420"],
  "driving school": ["85530"], "driving instructor": ["85530"],

  // Shops and day-to-day services
  butcher: ["47220"], butchers: ["47220"],
  bakery: ["47240"], bakeries: ["47240"],
  florist: ["47760"], florists: ["47760"], "pet shop": ["47760"],
  "dry cleaner": ["96010"], "dry cleaners": ["96010"], laundry: ["96010"],
  "funeral director": ["96030"], "funeral directors": ["96030"],

  // Deliberately absent, with the evidence, so they are not "added" later from
  // intuition:
  //
  //  * Locksmiths — the register has no consensus for them. Of 50 active
  //    "locksmith" companies: 96090 (other service activities) 9, 80200
  //    (security systems service) 8, 74909 5, 80100 4. Nothing above a fifth, so
  //    any code chosen here would exclude most of the trade while looking
  //    confident. The name fallback already finds them.
  //  * Tree surgeons — 81300 (landscape service) 8 of 50, with the rest spread
  //    across forestry codes. Same problem, same answer.
  //
  // Both still work as searches; they fall back to matching the registered name,
  // which is exactly what that fallback is for.
};

/** Words too generic to pin a registered name to a trade. */
const GENERIC_WORD = new Set([
  "the", "and", "of", "for", "a", "an", "my", "your", "best", "top",
  "company", "companies", "services", "service", "business", "businesses",
  "shop", "shops", "store", "stores", "local", "ltd", "limited", "llp", "uk",
]);

function normalizeNiche(niche: string): string {
  return (niche ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s&'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The SIC codes for a niche, or an empty list when the trade isn't one this
 * file has reviewed. Matching is deliberately conservative: the whole phrase
 * first, then the singular, then the longest reviewed phrase appearing as whole
 * words inside the niche ("commercial roofing" → roofing).
 */
export function sicCodesFor(niche: string): string[] {
  const n = normalizeNiche(niche);
  if (!n) return [];
  if (SIC_BY_NICHE[n]) return [...SIC_BY_NICHE[n]];
  const singular = n.replace(/s$/, "");
  if (singular !== n && SIC_BY_NICHE[singular]) return [...SIC_BY_NICHE[singular]];

  // Or a reviewed trade named inside a longer phrase: "commercial roofing",
  // "emergency plumbing", "window cleaning company". The earliest match wins,
  // because that is the trade the phrase leads with — "window cleaning" beats
  // "cleaning company" in "window cleaning company", which is the whole point
  // of not simply taking the longest key.
  const padded = ` ${n} `;
  let best: { at: number; len: number; codes: string[] } | null = null;
  for (const [phrase, codes] of Object.entries(SIC_BY_NICHE)) {
    const at = padded.indexOf(` ${phrase} `);
    if (at < 0) continue;
    if (!best || at < best.at || (at === best.at && phrase.length > best.len)) {
      best = { at, len: phrase.length, codes };
    }
  }
  return best ? [...best.codes] : [];
}

/**
 * The single word to match against registered names, for trades the register's
 * classification doesn't cover. A registered name has to contain this word for
 * the company to come back, which is why it is one word rather than the whole
 * phrase: "dog groomer" is filed as "… DOG GROOMING LTD", so the phrase itself
 * would match almost nothing.
 *
 * The word is the *last* distinctive one, because English puts the head noun
 * last — "window cleaning" ends in the trade, "emergency plumbing" too — and
 * the head noun is what a registered name actually carries.
 */
export function keywordFor(niche: string): string {
  const words = normalizeNiche(niche).split(" ").filter(Boolean);
  if (!words.length) return "";
  const distinctive = words.filter((w) => !GENERIC_WORD.has(w) && w.length > 2);
  const pool = distinctive.length ? distinctive : words;
  return pool[pool.length - 1];
}

export function sicLabel(code: string): string {
  return SIC_LABEL[code] ?? "";
}

/** "SIC 43910 roofing activities" — at most two, the register's own words. */
export function sicSummary(codes: string[] | undefined): string {
  const parts = (codes ?? [])
    .slice(0, 2)
    .map((c) => [`SIC ${c}`, sicLabel(c)].filter(Boolean).join(" "));
  return parts.join(", ");
}

// ---------- where and when ----------

const UK_HINT =
  /\b(uk|u\.k\.|united kingdom|great britain|gb|england|scotland|wales|northern ireland|n\.ireland)\b/i;
/** A UK postcode, in the shapes people actually type (with or without a space). */
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
/**
 * Countries that decide a search for the register is a mistake. Built from the
 * places users of this product actually search — when one of these appears the
 * source refuses rather than returning an empty UK list that looks like a
 * genuine "no businesses here".
 */
const NOT_UK =
  /\b(usa|u\.s\.a\.?|united states|america|canada|australia|new zealand|india|pakistan|bangladesh|sri lanka|nepal|philippines|malaysia|singapore|indonesia|china|japan|south korea|korea|thailand|vietnam|germany|france|spain|italy|netherlands|holland|belgium|switzerland|austria|poland|portugal|greece|sweden|norway|denmark|finland|ireland|uae|united arab emirates|dubai|saudi arabia|qatar|turkey|egypt|nigeria|kenya|ghana|south africa|brazil|mexico|argentina|chile|colombia)\b/i;

export function isUkLocation(location: string): boolean {
  const s = (location ?? "").trim();
  if (!s) return false;
  if (UK_HINT.test(s) || UK_POSTCODE.test(s)) return true;
  return !NOT_UK.test(s);
}

/** A segment that names a street or a unit rather than a place to search. */
const STREET_SEGMENT =
  /^(?:\d|unit\b|suite\b|flat\b|apartment\b|apt\b|building\b)|(?:street|road|avenue|lane|drive|close|court|place|crescent|terrace|grove|hill|park|works|mill|way|row|walk|st|rd|ave|ln|dr|ct|pl)\.?$/i;

/**
 * The place the register should actually be asked for.
 *
 * The register matches `location` against the registered office address and
 * understands a *place* — a town, a city, or a full postcode (verified against
 * the live service: "LS18 4TJ" answers with 146 companies, "SW1A 1AA" with 2).
 *
 * What it does not understand is a street, and it does not say so: "High Street"
 * as a location came back with **971 companies in Kidlington**. A user who typed
 * their own address would therefore have been handed a list from the wrong town
 * — which the locality gate then drops, or, when every row falls foul of it,
 * shows anyway because the rule assumes an unreadable location rather than a
 * wrong query. So an address is reduced to the town beside it, and a postcode,
 * being the most precise thing the filter does understand, wins over the town.
 */
export function locationQuery(location: string): string {
  const s = (location ?? "").trim();
  if (!s) return "";
  const postcode = s.match(UK_POSTCODE);
  if (postcode) return `${postcode[1]} ${postcode[2]}`.toUpperCase();
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? s;
  let i = 0;
  // Never skip past the last segment: when everything looks like a street, the
  // last one is still the better guess than the first.
  while (i < parts.length - 1 && STREET_SEGMENT.test(parts[i])) i++;
  return parts[i];
}

/**
 * ISO date (YYYY-MM-DD) for `months` before now — the recency window.
 *
 * The day is clamped to the length of the target month: counting one month back
 * from 31 March must land on 28 February (the last day of February), not on
 * "31 February", which JavaScript happily rolls forward into 3 March. That
 * would silently shorten the search window by a few days every time.
 */
export function incorporatedFromIso(now: Date = new Date(), months: number = RECENT_MONTHS): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const shifted = month - months;
  const targetYear = year + Math.floor(shifted / 12);
  const targetMonth = ((shifted % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, day)).toISOString().slice(0, 10);
}

/**
 * How many records to ask for.
 *
 * One request costs nothing per record, and the route afterwards throws away
 * every business that turns out to have a website — so the ask is a multiple of
 * the enrichment window rather than equal to it. Unlike the web source this is
 * free: the limit is a single JSON response, not a paid retrieval.
 */
export function requestSize(needed: number): number {
  return Math.min(Math.max(Math.round(needed * 3), 60), 300);
}

// ---------- reading a record ----------

export interface ChAddress {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

export interface ChCompany {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  company_type?: string;
  company_subtype?: string;
  date_of_creation?: string;
  date_of_cessation?: string;
  sic_codes?: string[];
  registered_office_address?: ChAddress;
}

export interface ChSearch {
  location: string;
  incorporatedFrom: string;
  size: number;
  sicCodes?: string[];
  nameIncludes?: string;
}

/** The register's office address, in the order a person reads an address. */
export function formatRegisteredAddress(a: ChAddress | undefined): string {
  const parts = [
    a?.address_line_1,
    a?.address_line_2,
    a?.locality,
    a?.region,
    a?.postal_code,
    a?.country,
  ];
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
}

/** "Registered 3 weeks ago" — what makes a register lead worth more than a map one. */
export function agePhrase(dateIso: string, now: Date = new Date()): string {
  const then = new Date(dateIso);
  if (isNaN(then.getTime())) return "";
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365.25);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * The register stores names in full caps ("J.HEMPSTOCK & CO LTD"). A list the
 * user pitches from shouldn't shout, so each word is re-cased — but legal forms
 * and short initials are left alone, and a name that already carries mixed case
 * is handed back exactly as published, because guessing at someone's name is
 * worse than quoting it.
 */
const LEGAL_FORM: Record<string, string> = {
  LTD: "Ltd", LIMITED: "Limited", CO: "Co", PLC: "PLC", LLP: "LLP", LP: "LP",
  CIC: "CIC", CIO: "CIO", UK: "UK", GB: "GB", EU: "EU", "T/A": "T/A",
};
const SMALL_WORD = new Set(["and", "of", "the", "for", "on", "in", "at"]);

function caseWord(word: string, first: boolean): string {
  const upper = word.toUpperCase();
  if (LEGAL_FORM[upper]) return LEGAL_FORM[upper];
  if (/^[A-Z]{1,2}$/.test(upper)) return upper; // initials: "J", "AB"
  const lower = word.toLowerCase();
  if (!first && SMALL_WORD.has(lower)) return lower;
  return lower
    .replace(/(^|[.\-'’])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/^Mc([a-z])/, (_m, ch: string) => `Mc${ch.toUpperCase()}`);
}

export function titleCaseCompanyName(raw: string): string {
  const name = (raw ?? "").trim();
  if (!name) return "";
  if (name !== name.toUpperCase()) return name; // already mixed case — leave it
  return name
    .split(/\s+/)
    .map((w, i) => caseWord(w, i === 0))
    .join(" ");
}

/**
 * One register record as a lead.
 *
 * The notes carry the facts that make this lead different from a map result:
 * how new the business is, its company number (so the user can look it up), and
 * what the register itself says it does. Everything the register cannot publish
 * is left empty and filled in later by the route's own per-business lookup.
 */
export function companyToLead(c: ChCompany, niche: string): Lead {
  const address = formatRegisteredAddress(c.registered_office_address);
  const hasAddress = Boolean(address.trim());
  const facts = [
    c.date_of_creation ? `Registered ${agePhrase(c.date_of_creation)} (${c.date_of_creation})` : "",
    c.date_of_cessation ? `Ceased trading ${c.date_of_cessation}` : "",
    c.company_number ? `Company no. ${c.company_number}` : "",
    sicSummary(c.sic_codes),
    // The register publishes the registered office, which for a very young
    // company is frequently its accountant's or a formation agent's address —
    // the address it is legally required to have, not the one it trades from.
    // Saying so is the difference between a user posting a letter to a real
    // door and standing outside an accountancy firm that has never heard of
    // them. Only when there is an address to qualify: a record with none has
    // nothing to warn about.
    hasAddress ? "Address shown is the registered office — confirm the trading address" : "",
  ].filter(Boolean);

  return {
    business_name: titleCaseCompanyName(c.company_name ?? ""),
    category: niche.trim(),
    website: "",
    phone: "",
    email: "",
    instagram: "",
    linkedin: "",
    address,
    notes: facts.join("; "),
    company_number: c.company_number ?? "",
    incorporated_on: c.date_of_creation ?? "",
    source: "companies_house",
  };
}

export function advancedSearchUrl(q: ChSearch): string {
  const p = new URLSearchParams();
  for (const code of q.sicCodes ?? []) p.append("sic_codes", code);
  if (q.nameIncludes) p.set("company_name_includes", q.nameIncludes);
  p.set("company_status", "active");
  for (const t of COMPANY_TYPES) p.append("company_type", t);
  const where = locationQuery(q.location);
  if (where) p.set("location", where);
  p.set("incorporated_from", q.incorporatedFrom);
  p.set("size", String(q.size));
  return `${CH_API}/advanced-search/companies?${p.toString()}`;
}

/**
 * A problem the user can fix — an unusable key, a location the register doesn't
 * cover, or the 600-requests-per-5-minutes limit being tripped. The registry
 * re-throws these as a SourceSetupError, which the search route answers with a
 * 400 and the message rather than a 500.
 */
export class CompaniesHouseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompaniesHouseError";
  }
}

/**
 * The register's auth. The key is the username and the password is empty, sent
 * over the wire only — never logged, never stored anywhere else. No User-Agent
 * is set: this is an authenticated API call, not a crawl, and the key is the
 * identity the service wants; Node's own default is accepted.
 */
function authHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${key}:`, "utf8").toString("base64")}`,
    Accept: "application/json",
  };
}

export interface CompaniesHouseOptions {
  /**
   * How far back to look, as a date the register understands. Defaults to the
   * 24-month window a search wants; the weekly digest passes its own much shorter
   *   one ("companies registered since I last looked"), which is the difference
   * between a feed of new businesses and a list of everything recent.
   */
  incorporatedFrom?: string;
  /**
   * How many officer lookups this call may spend, at most OFFICER_LOOKUP_CAP.
   *
   * A search spends one per lead it can show, which is right for a user who is
   * waiting on one list. A weekly digest over every saved search cannot: thirty
   * lookups per watch, for every account, against a register that allows 600
   * requests per five minutes. So the digest names directors for the first few
   * companies and leaves the rest as names and addresses, which is still the
   * thing a business with no website cannot otherwise offer.
   */
  officers?: number;
}

export function companiesHouseRequest(
  niche: string,
  location: string,
  needed: number,
  key: string,
  opts: CompaniesHouseOptions = {}
): { url: string; headers: Record<string, string> } {
  const sic = sicCodesFor(niche);
  const url = advancedSearchUrl({
    location,
    incorporatedFrom: opts.incorporatedFrom || incorporatedFromIso(),
    size: requestSize(needed),
    ...(sic.length ? { sicCodes: sic } : { nameIncludes: keywordFor(niche) }),
  });
  return { url, headers: authHeaders(key) };
}

// ---------- who runs the company ----------

/**
 * The register publishes no phone and no email — but it does publish who runs
 * the company, and for a business that was incorporated weeks ago that is the
 * only way in that exists. One extra request per company, spent on the leads
 * that can actually be shown rather than on the whole page of results.
 *
 * This is also the one contact detail here that is *checked*: it is the
 * register's own record, quotable and correctable, unlike a name guessed at
 * from a team page.
 */
export function officersUrl(companyNumber: string): string {
  return `${CH_API}/company/${encodeURIComponent(companyNumber)}/officers?items_per_page=35`;
}

/** How many officer lookups one search may spend, whatever the size asked for. */
export const OFFICER_LOOKUP_CAP = 30;

export interface ChOfficer {
  name?: string;
  officer_role?: string;
  appointed_on?: string;
  resigned_on?: string;
}

/**
 * Roles that mean "runs the company". A secretary, a nominee or a liquidator is
 * not the person a freelancer is trying to reach, and the register lists all of
 * them in the same array.
 */
const ACTIVE_OFFICER_ROLE = /^(director|llp-designated-member|llp-member|managing-officer)$/;

/**
 * "ENOCH, Darren Charles" → "Darren Charles Enoch".
 *
 * The register writes the surname first and in capitals and often leaves the
 * forenames as typed, so each part is re-cased on its own rather than handing
 * the whole string to the company-name caster — whose rule is to leave a
 * mixed-case string exactly as published, which is right for a company and
 * wrong for "O'BRIEN, Sean".
 */
export function personName(raw: string): string {
  const name = (raw ?? "").trim();
  if (!name) return "";
  const comma = name.indexOf(",");
  const ordered = comma < 0 ? name : `${name.slice(comma + 1)} ${name.slice(0, comma)}`;
  return ordered
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => caseWord(word, false))
    .join(" ");
}

/** Active directors, in the register's own order, at most two. */
export function directorNames(items: ChOfficer[] | undefined): string[] {
  const out: string[] = [];
  for (const o of items ?? []) {
    if (o.resigned_on) continue;
    if (!ACTIVE_OFFICER_ROLE.test((o.officer_role ?? "").toLowerCase())) continue;
    const name = personName(o.name ?? "");
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= 2) break;
  }
  return out;
}

/**
 * Directors for one company, or none.
 *
 * A company whose officers can't be read is not a failed search — the row is
 * still a real, newly incorporated business — so this returns an empty list
 * rather than throwing and taking the whole search down with it.
 */
async function fetchDirectors(companyNumber: string, key: string): Promise<string[]> {
  const res = await fetch(officersUrl(companyNumber), {
    headers: authHeaders(key),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: ChOfficer[] };
  return directorNames(data.items);
}

/**
 * Recently incorporated, active UK companies for a niche and a place.
 *
 * Newest first: a company registered three weeks ago is likelier to have no
 * site than one registered two years ago, and the user is shown the list in the
 * order they should work it.
 */
export async function searchCompaniesHouse(
  niche: string,
  location: string,
  needed: number,
  key: string,
  opts: CompaniesHouseOptions = {}
): Promise<Lead[]> {
  if (!isUkLocation(location)) {
    throw new CompaniesHouseError(
      `Companies House is the UK register, so it can't search "${location.trim()}". Use a UK town or city, or switch to Web search or OpenStreetMap.`
    );
  }

  const { url, headers } = companiesHouseRequest(niche, location, needed, key, opts);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });

  if (res.status === 401) {
    throw new CompaniesHouseError(
      "Companies House rejected that API key — check it in Settings. It must be a REST key, and the whole key has to be pasted."
    );
  }
  if (res.status === 429) {
    throw new CompaniesHouseError(
      "Companies House rate limit reached (600 requests per 5 minutes) — wait a minute and search again."
    );
  }
  if (res.status === 404) return []; // the register's own "nothing matched"
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Companies House error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { items?: ChCompany[] };
  const seen = new Set<string>();
  const found: ChCompany[] = [];
  for (const c of data.items ?? []) {
    // The filter should have handled this; a dissolved company must never reach
    // a user's list, so the check is repeated here rather than trusted.
    if (c.company_status && c.company_status !== "active") continue;
    const name = (c.company_name ?? "").trim();
    if (!name) continue;
    const dedupe = name.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    found.push(c);
  }

  const ordered = found.sort((a, b) =>
    (b.date_of_creation ?? "").localeCompare(a.date_of_creation ?? "")
  );
  const leads = ordered.map((c) => companyToLead(c, niche));

  // Name the people behind the company, for the leads that can be shown. Capped
  // and concurrency-limited: the register allows 600 requests per 5 minutes, and
  // this is the only part of the source that spends more than one.
  const budget = Math.min(
    leads.length,
    Math.max(opts.officers ?? needed, 1),
    OFFICER_LOOKUP_CAP
  );
  const CONCURRENCY = 5;
  for (let i = 0; i < budget; i += CONCURRENCY) {
    await Promise.all(
      leads.slice(i, i + CONCURRENCY).map(async (lead, offset) => {
        const number = ordered[i + offset]?.company_number;
        if (!number) return;
        const directors = await fetchDirectors(number, key);
        if (directors.length) {
          lead.notes = [lead.notes, `Directors: ${directors.join(", ")}`]
            .filter(Boolean)
            .join("; ");
          // Structured as well as prose: the name is the handle the rest of the
          // product uses to find the person, and prose is a bad place to keep a
          // key. `notes` stays the human-readable copy.
          lead.directors = directors;
        }
      })
    );
  }

  return leads;
}
