/**
 * What a user's niche words mean in each source's own language.
 *
 * Kept dependency-free (like lib/scrape.ts, lib/geo.ts and lib/crawl.ts) so the
 * test suite can import it directly. Every entry here is a claim about *other
 * people's data*, and a wrong one fails silently: the search returns nothing and
 * looks like an empty city rather than a bug. The only way to keep that honest is
 * to pin it with tests.
 *
 * ---------------------------------------------------------------------------
 * How the OpenStreetMap entries were chosen (measured, not recalled)
 * ---------------------------------------------------------------------------
 *
 * The trade tags were read off taginfo.openstreetmap.org's live counts, and the
 * counts are quoted beside them. Two things came out of that:
 *
 *  1. The trades this product is sold for were not covered at all. Without an
 *     entry, a niche falls back to a case-insensitive regex over eight tag keys,
 *     and that silently returns nothing for the most obvious one: "cleaners"
 *     reduces to the word "cleaner", which does not match OSM's `craft=cleaning`
 *     (4,710 uses). A cleaning business search was returning an empty list in a
 *     city full of them — the single worst failure this module can have, because
 *     the user blames their niche, not us.
 *
 *  2. A substring match is not good enough for trades. `craft=car_painter` (330)
 *     and `craft=boatbuilder` (960) and `craft=stand_builder` (126) all contain a
 *     trade word while being a different business, and `shop=builders_merchant`
 *     is a yard, not a builder. So the trade patterns below match a tag value
 *     *exactly*, or as one part of a semicolon-separated list — a plumber tagged
 *     `craft=plumber;hvac` is still a plumber, but `car_painter` is not a painter.
 *
 * The pre-existing entries are left as they were deliberately. Several of them
 * rely on substring matching, and rewriting them to the strict form would drop
 * real businesses: `shop=beauty_salon` would no longer answer the niche "beauty",
 * and `healthcare=dentist` would stop answering "dental". Strictness was added
 * where it was measured to matter, not applied blindly.
 */

/** OSM tag values in this file, with the live taginfo count that justified them. */
export const TRADE_TAGS = {
  roofer: 6025,
  plumber: 12179,
  electrician: 14780,
  painter: 6441,
  carpenter: 20938,
  gardener: 7530,
  locksmith: 7353, // shop=locksmith; craft=locksmith has 2,031
  hvac: 12586,
  heating_engineer: 116,
  builder: 5719,
  pest_control: 304,
  tiler: 1936,
  plasterer: 810,
  glaziery: 6420, // craft=glaziery — the value is *glaziery*, not "glazier"
  cleaning: 4710, // craft=cleaning; office=cleaning adds 100
  window_cleaner: 10,
  carpet_cleaner: 87,
  moving_company: 3233, // office=moving_company
  interior_decorator: 192,
} as const;

/**
 * A tag value, matched whole or as one part of a multi-value tag.
 *
 *   ^(.*;)?(plumber|plumbing)(;.*)?$
 *
 * That matches `craft=plumber`, and `craft=plumber;hvac` or `craft=hvac;plumber`
 * — a business tagged with two trades is still a plumber. It refuses
 * `car_painter`, `boatbuilder`, `stand_builder` and `builders_merchant`, which
 * all contain a trade word and are different businesses.
 *
 * The shape is not the obvious one, and the obvious one was measured to fail:
 * `(^|;)(plumber)(;|$)` looks equivalent and returns ZERO results from Overpass,
 * because anchors inside an alternation group are not honoured by its regex
 * engine. Probed against live Overpass on a Leeds bounding box:
 *
 *   craft=cleaning                        1 element
 *   craft~"cleaning"                      1 element
 *   craft~"^(cleaning|cleaner)$"          1 element
 *   craft~"(^|;)(cleaning|cleaner)(;|$)"  0 elements   ← the trap
 *   craft~"^(.*;)?(roofer|roofing)(;.*)?$"  10 elements, all craft=roofer
 *
 * Overpass also has its own rate limiter (HTTP 429 with no `retry-after`), which
 * is why the probes above are spaced out — the same reason the search route
 * keeps its own pace on this source.
 */
export function tradeTag(...values: string[]): string {
  return `^(.*;)?(${values.join("|")})(;.*)?$`;
}

export interface NicheAlias {
  /** Regex applied to the source's tag values. */
  re: string;
  /** Which tag keys to look in — fewer keys is a much cheaper query. */
  keys?: string[];
}

export const NICHE_ALIASES: Record<string, NicheAlias> = {
  // ---- the trades this product is sold for (see the note at the top) ----
  // Each is one exact value in one key, so the query is a single cheap scan
  // instead of eight case-insensitive regex scans over the whole city.
  cleaner: { re: tradeTag("cleaning", "cleaner"), keys: ["craft", "office"] },
  cleaning: { re: tradeTag("cleaning", "cleaner"), keys: ["craft", "office"] },
  "window cleaner": { re: tradeTag("window_cleaner"), keys: ["craft"] },
  "window cleaning": { re: tradeTag("window_cleaner"), keys: ["craft"] },
  "carpet cleaner": { re: tradeTag("carpet_cleaner"), keys: ["craft"] },
  "carpet cleaning": { re: tradeTag("carpet_cleaner"), keys: ["craft"] },
  roofer: { re: tradeTag("roofer", "roofing"), keys: ["craft", "shop"] },
  roofing: { re: tradeTag("roofer", "roofing"), keys: ["craft", "shop"] },
  plumber: { re: tradeTag("plumber", "plumbing"), keys: ["craft", "shop"] },
  plumbing: { re: tradeTag("plumber", "plumbing"), keys: ["craft", "shop"] },
  electrician: { re: tradeTag("electrician"), keys: ["craft", "shop", "office"] },
  painter: { re: tradeTag("painter"), keys: ["craft", "shop"] },
  painting: { re: tradeTag("painter"), keys: ["craft", "shop"] },
  // In the UK a "decorator" is a painter, and OSM also has interior decorators.
  decorator: { re: tradeTag("painter", "interior_decorator"), keys: ["craft"] },
  decorating: { re: tradeTag("painter", "interior_decorator"), keys: ["craft"] },
  carpenter: { re: tradeTag("carpenter"), keys: ["craft", "shop"] },
  carpentry: { re: tradeTag("carpenter"), keys: ["craft", "shop"] },
  joiner: { re: tradeTag("carpenter"), keys: ["craft", "shop"] },
  gardener: { re: tradeTag("gardener"), keys: ["craft", "shop"] },
  gardening: { re: tradeTag("gardener"), keys: ["craft", "shop"] },
  locksmith: { re: tradeTag("locksmith"), keys: ["shop", "craft"] },
  hvac: { re: tradeTag("hvac"), keys: ["craft", "shop"] },
  "air conditioning": { re: tradeTag("hvac"), keys: ["craft", "shop"] },
  "heating engineer": { re: tradeTag("heating_engineer", "hvac"), keys: ["craft"] },
  builder: { re: tradeTag("builder"), keys: ["craft"] },
  builders: { re: tradeTag("builder"), keys: ["craft"] },
  "pest control": { re: tradeTag("pest_control"), keys: ["craft", "shop", "office"] },
  tiler: { re: tradeTag("tiler"), keys: ["craft"] },
  tiling: { re: tradeTag("tiler"), keys: ["craft"] },
  plasterer: { re: tradeTag("plasterer"), keys: ["craft"] },
  plastering: { re: tradeTag("plasterer"), keys: ["craft"] },
  glazier: { re: tradeTag("glaziery"), keys: ["craft", "shop"] },
  glazing: { re: tradeTag("glaziery"), keys: ["craft", "shop"] },
  mover: { re: tradeTag("moving_company"), keys: ["office"] },
  movers: { re: tradeTag("moving_company"), keys: ["office"] },
  removal: { re: tradeTag("moving_company"), keys: ["office"] },
  removals: { re: tradeTag("moving_company"), keys: ["office"] },
  "moving company": { re: tradeTag("moving_company"), keys: ["office"] },

  // ---- pre-existing entries, unchanged (see the note at the top) ----
  gym: { re: "fitness_centre|fitness|gym", keys: ["leisure", "amenity"] },
  fitness: { re: "fitness_centre|fitness|gym", keys: ["leisure", "amenity"] },
  dentist: { re: "dentist|dental", keys: ["amenity", "healthcare"] },
  dental: { re: "dentist|dental", keys: ["amenity", "healthcare"] },
  "dental clinic": { re: "dentist|dental", keys: ["amenity", "healthcare"] },
  doctor: { re: "doctors|clinic", keys: ["amenity", "healthcare"] },
  clinic: { re: "clinic|doctors", keys: ["amenity", "healthcare"] },
  "hair salon": { re: "hairdresser|beauty", keys: ["shop"] },
  barber: { re: "hairdresser|barber", keys: ["shop"] },
  salon: { re: "hairdresser|beauty", keys: ["shop"] },
  "beauty salon": { re: "beauty|hairdresser|cosmetics", keys: ["shop"] },
  lawyer: { re: "lawyer|notary", keys: ["office"] },
  "real estate": { re: "estate_agent", keys: ["office", "shop"] },
  "real estate agency": { re: "estate_agent", keys: ["office", "shop"] },
  "estate agent": { re: "estate_agent", keys: ["office", "shop"] },
  realtor: { re: "estate_agent", keys: ["office", "shop"] },
  mechanic: { re: "car_repair", keys: ["shop"] },
  "car repair": { re: "car_repair", keys: ["shop"] },
  "auto repair": { re: "car_repair", keys: ["shop"] },
  coffee: { re: "cafe|coffee", keys: ["amenity", "shop", "cuisine"] },
  "coffee shop": { re: "cafe|coffee", keys: ["amenity", "shop", "cuisine"] },
  restaurant: { re: "restaurant|fast_food", keys: ["amenity"] },
  cafe: { re: "cafe", keys: ["amenity"] },
  hotel: { re: "hotel|guest_house|hostel", keys: ["tourism"] },
  florist: { re: "florist", keys: ["shop"] },
  vet: { re: "veterinary", keys: ["amenity"] },
  veterinarian: { re: "veterinary", keys: ["amenity"] },
  pharmacy: { re: "pharmacy|chemist", keys: ["amenity", "shop", "healthcare"] },
};

/**
 * The alias for a niche, or null to fall back to a generic name scan.
 *
 * A plural is the singular the user didn't type ("roofers" → "roofer"), which is
 * the same assumption the fallback makes.
 */
export function nicheAlias(niche: string): NicheAlias | null {
  const lower = (niche ?? "").trim().toLowerCase();
  if (!lower) return null;
  return NICHE_ALIASES[lower] ?? NICHE_ALIASES[lower.replace(/s$/, "")] ?? null;
}

/** Does this pattern match this tag value? Used by the tests to prove the rules. */
export function tagMatches(pattern: string, value: string): boolean {
  return new RegExp(pattern).test(value);
}
