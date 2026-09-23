/**
 * Locality matching for lead search — pure and dependency-free (no geocoder,
 * no network, no imports) so the rule can be unit tested directly and adds no
 * latency or rate limit to a search.
 *
 * The product promise is that every row is a business the user can actually
 * work. A practice 1,500 miles away is not a local lead: the first call fails
 * and the whole list stops being trustworthy. So a lead whose own address names
 * a different place is left out of the results.
 *
 * The direction of error is what matters here. Dropping a real local business
 * is invisible and permanent; keeping a distant one is visible. So a lead is
 * only called "elsewhere" when its address positively names somewhere that
 * shares nothing with what the user typed. A missing, unreadable, street-only
 * or state-only address is never held against it.
 */

/**
 * Words that describe a country or region and therefore say nothing about which
 * city a business is in. A location made only of these ("USA") means the whole
 * country, so nothing can be out of area.
 */
const REGION_WORDS = new Set([
  "us", "u s", "usa", "u s a", "america", "united states", "united states of america",
  "uk", "u k", "united kingdom", "england", "scotland", "wales", "northern ireland",
  "canada", "australia", "new zealand", "ireland", "india", "pakistan", "bangladesh",
  "uae", "u a e", "united arab emirates", "dubai", "saudi arabia", "qatar", "kuwait",
  "germany", "france", "spain", "italy", "netherlands", "belgium", "portugal", "ireland",
  "switzerland", "austria", "sweden", "norway", "denmark", "finland", "poland",
  "greece", "turkey", "egypt", "nigeria", "kenya", "ghana", "south africa",
  "brazil", "mexico", "argentina", "chile", "colombia", "peru",
  "china", "japan", "korea", "south korea", "singapore", "malaysia", "indonesia",
  "philippines", "thailand", "vietnam", "sri lanka", "nepal",
]);

/**
 * Street and venue words: a component containing one is an address line, not a
 * place name. Getting this wrong in the generous direction is safe — it only
 * means we keep a lead we could not place.
 */
const STREET_RE =
  /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|hwy|highway|pkwy|parkway|square|sq|court|ct|place|pl|circle|cir|terrace|ter|suite|ste|floor|fl|unit|apt|apartment|building|bldg|plaza|mall|shopping|centre|center|tower|block|sector|phase|plot|house|villa|chowk|nagar|colony|layout)\b/;

/** US state names as typed in a location box, mapped to their postal codes. */
const US_STATE_CODES: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms",
  missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
  "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok",
  oregon: "or", pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc",
  "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi",
  wyoming: "wy", "district of columbia": "dc",
};

/** Lowercase, strip punctuation, collapse whitespace. */
function normalizePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Region words that are aliases of one country, grouped. Only the aliases that
 * appear in REGION_WORDS need an entry; anything absent is its own country (the
 * word itself is the group). Ireland is deliberately NOT Great Britain.
 */
const COUNTRY_GROUPS: Record<string, string> = {
  us: "us", "u s": "us", usa: "us", "u s a": "us", america: "us",
  "united states": "us", "united states of america": "us",
  uk: "gb", "u k": "gb", "united kingdom": "gb", england: "gb",
  scotland: "gb", wales: "gb", "northern ireland": "gb",
  uae: "ae", "u a e": "ae", "united arab emirates": "ae",
};

/** Every country named anywhere in a piece of text, as group ids. */
function countriesNamed(text: string): Set<string> {
  const flat = normalizePart(text ?? "");
  const found = new Set<string>();
  for (const word of REGION_WORDS) {
    if (hasWord(flat, word)) found.add(COUNTRY_GROUPS[word] ?? word);
  }
  return found;
}

/**
 * Does the address name a country that isn't the one the user asked about?
 *
 * This is the one locality judgement worth making from text alone, because it
 * catches the case name-matching gets backwards: "Manchester, United States"
 * shares a word with a search for "Manchester, UK" and would sail through as a
 * local lead 5,000 km away. Two different countries named is positive evidence,
 * so it drops without needing a lookup. Silence on either side decides nothing.
 */
export function countryConflict(address: string, terms: LocationTerms): boolean {
  const asked = countriesNamed(terms.label);
  if (asked.size === 0) return false;
  const found = countriesNamed(address);
  if (found.size === 0) return false;
  for (const c of found) if (asked.has(c)) return false;
  return true;
}

export interface LocationTerms {
  /** The location exactly as the user typed it, for user-facing messages. */
  label: string;
  /** Phrases that identify the requested place ("austin", "new york", "tx"). */
  tokens: string[];
  /** Which country the location names, when it names one ("GB" for UK/England). */
  country: "GB" | "US" | null;
}

export function locationTerms(location: string): LocationTerms {
  const label = location.trim();
  const tokens: string[] = [];
  for (const part of label.split(",").map(normalizePart)) {
    if (!part || REGION_WORDS.has(part)) continue; // "USA" is the whole country
    if (!/\p{L}/u.test(part)) continue;
    tokens.push(part);
    // "Texas, USA" must still match addresses that spell it "TX".
    const code = US_STATE_CODES[part];
    if (code) tokens.push(code);
  }
  return { label, tokens, country: countryOfLocation(label) };
}

/**
 * The country a location box names, for the checks that are market-specific: a
 * UK phone number carries a trunk 0 that most databases drop, and a US one
 * never does. Deliberately narrow — only the markets the product is sold into —
 * so an unlisted country returns null and nothing is assumed about its numbers
 * or its addresses.
 */
function countryOfLocation(label: string): "GB" | "US" | null {
  const named = countriesNamed(label);
  if (named.has("gb")) return "GB";
  if (named.has("us")) return "US";
  return null;
}

/** A UK postcode — the strongest single signal that an address is a UK one. */
const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
/** A US ZIP after a state code, as an American address always writes it. */
const US_ZIP = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;

/**
 * The market the results are actually in, when the location box names none.
 *
 * People type "Leeds", not "Leeds, UK" — and the market decides how every phone
 * number handed over is read, because a UK national number carries a trunk 0
 * that most databases drop, and one that has lost it dials nobody. This is not
 * hypothetical: the same lead from the same source, one minute apart, came out
 * as the profile's truncated "113 275 262" for "Leeds" and as the business's own
 * published "0113 275 2620" for "Leeds, UK".
 *
 * So when the location is silent, the businesses just found are asked instead —
 * the country their own addresses name, or the postcode shape they carry. The
 * evidence decides only when it is one-sided: an unreadable address counts for
 * nothing, and mixed results return null so that nothing is assumed about a
 * market nobody stated.
 */
export function inferCountryFromAddresses(addresses: string[]): "GB" | "US" | null {
  let gb = 0;
  let us = 0;
  for (const address of addresses ?? []) {
    const country = countryOfText(address);
    if (country === "GB") gb++;
    else if (country === "US") us++;
  }
  if (gb === us) return null;
  return gb > us ? "GB" : "US";
}

/** A US phone written the American way: "(951) 230-8701", "+1 951 230 8701". */
const US_PHONE =
  /(?:\(\d{3}\)\s*\d{3}[-.\s]\d{4})|(?:\+1[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;

/** Evidence that a piece of text is American. */
function showsUs(text: string): boolean {
  if (US_ZIP.test(text) || US_PHONE.test(text)) return true;
  if (countriesNamed(text).has("us")) return true;
  const flat = normalizePart(text);
  return Object.keys(US_STATE_CODES).some((state) => hasWord(flat, state));
}

/** Evidence that a piece of text is British. */
function showsGb(text: string): boolean {
  return UK_POSTCODE.test(text) || countriesNamed(text).has("gb");
}

/**
 * The country a page or an address places itself in.
 *
 * `prefer` is the market already established for the search, and it settles
 * ties: a British business whose page mentions an American supplier is still a
 * British page, because the evidence for its own country sits right there beside
 * the mention. Without it, a page showing both is treated as no evidence at all.
 */
export function countryOfText(text: string, prefer: "GB" | "US" | null = null): "GB" | "US" | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const gb = showsGb(t);
  const us = showsUs(t);
  if (prefer === "GB" && gb) return "GB";
  if (prefer === "US" && us) return "US";
  if (gb && !us) return "GB";
  if (us && !gb) return "US";
  return null;
}

/**
 * The country a hostname declares by itself, when it declares one.
 *
 * A country code is the site's own statement about where it is. A generic TLD
 * says nothing — British businesses use .com constantly — so this returns null
 * for one rather than assuming American.
 */
export function countryFromHost(host: string): "GB" | "US" | null {
  const h = (host ?? "").toLowerCase();
  if (/(\.uk|\.gb|\.wales|\.scot|\.cymru)$/.test(h)) return "GB";
  if (/(\.us|\.gov|\.edu|\.mil)$/.test(h)) return "US";
  return null;
}

/**
 * Does a page found for a lead belong to the lead's own market?
 *
 * Silence decides nothing: only positive evidence of a *different* country is a
 * refusal, because that is the one case where the page is provably another
 * business. Measured on a register lead: "Ironpeak Roofing Services Ltd" of
 * Leeds matched ironpeakroofingservices.com — a company of the same name serving
 * California's Inland Empire — and the Californian phone number went out as the
 * lead's own. Name agreement cannot see that; a country can.
 */
export function countryAgrees(lead: "GB" | "US" | null, page: "GB" | "US" | null): boolean {
  if (!lead || !page) return true;
  return lead === page;
}

export type LocalityVerdict = "local" | "elsewhere" | "unknown";

/**
 * Is this business in the place the user asked for?
 *
 * "local"     — the address repeats something the user typed.
 * "elsewhere" — the address names a different place, and shares nothing with
 *               the request. Only this verdict is safe to act on.
 * "unknown"   — nothing in the address can place it either way.
 */
export function classifyLocality(address: string, terms: LocationTerms): LocalityVerdict {
  const raw = (address ?? "").trim();
  if (!raw || terms.tokens.length === 0) return "unknown";

  const parts = raw.split(",").map(normalizePart).filter(Boolean);
  if (parts.length === 0) return "unknown";
  const flat = parts.join(", ");

  // Sharing a name anywhere in the address is enough to call it local.
  for (const token of terms.tokens) if (hasWord(flat, token)) return "local";

  // Otherwise it is elsewhere only if some component finally names a place that
  // isn't the requested one — not a country, state code, street line or ZIP.
  return parts.some(isPlaceName) ? "elsewhere" : "unknown";
}

// ---------- distance: the second opinion for a lead the name rule would drop ----------

export interface Point {
  lat: number;
  lon: number;
}

/**
 * How close a business has to be to count as local when its address doesn't
 * name the requested place. Measured against real cases rather than picked:
 * Openshaw (a Manchester district, 5.1 km) and Astley in Wigan (15.8 km) are
 * local; Round Rock, TX (27.1 km from Austin) and Chorley, Lancashire (35.3 km
 * from Manchester) are not.
 */
export const LOCAL_RADIUS_KM = 25;

/** Great-circle distance in kilometres. */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Should a lead the name rule would drop be kept after all?
 *
 * Only when we measured both places and they are close. Any missing half — the
 * geocoder was down, the address names nothing, the request couldn't be
 * placed — answers false, which leaves the existing (stricter) verdict in
 * place rather than guessing in the user's list.
 */
export function withinLocalRadius(origin: Point | null, point: Point | null): boolean {
  if (!origin || !point) return false;
  return distanceKm(origin, point) <= LOCAL_RADIUS_KM;
}

/** Whole-word, Unicode-aware match, so "Austin" can never match "Austinton". */
function hasWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(haystack);
}

/** A component that names a place, rather than a street line, ZIP or country. */
function isPlaceName(part: string): boolean {
  if (part.length < 3) return false; // 2-letter state codes: "tx", "oh"
  if (/\d/.test(part)) return false; // street numbers, "78730", "sector 17"
  if (REGION_WORDS.has(part)) return false; // "united states"
  if (STREET_RE.test(part)) return false; // "main street"
  return true;
}
