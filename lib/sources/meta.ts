/**
 * What each lead source is, in one place.
 *
 * This module is deliberately dependency-free and importable from the client:
 * the Lead Finder picker renders from it, and the server registry (lib/sources)
 * attaches the implementations to the same entries. Adding a source should be
 * a single entry here plus one `search` function — nothing in the search route
 * knows any source by name.
 *
 * The `available` flag is the honest part: sources that are declared but not
 * built yet stay in this list as the roadmap, and the inventory check below
 * refuses to let one be *offered* without an implementation behind it.
 */

export type SourceId =
  | "web"
  | "osm"
  | "companies_house"
  | "yelp"
  | "site_crawl";

/** What a lead from this source arrives already carrying. */
export interface SourceGives {
  website: boolean;
  contact: boolean;
  address: boolean;
  industry: boolean;
}

export interface SourceMeta {
  id: SourceId;
  label: string;
  /** One line for the picker: what the user gets, and what it costs them. */
  desc: string;
  gives: SourceGives;
  /** free = no key and no bill; key = the user's own API key; metered = paid per call. */
  cost: "free" | "key" | "metered";
  /** Where the data comes from, which is the compliance story for a lead. */
  legal: "ai_search" | "open_data" | "official_api" | "own_site_crawl";
  /** Settings field this source needs. Required for a source the user keys themselves. */
  keySetting?: string;
  /**
   * Whose credential runs this source.
   *
   * "user" — the customer pastes their own key in Settings. Nothing ships this
   * way today: asking a customer for a Google Cloud key before their first
   * search put an account-creation step in front of the product's core action,
   * for data OpenStreetMap already carries (see the note on `google` below).
   * "instance" — the operator configures one key for the whole deployment and
   * every customer gets the source without one of their own (Companies House).
   * A source the operator pays for must never be something a customer has to
   * sign up for before they can search — and an instance key that a user could
   * override per account is a support case nobody can see.
   */
  credential?: "user" | "instance";
  /** Environment variable holding the deployment's key, for `credential: "instance"`. */
  envKey?: string;
  /** The cheapest plan that unlocks it. Everything shipped so far is free. */
  plan: "free" | "starter" | "pro";
  /** Offered in the picker today. False = declared on the roadmap, not built. */
  available: boolean;
  /**
   * discovery — answers "find me businesses" from a niche and a location.
   * enrichment — improves businesses another source found; it cannot discover
   * anything on its own, so it is never offered in the picker.
   */
  kind: "discovery" | "enrichment";
  /** Why a source is declared but not offered, or what it costs in practice. */
  note?: string;
}

export const SOURCE_META: Record<SourceId, SourceMeta> = {
  web: {
    id: "web",
    label: "Web search (AI)",
    desc: "Searches the whole web — often finds emails directly. Free, no key.",
    gives: { website: true, contact: true, address: true, industry: true },
    cost: "free",
    legal: "ai_search",
    plan: "free",
    available: true,
    kind: "discovery",
  },
  osm: {
    id: "osm",
    label: "OpenStreetMap",
    desc: "Free, no key needed. Open business database.",
    // OSM carries the website of every business whose record has one, and no
    // website field for the rest — which is what the offline pipeline is built
    // on: "no website in OSM" is what fills the No website search.
    gives: { website: true, contact: false, address: true, industry: true },
    cost: "free",
    legal: "open_data",
    plan: "free",
    available: true,
    kind: "discovery",
  },
  // Google Places was offered here and has been removed deliberately, not
  // dropped in an oversight — worth writing down so it is not "restored" from
  // memory:
  //
  //  * It was the only source that asked a *customer* for a key, and the key is
  //    the whole product's first hurdle: a Google Cloud project, a billing
  //    account, the Places API (New) enabled, and an unrestricted-vs-restricted
  //    decision (restrict it wrong and the key starts returning 403 with no
  //    explanation). Every one of those steps sits between a new user and their
  //    first search, and the product's promise is "type a niche and a city".
  //  * What it returned for that cost — name, website, phone, address — is what
  //    OpenStreetMap already returns keylessly, and the merge only ever added a
  //    handful of records the no-website pipeline hadn't already found.
  //  * Re-adding it is small and known: an entry here with `cost: "key"` and
  //    `credential: "user"`, a `keySetting`, a `search` function in
  //    lib/sources/index.ts, and the id in ACTIVE_SOURCES below. Put the id back
  //    in the SourceId union too. The implementation that existed is in git
  //    history (searchGooglePlaces in lib/leads.ts).
  companies_house: {
    id: "companies_house",
    label: "Companies House (UK)",
    desc: "Newly registered UK companies from the official register. Best for businesses with no site yet.",
    // The register publishes no website, phone or email — so this source can
    // only serve the No website search, where the route runs its own lookup per
    // business to confirm the claim before a lead is shown.
    gives: { website: false, contact: false, address: true, industry: true },
    cost: "key",
    legal: "official_api",
    // The deployment holds this key, not the customer: the register is free and
    // read-only, the operator creates the key once, and every user gets the
    // source without a signup. Nothing about it belongs in a user's Settings.
    credential: "instance",
    envKey: "COMPANIES_HOUSE_API_KEY",
    // Its only usable filter is "No website", which is Pro — the ladder stays
    // honest by saying so here rather than offering what the plan can't run.
    plan: "pro",
    available: true,
    kind: "discovery",
    note: "Listed from the deployment's own register key (COMPANIES_HOUSE_API_KEY) — no key needed from the user. UK companies incorporated in the last 24 months, newest first, with their directors. Because the register publishes no trading address, phone or email, a lead here is a name, the people behind it and the registered office.",
  },
  yelp: {
    id: "yelp",
    label: "Yelp",
    desc: "Official listing data with phone, address and how busy the business is.",
    gives: { website: true, contact: true, address: true, industry: true },
    cost: "key",
    legal: "official_api",
    plan: "free",
    available: false,
    kind: "discovery",
    note: "Needs a Yelp app key, and overlaps OpenStreetMap for the same kind of listings.",
  },
  site_crawl: {
    id: "site_crawl",
    label: "Your leads' own sites",
    desc: "Reads each site's sitemap, contact and team pages for emails and names.",
    gives: { website: true, contact: true, address: false, industry: false },
    cost: "free",
    legal: "own_site_crawl",
    plan: "free",
    available: false,
    kind: "enrichment",
    note: "Not a source: it improves leads other sources found, and runs inside every search.",
  },

  // Rejected after measuring, kept here so nobody re-litigates them from
  // memory — and so the next person does not build what these three would be:
  //
  //  * Planning applications (planning.data.gov.uk). The platform carries about
  //    100k applications, but the whole first page of 500 came from a single
  //    council, and Leeds, Birmingham, Bristol, Manchester, Sheffield and
  //    Liverpool each returned zero. The docs confirm councils are not required
  //    to publish application data to the spec.
  //  * New domains via Certificate Transparency. CT publishes certificates, not
  //    businesses: there is no free feed that answers "a plumber in Leeds just
  //    registered a domain", so any source built on it could only guess.
  //  * The UK food hygiene register (api.ratings.food.gov.uk) — free, keyless
  //    and national, and it was implemented and probed before being dropped: in
  //    a 100-entry sample from Leeds, 0 entries carried a usable phone number,
  //    and it publishes no websites. What it returns is name + address + type,
  //    which is a directory, not a lead — and a single web search cannot settle
  //    whether such a business has a website (a real Leeds chain at
  //    200degs.com was missed, while a genuine site was found for another).
  //    That is not strong enough to put a row inside a filter that promises
  //    "no website", so it is not offered.
};

/** The sources the picker offers today, in the order it offers them. */
export const ACTIVE_SOURCES: SourceId[] = ["web", "osm", "companies_house"];

export function sourceLabel(id: string): string {
  return SOURCE_META[id as SourceId]?.label ?? id;
}

export function isSourceId(value: unknown): value is SourceId {
  return typeof value === "string" && value in SOURCE_META;
}

/**
 * A source that cannot tell you a business's website cannot serve the filters
 * that promise an audit of one: "has a website" and "outdated or broken site"
 * both mean every row has a site we graded. It belongs in the No website
 * search, where the route establishes the claim itself before showing a row.
 *
 * This lives here rather than with the registry so the rule can be tested
 * without pulling in the network clients — it is a rule about metadata.
 */
export function sourceFitsFilter(source: SourceMeta, filter: string): boolean {
  if (source.gives.website) return true;
  return filter === "without";
}

export function sourceFilterMessage(source: SourceMeta): string {
  return `${source.label} lists businesses with no website, so it works with the No website filter — switch the filter, or pick another source.`;
}

/**
 * Everything wrong with the source inventory, given the ids that actually have
 * an implementation. The registry throws on a non-empty result at import, so a
 * source can never be advertised to a user and then fail at search time — and
 * the rules are testable because this function is pure.
 */
export function inventoryProblems(implemented: SourceId[]): string[] {
  const problems: string[] = [];
  const labels = new Map<string, string>();

  for (const id of ACTIVE_SOURCES) {
    const meta = SOURCE_META[id];
    if (!meta) {
      problems.push(`"${id}" is offered but has no metadata`);
      continue;
    }
    if (!implemented.includes(id)) problems.push(`"${id}" is offered but has no implementation`);
    if (meta.kind !== "discovery") {
      problems.push(`"${id}" is offered but is not a discovery source — it cannot find businesses`);
    }
    if (!meta.label.trim() || !meta.desc.trim()) {
      problems.push(`"${id}" has no label or description`);
    }
    if (meta.credential === "user") {
      if (!meta.keySetting) {
        problems.push(`"${id}" runs on the user's own key but names no settings field`);
      }
      if (meta.cost !== "key") {
        problems.push(`"${id}" runs on the user's own key but does not declare cost "key"`);
      }
      if (meta.envKey) {
        problems.push(`"${id}" runs on the user's own key and also names an instance env key`);
      }
    } else if (meta.credential === "instance") {
      if (!meta.envKey) {
        problems.push(`"${id}" runs on the deployment's key but names no environment variable`);
      }
      if (meta.keySetting) {
        problems.push(`"${id}" runs on the deployment's key and must not ask the user for one`);
      }
    } else if (meta.keySetting || meta.envKey) {
      problems.push(`"${id}" declares a key source but does not say whose key it is`);
    }
    if (meta.gives.website === false && meta.gives.contact === false && meta.legal === "ai_search") {
      problems.push(`"${id}" claims to give neither a website nor a contact`);
    }
  }

  for (const [id, meta] of Object.entries(SOURCE_META) as [SourceId, SourceMeta][]) {
    const previous = labels.get(meta.label);
    if (previous) problems.push(`"${id}" and "${previous}" share the label "${meta.label}"`);
    labels.set(meta.label, id);
  }

  return problems;
}
