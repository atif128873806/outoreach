import { test } from "node:test";
import assert from "node:assert/strict";

const {
  CAP_MESSAGE,
  JOB_RETENTION_DAYS,
  MAX_ACTIVE_JOBS_PER_USER,
  MAX_CONCURRENT_JOBS,
  capReached,
  describeJob,
  isActiveStatus,
  publicJob,
} = await import("../lib/search-jobs.ts");

/** A row as the database would hand it back, so the mapping is tested for real. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    user_id: 34,
    source: "osm",
    niche: "roofers",
    location: "Leeds, UK",
    filter: "any",
    count: 10,
    status: "done",
    lead_count: 6,
    error: "",
    created_at: "2026-09-29T10:00:00.000Z",
    started_at: "2026-09-29T10:00:01.000Z",
    finished_at: "2026-09-29T10:00:41.000Z",
    ...overrides,
  };
}

test("only waiting and in-flight count as active", () => {
  assert.equal(isActiveStatus("queued"), true);
  assert.equal(isActiveStatus("running"), true);
  // A finished search must not hold a queue slot, or the cap would be permanent.
  assert.equal(isActiveStatus("done"), false);
  assert.equal(isActiveStatus("failed"), false);
  // Anything unrecognised is not active: an unknown status must never wedge the
  // account out of searching again.
  assert.equal(isActiveStatus(""), false);
  assert.equal(isActiveStatus("cancelled"), false);
});

test("the queue cap refuses the next search, not the first ones", () => {
  assert.equal(capReached(0), false);
  assert.equal(capReached(MAX_ACTIVE_JOBS_PER_USER - 1), false);
  assert.equal(capReached(MAX_ACTIVE_JOBS_PER_USER), true);
  assert.equal(capReached(MAX_ACTIVE_JOBS_PER_USER + 3), true);
  // The cap is what stops one account spending the whole deployment's budgets.
  assert.ok(MAX_ACTIVE_JOBS_PER_USER >= 1 && MAX_ACTIVE_JOBS_PER_USER < 10);
  assert.ok(MAX_CONCURRENT_JOBS >= 1);
  assert.ok(JOB_RETENTION_DAYS >= 1);
  // The refusal has to name the number, or the user cannot act on it.
  assert.ok(CAP_MESSAGE.includes(String(MAX_ACTIVE_JOBS_PER_USER)));
});

test("a job is described by what was asked for", () => {
  assert.equal(describeJob({ niche: "roofers", location: "Leeds", filter: "any" }), "roofers in Leeds");
  // The default filter is noise; a real one is the difference between two
  // searches of the same niche and place.
  assert.equal(
    describeJob({ niche: "roofers", location: "Leeds", filter: "outdated" }),
    "roofers in Leeds · outdated"
  );
  assert.equal(describeJob({ niche: "", location: "", filter: "any" }), "(no niche) in (no location)");
});

test("a public job is camelCase, ISO, and free of the user's id", () => {
  const job = publicJob(row());
  assert.deepEqual(job, {
    id: 7,
    source: "osm",
    niche: "roofers",
    location: "Leeds, UK",
    filter: "any",
    count: 10,
    status: "done",
    leadCount: 6,
    error: "",
    createdAt: "2026-09-29T10:00:00.000Z",
    startedAt: "2026-09-29T10:00:01.000Z",
    finishedAt: "2026-09-29T10:00:41.000Z",
  });
  assert.ok(!("user_id" in job) && !("userId" in job));
});

test("a queued job reports no times and no counts", () => {
  const job = publicJob(row({ status: "queued", lead_count: 0, started_at: null, finished_at: null }));
  assert.equal(job.status, "queued");
  assert.equal(job.startedAt, null);
  assert.equal(job.finishedAt, null);
  assert.equal(job.leadCount, 0);
  assert.equal(job.error, "");
});

test("numbers arrive as numbers even when the driver hands back strings", () => {
  // PGlite and Postgres disagree about what a COUNT returns; the client must not
  // have to care.
  const job = publicJob(row({ id: "12", count: "20", lead_count: "8" }));
  assert.equal(job.id, 12);
  assert.equal(job.count, 20);
  assert.equal(job.leadCount, 8);
});

test("an unreadable created_at falls back to now rather than to 1970", () => {
  const before = Date.now();
  const job = publicJob(row({ created_at: null }));
  const at = Date.parse(job.createdAt);
  assert.ok(Number.isFinite(at) && at >= before - 1000);
  // The other two are honest nulls: an unknown start or finish is not a date.
  assert.equal(publicJob(row({ started_at: "not a date" })).startedAt, null);
  // A Date object from the driver becomes an ISO string, like a string did.
  assert.equal(
    publicJob(row({ created_at: new Date("2026-09-29T10:00:00.000Z") })).createdAt,
    "2026-09-29T10:00:00.000Z"
  );
});
