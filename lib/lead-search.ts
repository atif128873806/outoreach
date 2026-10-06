/**
 * The lead search itself: one niche, one place, in and out.
 *
 * This used to be the body of `POST /api/leads`. It moved here when searches
 * became asynchronous, because two different callers now have to run it — the
 * HTTP route (which validates and queues) and the worker (which picks a job up
 * and executes it). Keeping one implementation is the whole point: a queued
 * search and any future synchronous one must apply the same quota, the same
 * plan gating, the same locality gate and the same audit, or the queue quietly
 * becomes a way around the paywall.
 *
 * It returns a value rather than a `NextResponse`, and it does not log: the
 * caller owns the HTTP status and the activity-log line, because only the caller
 * knows whether this was a queued search, a retry, or a direct request. What it
 * checks is quota eligibility. The queue atomically meters and publishes the
 * final results; callers must not deliver this unmetered intermediate value.
 */

import { enrichLeads, geocodePoint, withSiteNotes, type Lead } from "./leads";
import { isRedesignProspect } from "./siteaudit";
import {
  classifyLocality,
  countryConflict,
  inferCountryFromAddresses,
  withinLocalRadius,
  locationTerms,
  type LocationTerms,
} from "./geo";
import { findOfflineContact } from "./exa";
import {
  SourceSetupError,
  getSource,
  offeredSources,
  requireSource,
  sourceFitsFilter,
  sourceFilterMessage,
  sourceUnlocked,
  sourceUpgradeMessage,
} from "./sources";
import { getSettings } from "./settings";
import { getLeadQuota, leadQuotaMessage } from "./usage";
import { filterUpgradeMessage, normalizeFilter, planAllowsFilter } from "./plans";
import { q } from "./db";
import { friendlyProviderError } from "./friendly-error";
import { pruneSearchCache } from "./search-cache";

export interface LeadSearchParams {
  source: string;
  niche: string;
  location: string;
  count: number;
  /** "any" (default) | "with" | "without" | "outdated" */
  websiteFilter: string;
}

export interface LeadSearchMeta {
  found: number;
  withEmail: number;
  withInstagram: number;
  withPhone: number;
  sitesAudited: number;
  needsWork: number;
  skippedExisting: number;
  outOfArea: number;
  quota: { plan: string; limit: number | null; remaining: number | null };
}

export type LeadSearchResult =
  | {
      ok: true;
      leads: Lead[];
      note?: string;
      meta: LeadSearchMeta;
      /** One line for the activity log: what this search cost and what it found. */
      detail: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      /**
       * Whether the user was refused (quota, plan, a bad request — a 4xx they can
       * act on) or the search itself broke (a 5xx). The activity log counts these
       * differently, and guessing between them from the status code at the call
       * site is how a log starts lying.
       */
      outcome: "rejected" | "error";
    };

export async function runLeadSearch(
  userId: number,
  params: LeadSearchParams
): Promise<LeadSearchResult> {
  const websiteFilter = normalizeFilter(params.websiteFilter);
  const niche = params.niche?.trim();
  const location = params.location?.trim();

  // Plan quota: each returned lead counts against the monthly allowance. Checked
  // here as well as at enqueue, because a queued job can wait behind others and
  // the month can turn over (or another search can spend the remainder) in the
  // meantime.
  const quota = await getLeadQuota(userId);
  if (quota.remaining !== null && quota.remaining <= 0) {
    return { ok: false, status: 403, error: leadQuotaMessage(quota), outcome: "rejected" };
  }

  // The filters are the paid dial, so the plan is enforced here and not only in
  // the UI — a crafted request must not unlock a tier's search for free.
  if (!planAllowsFilter(quota.plan, websiteFilter)) {
    return {
      ok: false,
      status: 403,
      error: filterUpgradeMessage(quota.plan, websiteFilter),
      outcome: "rejected",
    };
  }

  let count = Math.min(50, Math.max(1, params.count ?? 10));
  if (quota.remaining !== null) count = Math.min(count, quota.remaining);

  // The source is looked up in the registry, never pattern-matched here — an
  // unknown id is refused rather than quietly swapped for web search.
  const chosen = getSource(params.source ?? "web");
  if (!chosen) {
    return {
      ok: false,
      status: 400,
      error: `Unknown search source. Pick one of: ${offeredSources()
        .map((s) => s.label)
        .join(", ")}`,
      outcome: "rejected",
    };
  }
  if (!sourceUnlocked(quota.plan.id, chosen)) {
    return { ok: false, status: 403, error: sourceUpgradeMessage(chosen), outcome: "rejected" };
  }
  if (!sourceFitsFilter(chosen, websiteFilter)) {
    return { ok: false, status: 400, error: sourceFilterMessage(chosen), outcome: "rejected" };
  }
  if (!niche) {
    return {
      ok: false,
      status: 400,
      error: "Enter a niche (e.g. restaurants, dentists)",
      outcome: "rejected",
    };
  }
  if (!location) {
    return {
      ok: false,
      status: 400,
      error: "Enter a location (e.g. Lahore, Pakistan)",
      outcome: "rejected",
    };
  }

  try {
    // How many candidates this search can actually use. Enrichment is the
    // expensive part — one website probe and audit per lead — so the web source
    // is asked for exactly this many and no more; anything beyond it would be
    // retrieved only to be sliced away. The margin over `count` absorbs the
    // leads that drop out later: already in Contacts, out of area, and in
    // outdated mode the sites that turn out to be modern after all.
    const candidateBudget = websiteFilter === "outdated" ? count + 15 : count + 10;

    const settings = await getSettings(userId);

    let leads: Lead[];
    if (websiteFilter === "without" && !chosen.gives.website) {
      // A source that publishes no websites — the food register, say — is what
      // the user picked, so it is what they get; the contact hunt below then
      // establishes whether each business really has no site.
      leads = await chosen.search({ niche, location, count, needed: candidateBudget, settings });
    } else if (websiteFilter === "without") {
      // Otherwise the offline pipeline uses map data, because web search can't
      // find businesses that aren't on the web. OpenStreetMap is keyless and
      // carries a website field for the businesses that have one, which is what
      // this filter is built on. (Google Places used to be merged in here for
      // better phone coverage, at the cost of asking every user for a Cloud
      // key — see the note in lib/sources/meta.ts.)
      leads = await requireSource("osm").search({
        niche,
        location,
        count: Math.max(count, 20),
        needed: candidateBudget,
        settings,
      });
    } else {
      leads = await chosen.search({ niche, location, count, needed: candidateBudget, settings });
      if (websiteFilter === "with" || websiteFilter === "outdated") {
        leads = leads.filter((l) => l.website);
      }
    }

    // Location gate, applied BEFORE any enrichment: a business whose own address
    // names a different place must not cost a website probe, an audit, or — in
    // offline mode — one web search of its own.
    //
    // This runs on the parsed records rather than in the query on purpose. The
    // web source retrieves pages, and a practice in Ohio whose page text mentions
    // Austin matches "dentist in Austin, USA" perfectly well; asking the
    // retriever to exclude it was measured to change nothing.
    const terms = locationTerms(location);
    // The market decides how every phone number in this list is read, and the
    // location box frequently doesn't name one — people type "Leeds", not
    // "Leeds, UK". Left unknown, the UK trunk 0 is never repaired and a
    // truncated number passes a digit count: the same lead, from the same
    // source, one minute apart, arrived as "113 275 262" for "Leeds" and as the
    // business's own "0113 275 2620" for "Leeds, UK". So when the box is silent
    // the addresses we just found are asked instead, and nothing is assumed
    // when they disagree.
    if (terms.country === null) {
      const inferred = inferCountryFromAddresses(leads.map((l) => l.address));
      if (inferred) terms.country = inferred;
    }
    const dropped = leads.filter(
      (l) => classifyLocality(l.address, terms) === "elsewhere" || countryConflict(l.address, terms)
    );
    const droppedSet = new Set(dropped);
    let candidates = leads.filter((l) => !droppedSet.has(l));
    let outOfArea = dropped.length;
    let localityUnconfirmed = false;
    // How many sites we actually looked at, which is not the same as how many
    // survived the filter. On a 40-lead "outdated" search only 7 of the 48
    // local roofers met the bar, and saying "7 of the sites audited" read as if
    // seven had been audited — the number that explains the shortfall is the
    // size of what it was drawn from.
    let sitesAudited = 0;
    if (dropped.length > 0) {
      const rescued = await verifyDropped(dropped, location, terms);
      if (rescued.size > 0) {
        candidates = candidates.concat([...rescued]);
        outOfArea -= rescued.size;
      }
    }
    if (leads.length > 0 && candidates.length === 0) {
      // Fail open. If the rule would remove every result, the likelier
      // explanation is a location we can't match (a state, a region, a city the
      // addresses spell differently) than that every business found is out of
      // area. An empty list would teach the user nothing; show them, flagged.
      candidates = leads;
      outOfArea = 0;
      localityUnconfirmed = true;
    }

    if (candidates.length === 0) {
      // Nothing came back for this niche + place, or nothing local in it. The
      // most actionable row in the whole log: it names the searches where the
      // product failed to answer.
      return {
        ok: true,
        leads: [],
        meta: {
          found: 0,
          withEmail: 0,
          withInstagram: 0,
          withPhone: 0,
          sitesAudited: 0,
          needsWork: 0,
          skippedExisting: 0,
          outOfArea: 0,
          quota: { plan: quota.plan.id, limit: quota.limit, remaining: quota.remaining },
        },
        detail:
          leads.length === 0
            ? "no businesses from the source"
            : `${leads.length} found, none in ${terms.label}`,
        note:
          websiteFilter === "without"
            ? `No businesses without a website found here. ${chosen.gives.website ? "OpenStreetMap is the best source for offline businesses" : `${chosen.label} lists no websites, but every business it returned turned out to have one`} — or try a bigger area.`
            : websiteFilter === "outdated"
              ? "No businesses with websites found for this search — try a broader niche or bigger area, then the audit can look for outdated sites."
              : "No businesses found. Try a broader niche (e.g. 'restaurant' instead of 'vegan bistro') or a bigger location.",
      };
    }

    let enriched: Lead[];
    let droppedWithSite = 0;
    if (websiteFilter === "without") {
      // No site to visit — instead, hunt each business's public footprint on
      // the web. Offline businesses usually DO have an Instagram page or a
      // directory listing with a phone; one targeted search per business
      // turns "name and address only" into an actually reachable lead.
      //
      // A source that publishes no websites cannot tell us whether a business
      // *has* one, and this filter's whole promise is that they don't. So for
      // those leads the same lookup also settles the website question, and a
      // business with a site is left out rather than mis-sold as a redesign of
      // nothing.
      const verifyWebsite = !chosen.gives.website;
      const pool = candidates.slice(0, Math.min(candidates.length, count + 8));
      const CONCURRENCY = 4;
      for (let i = 0; i < pool.length; i += CONCURRENCY) {
        await Promise.all(
          pool.slice(i, i + CONCURRENCY).map(async (l) => {
            if (!verifyWebsite && l.instagram && l.phone) return; // already reachable
            const found = await findOfflineContact(l.business_name, location, {
              // The market, not just the phone rule: a page that places the
              // business in another country cannot speak for it.
              country: terms.country,
            });
            if (!l.instagram) l.instagram = found.instagram;
            if (!l.phone) l.phone = found.phone;
            if (!l.email) l.email = found.email;
            if (!l.website) l.website = found.website;
          })
        );
      }
      const offlinePool = pool.filter((l) => !l.website);
      droppedWithSite = pool.length - offlinePool.length;
      enriched = offlinePool;
    } else {
      enriched = await enrichLeads(
        candidates.slice(0, Math.min(candidates.length, candidateBudget)),
        5,
        websiteFilter === "outdated",
        // A UK search repairs the trunk 0 on numbers found on the page; a US
        // one must never have that done to it.
        { uk: terms.country === "GB" }
      );
      sitesAudited = enriched.filter((l) => l.site_audit).length;
      if (websiteFilter === "outdated") {
        // Keep only sites with at least one serious, concrete defect. The
        // audit's own precision rule decides — a missing meta description is
        // never sold to a prospect as "your website is broken".
        enriched = enriched.filter((l) => isRedesignProspect(l.site_audit));
      }
      // The audit is the deliverable: every lead carries its score and the
      // findings behind it, written into notes as talking points ("your site
      // returns an HTTP 500", "it isn't mobile-friendly").
      for (const l of enriched) {
        const audit = l.site_audit;
        // When the audit proves the address we were handed is broken while the
        // site itself answers at its www address, hand over the one that opens.
        // A lead whose link warns 'your connection is not private' is worse
        // than useless to someone who is about to pitch the business.
        if (
          l.website &&
          audit?.facts.httpsAlt &&
          audit.facts.host &&
          !audit.facts.host.startsWith("www.")
        ) {
          l.website = `https://www.${audit.facts.host}/`;
        }
        // The audit and tech sentences are rewritten from the audit the lead
        // actually carries, never appended blindly — the same function a
        // re-check uses, so the two paths can't drift apart (lib/leads.ts).
        l.notes = withSiteNotes(l);
      }
    }

    // An address that two different businesses appear to publish is not either
    // business's address: it belongs to whoever prints it on both pages — a
    // directory, a formation agent, an accountant. Attribution got this wrong
    // before (one directory's own site-wide address reached nine leads in a
    // single test run), and a wrong address costs the user the prospect
    // outright, because a first email that bounces is a first impression they
    // never get back. The contact hunt now refuses such pages at the source;
    // this is the search refusing what it can see for itself, whatever a source
    // handed it.
    let sharedEmailsDropped = 0;
    if (websiteFilter === "without") {
      const claimants = new Map<string, Set<string>>();
      for (const l of enriched) {
        if (!l.email) continue;
        const key = l.email.toLowerCase();
        const names = claimants.get(key) ?? new Set<string>();
        names.add(l.business_name.toLowerCase());
        claimants.set(key, names);
      }
      for (const l of enriched) {
        if (!l.email) continue;
        if ((claimants.get(l.email.toLowerCase())?.size ?? 0) > 1) {
          l.email = "";
          sharedEmailsDropped++;
        }
      }
    }

    // Hide leads that are already in this user's Contacts (matched by email,
    // website host, or — for no-email offline contacts — business name) so a
    // re-run doesn't show old finds or charge quota for them.
    const existing = await q<{ email: string; website: string; business_name: string }>(
      "SELECT email, website, business_name FROM contacts WHERE user_id = $1",
      [userId]
    );
    const knownEmails = new Set(existing.map((c) => c.email.toLowerCase()));
    const host = (u: string) =>
      u.toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split("/")[0];
    const knownHosts = new Set(existing.filter((c) => c.website).map((c) => host(c.website)));
    const knownNames = new Set(
      existing.filter((c) => !c.email && c.business_name).map((c) => c.business_name.toLowerCase())
    );
    const fresh = enriched.filter(
      (l) =>
        !(l.email && knownEmails.has(l.email.toLowerCase())) &&
        !(l.website && knownHosts.has(host(l.website))) &&
        !(l.business_name && knownNames.has(l.business_name.toLowerCase()))
    );
    const skippedExisting = enriched.length - fresh.length;

    // The location gate already ran, so everything here is in the requested
    // place (or unreadable, which is never held against a lead).
    //
    // Most reachable first, then trim to the requested amount. Offline mode
    // ranks Instagram highest (DM campaigns work without an email address).
    fresh.sort((a, b) => {
      const score = (l: (typeof fresh)[number]) =>
        websiteFilter === "without"
          ? Number(Boolean(l.instagram)) * 4 + Number(Boolean(l.email)) * 2 + Number(Boolean(l.phone))
          : websiteFilter === "outdated"
            ? // Worst sites first — that's the entire point of this search.
              (100 - (l.site_audit?.score ?? 100)) + Number(Boolean(l.email)) * 2
            : Number(Boolean(l.email)) * 2 + Number(Boolean(l.instagram));
      return score(b) - score(a);
    });
    const result = fresh.slice(0, count);

    // The worker meters these results atomically with durable job completion.
    const remaining =
      quota.remaining === null ? null : Math.max(0, quota.remaining - result.length);

    // Be honest when we deliver fewer than asked — and say why.
    const notes: string[] = [];
    if (skippedExisting > 0) {
      notes.push(
        `${skippedExisting} result${skippedExisting > 1 ? "s" : ""} already in your Contacts ${skippedExisting > 1 ? "were" : "was"} hidden (not counted against your quota).`
      );
    }
    if (droppedWithSite > 0) {
      notes.push(
        `${droppedWithSite} of these ${droppedWithSite === 1 ? "business has" : "businesses have"} a website after all and ${droppedWithSite === 1 ? "was" : "were"} left out — this filter only answers with businesses that don't.`
      );
    }
    if (outOfArea > 0) {
      notes.push(
        `${outOfArea} result${outOfArea === 1 ? " wasn't" : "s weren't"} in ${terms.label} and ${outOfArea === 1 ? "was" : "were"} left out, so every row here is a business in or around ${terms.label}.`
      );
    }
    if (localityUnconfirmed) {
      notes.push(
        `Couldn't confirm from the addresses that these businesses are in ${terms.label} — showing them anyway. Check the address before you reach out.`
      );
    }
    if (result.length < count) {
      notes.push(
        websiteFilter === "outdated"
          ? `${result.length} of the ${sitesAudited} local sites we checked had a serious problem — the rest cleared the checks we ran (their audits are in "Any business" if you want to see them). Only so many businesses in one city have a site that genuinely needs work, so try a nearby city or a broader niche for more.`
          : `Found ${result.length} new ${result.length === 1 ? "match" : "matches"} for this search — sources have limits per area. ${
              offeredSources().some((s) => s.id !== chosen.id)
                ? `Try a different source (${offeredSources()
                    .filter((s) => s.id !== chosen.id)
                    .map((s) => s.label)
                    .join(", ")}), a broader niche, or a nearby city for more.`
                : "Try a broader niche or a nearby city for more."
            }`
      );
    }
    if ((websiteFilter === "outdated" || websiteFilter === "with") && result.length > 0) {
      notes.push(
        "Each lead's notes carry its website audit — the score and exactly what's wrong — so you can open with a specific, checkable observation."
      );
    }
    if (sharedEmailsDropped > 0) {
      notes.push(
        `${sharedEmailsDropped} address${sharedEmailsDropped > 1 ? "es" : ""} appeared under more than one business here and ${sharedEmailsDropped > 1 ? "were" : "was"} dropped, because an address two businesses seem to share belongs to a directory rather than to either of them.`
      );
    }
    if (websiteFilter === "without" && result.length > 0) {
      notes.push(
        "These businesses have no website — prime prospects for web and digital services. Most publish no email either, so work them by phone, by the person named in the notes, or at the address shown."
      );
    }

    // Opportunistic housekeeping (~2% of searches): expired cache rows go, and
    // the log is trimmed only if it has grown beyond anything real use could
    // produce. Cheaper and more predictable than a scheduled job of its own.
    // It lives here rather than in the route so that queued searches do it too.
    if (Math.random() < 0.02) void pruneSearchCache();

    return {
      ok: true,
      leads: result,
      note: notes.length ? notes.join(" ") : undefined,
      detail: `${sitesAudited} sites audited, ${outOfArea} out of area, ${skippedExisting} already saved, ${result.filter((l) => l.email).length} with email`,
      meta: {
        found: result.length,
        withEmail: result.filter((l) => l.email).length,
        withInstagram: result.filter((l) => l.instagram).length,
        withPhone: result.filter((l) => l.phone).length,
        sitesAudited: result.filter((l) => l.site_audit).length,
        needsWork: result.filter((l) => isRedesignProspect(l.site_audit)).length,
        skippedExisting,
        outOfArea,
        quota: { plan: quota.plan.id, limit: quota.limit, remaining },
      },
    };
  } catch (err) {
    // A source that needs an API key is a setup problem the user can fix.
    if (err instanceof SourceSetupError) {
      return { ok: false, status: 400, error: err.message, outcome: "rejected" };
    }
    return {
      ok: false,
      status: 500,
      error: friendlyProviderError(err, "search"),
      outcome: "error",
    };
  }
}

/** How many dropped candidates are worth a geocoder lookup per search. */
const LOOKUP_CAP = 8;

/**
 * Second opinion for the leads the word rule would drop.
 *
 * The rule compares names, and names run out exactly where local business data
 * is messiest: a Manchester roofer whose profile reads "Openshaw, United
 * Kingdom" shares not one word with "Manchester, UK", so it was thrown away —
 * from Openshaw, five kilometres from the city centre, with a working email.
 * That loss is invisible and permanent, which is the failure this whole gate
 * exists to avoid. So before dropping a lead, place the request and the lead on
 * a map and measure.
 *
 * The country check runs first: it needs no network, and it catches the error
 * the word rule makes in the other direction — "Manchester, United States"
 * shares a word with a search for Manchester, UK and would sail through as a
 * local lead 5,000 km away.
 */
async function verifyDropped(
  dropped: Lead[],
  location: string,
  terms: LocationTerms
): Promise<Set<Lead>> {
  const kept = new Set<Lead>();
  const origin = await geocodePoint(location);
  if (!origin) return kept; // geocoder unavailable — the stricter verdict stands
  let lookups = 0;
  for (const lead of dropped) {
    if (lookups >= LOOKUP_CAP) break;
    if (countryConflict(lead.address, terms)) continue; // names another country outright
    lookups++;
    const point = await geocodePoint(lead.address);
    if (withinLocalRadius(origin, point)) kept.add(lead);
  }
  return kept;
}
