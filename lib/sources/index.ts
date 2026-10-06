/**
 * The lead source registry.
 *
 * Every way this product can find a business lives here as one function with a
 * uniform signature. The search route asks for a source by id and calls it —
 * it does not know, and must not learn, how any individual source works. Adding
 * a source is: one entry in lib/sources/meta.ts, one `search` function below,
 * and the picker updates itself.
 *
 * Records that report neither a website nor a contact are that source's
 * business: a planning application is a property, not a company, and it earns
 * its keep during enrichment. Sources that claim to hand back a website or a
 * contact must actually do so — see `inventoryProblems` in meta.ts.
 */

import { searchOsm, type Lead } from "../leads";
import { searchExaCompanies } from "../exa";
import { CompaniesHouseError, searchCompaniesHouse } from "../companieshouse";
import type { Settings } from "../settings";
import { cached, sourceKey, sourceTtl } from "../search-cache";
import {
  ACTIVE_SOURCES,
  SOURCE_META,
  inventoryProblems,
  isSourceId,
  type SourceId,
  type SourceMeta,
} from "./meta";

export {
  SOURCE_META,
  ACTIVE_SOURCES,
  sourceLabel,
  isSourceId,
  sourceFitsFilter,
  sourceFilterMessage,
} from "./meta";
export type { SourceId, SourceMeta } from "./meta";

/**
 * A source cannot run without something the user hasn't given it (an API key,
 * most often). The route turns this into a 400 with the message, because it is
 * a setup problem the user can fix, not a server failure.
 */
export class SourceSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceSetupError";
  }
}

export interface SourceRequest {
  niche: string;
  location: string;
  /** What the user asked for — map sources return roughly this many records. */
  count: number;
  /**
   * How many businesses this search can actually put to use (its enrichment
   * window). Sources whose output is filtered afterwards — by locality, by
   * website — must be asked for this many, not `count`.
   */
  needed: number;
  settings: Settings;
}

export interface LeadSource extends SourceMeta {
  search(req: SourceRequest): Promise<Lead[]>;
}

type SourceSearch = (req: SourceRequest) => Promise<Lead[]>;

/**
 * The sources that actually fetch something today. A source is only offered in
 * the UI once it has an implementation here — the guard below enforces it.
 */
const IMPLEMENTATIONS: Partial<Record<SourceId, SourceSearch>> = {
  web: ({ niche, location, needed }) => searchExaCompanies(niche, location, needed),

  osm: ({ niche, location, count }) => searchOsm(niche, location, count),

  companies_house: async ({ niche, location, needed }) => {
    // The deployment's key, never the user's: see `credential` in meta.ts. A
    // customer is never asked to sign up for the register, and an instance key
    // can't be shadowed by a stale personal one.
    const key = instanceKey(SOURCE_META.companies_house);
    if (!key) {
      throw new SourceSetupError(
        "Companies House isn't configured on this deployment — it needs COMPANIES_HOUSE_API_KEY set in the environment. Pick another source meanwhile."
      );
    }
    try {
      return await searchCompaniesHouse(niche, location, needed, key);
    } catch (err) {
      // A rejected key, a location the register doesn't cover, or a tripped
      // rate limit: all things the user can act on, so they travel as a setup
      // error — a 400 carrying the message — instead of a 500.
      if (err instanceof CompaniesHouseError) throw new SourceSetupError(err.message);
      throw err;
    }
  },
};

// Fail loudly at import if a source is advertised without an implementation,
// names a settings field that doesn't exist, or duplicates another's label.
// Crashing on boot beats a 500 on a user's search.
{
  const problems = inventoryProblems(Object.keys(IMPLEMENTATIONS) as SourceId[]);
  if (problems.length > 0) {
    throw new Error(`Lead source inventory is inconsistent:\n- ${problems.join("\n- ")}`);
  }
}

/**
 * Wraps a source so its answer for one niche + place is fetched once and then
 * served from the cache (see lib/search-cache.ts).
 *
 * This is deliberately applied here, at the registry, rather than in the route:
 * every source a user can pick inherits it, including the next one added, and
 * no source implementation has to know it exists. It is also a licence matter
 * rather than a pure optimization — Overpass mirrors and the register both run
 * on deployment-wide budgets, and Nominatim's policy requires cached results.
 *
 * The TTL is per source (`sourceTtl`): a directory that changes slowly is
 * cached longer than the register, which publishes new companies every working
 * day.
 *
 * A stored answer is reused when it covers what the *user* asked for (`count`),
 * not the larger enrichment budget the pipeline pads a request with (`needed`).
 * The padding exists to absorb drop-outs — already-saved contacts, out-of-area
 * businesses, sites that turn out to be modern after all — so falling short of
 * it costs a few results the route already explains, while re-asking costs a
 * round trip to the flakiest dependency in the product. Measured: this rule is
 * the difference between a repeat search taking 40 ms and taking 40 seconds on a
 * day the Overpass mirrors are busy.
 */
function cachedSearch(id: SourceId, search: SourceSearch): SourceSearch {
  return async (req) => {
    const answer = await cached<{ leads: Lead[]; requested: number }>(
      {
        key: sourceKey(id, req.niche, req.location, req.needed),
        kind: "source",
        ttlSeconds: sourceTtl(id),
        usable: (hit) => hit.requested >= req.count,
      },
      async () => ({ leads: await search(req), requested: req.needed })
    );
    return answer.leads;
  };
}

export const SOURCES: Partial<Record<SourceId, LeadSource>> = Object.fromEntries(
  (Object.entries(IMPLEMENTATIONS) as [SourceId, SourceSearch][]).map(([id, search]) => [
    id,
    { ...SOURCE_META[id], search: cachedSearch(id, search) },
  ])
) as Partial<Record<SourceId, LeadSource>>;

/**
 * The deployment's key for a source it runs on behalf of every customer, or "".
 *
 * Read from the environment only. A key the operator holds must not be
 * overridable per user: one customer pasting a stale key would break the source
 * for themselves in a way nobody can see from the outside.
 */
export function instanceKey(meta: SourceMeta): string {
  return (meta.envKey ? process.env[meta.envKey] : "")?.trim() ?? "";
}

/**
 * Can this source run here at all?
 *
 * A source the deployment is supposed to key but hasn't is not offered, because
 * offering it means a user clicks it and gets an error that is not their fault.
 * A user-keyed source is always "ready" in this sense — whether the customer has
 * pasted their key is their own business, and the source tells them so when it
 * is missing.
 */
export function sourceReady(meta: SourceMeta): boolean {
  return meta.credential === "instance" ? Boolean(instanceKey(meta)) : true;
}

/** The selectable sources, in picker order — the ones that can actually run here. */
export function offeredSources(): LeadSource[] {
  return ACTIVE_SOURCES.map((id) => SOURCES[id])
    .filter((s): s is LeadSource => Boolean(s))
    .filter(sourceReady);
}

/** A known, offered source — or null. Never silently substitutes another one. */
export function getSource(id: unknown): LeadSource | null {
  if (!isSourceId(id)) return null;
  const source = SOURCES[id];
  return source?.available ? source : null;
}

/** Same as getSource, but throws — for sources the route needs by name. */
export function requireSource(id: SourceId): LeadSource {
  const source = getSource(id);
  if (!source) throw new SourceSetupError(`The ${id} source is not available yet`);
  return source;
}

/**
 * Sources are part of the product's paid surface, so gating lives here rather
 * than being sprinkled through the route.
 */
export function sourceUnlocked(plan: string, source: LeadSource): boolean {
  if (source.plan === "free") return true;
  if (source.plan === "starter") return plan === "starter" || plan === "pro";
  return plan === "pro";
}

export function sourceUpgradeMessage(source: LeadSource): string {
  return `The ${source.label} source needs the ${source.plan} plan — upgrade in Billing, or pick another source.`;
}

/** Names of every source on the roadmap, for the settings/roadmap surfaces. */
export function declaredSources(): SourceMeta[] {
  return Object.values(SOURCE_META);
}
