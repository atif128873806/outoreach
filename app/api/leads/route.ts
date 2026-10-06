import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { normalizeFilter } from "@/lib/plans";
import { enqueueSearchJob } from "@/lib/search-jobs";
import { pumpSearchJobs } from "@/lib/search-jobs";
import { recordSearchEvent } from "@/lib/search-cache";

export const runtime = "nodejs";

/**
 * Queues a lead search and answers immediately.
 *
 * It used to run the search inside this request, which is why the search screen
 * felt broken: a cold search takes a minute — a source fetch, a locality check,
 * a website probe and an audit per business — and the browser simply waited. Now
 * the request stores a job (see lib/search-jobs.ts) and returns 202, the worker
 * runs it, and the UI polls `GET /api/leads/jobs/{id}`. The user can queue
 * another search while the first one runs, which was the point.
 *
 * **This route no longer applies the product's rules.** Quota, plan gating,
 * source availability and the locality gate all live in `runLeadSearch`
 * (lib/lead-search.ts), which the worker calls — one implementation, so a queued
 * search and a direct one cannot disagree, and a queue cannot become a way
 * around the paywall. All that is checked here is the request's own shape and
 * the per-account queue cap, because neither is worth a database row.
 *
 * A refusal here is still a search attempt, and is logged as one: "asked for a
 * search and was refused" is exactly the drop-off the activity log exists to
 * capture. A search that gets queued is logged when it finishes, with its real
 * outcome, latency and cache hits.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await req.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      ["source", "niche", "location", "websiteFilter"].some(key => parsed[key] != null && typeof parsed[key] !== "string") ||
      (parsed.count != null && !Number.isFinite(parsed.count))) {
    return NextResponse.json({ error: "Invalid search fields" }, { status: 400 });
  }
  const body = parsed as {
    source?: string;
    niche?: string;
    location?: string;
    count?: number;
    /** "any" (default) | "with" | "without" | "outdated" */
    websiteFilter?: string;
  };
  const websiteFilter = normalizeFilter(body.websiteFilter);

  const logRefusal = (detail: string, returned = 0) =>
    recordSearchEvent({
      stage: "queue-admission",
      userId,
      niche: body.niche?.trim() ?? "",
      location: body.location?.trim() ?? "",
      source: body.source ?? "",
      filter: websiteFilter,
      requested: Math.min(50, Math.max(1, body.count ?? 10)),
      returned,
      cacheHits: 0,
      cacheMisses: 0,
      latencyMs: Date.now() - startedAt,
      outcome: "rejected",
      detail,
    });

  // Lead searches hit free third-party services — keep the pace neighborly.
  // The queue absorbs the waiting, so this is only about not hammering anyone.
  if (!rateLimit(`leads:${clientIp(req)}`, 10, 60_000)) {
    await logRefusal("rate limited");
    return NextResponse.json(
      { error: "Too many searches — wait a minute and try again" },
      { status: 429 }
    );
  }

  const queued = await enqueueSearchJob(userId, {
    source: body.source ?? "web",
    niche: body.niche ?? "",
    location: body.location ?? "",
    count: body.count ?? 10,
    filter: websiteFilter,
  });

  if (!queued.ok || !queued.job) {
    await logRefusal(queued.error ?? "could not queue the search");
    return NextResponse.json({ error: queued.error }, { status: queued.status ?? 400 });
  }

  // Start it now rather than at the next tick. The queue is what makes a busy
  // deployment fair; the first search of the day should not wait ten seconds for
  // a scheduler to notice it. Deliberately not awaited: this request is done, and
  // the job's outcome belongs to the job's row.
  void pumpSearchJobs();

  return NextResponse.json({ job: queued.job }, { status: 202 });
}
