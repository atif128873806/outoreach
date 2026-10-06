import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRelativeTs } from "./helpers/resolve-ts.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Resolve the app's extensionless TS imports without starting Next or workers.
// All persistence uses a new temporary directory; never the repository DB/env.
const originalCwd = process.cwd();
const originalUrl = process.env.DATABASE_URL;
const temp = mkdtempSync(path.join(tmpdir(), "outreach-search-test-"));
process.chdir(temp);
delete process.env.DATABASE_URL;
const hooks = resolveRelativeTs();
const { getDb, q, q1 } = await import("../lib/db.ts");
const { enqueueSearchJob, claimNextJob, finishSearchJob, recoverSearchJobs, jobResult } = await import("../lib/search-jobs.ts");
const { consumeLeadQuota } = await import("../lib/usage.ts");
const { cachedWithMeta, clearMemoryCache, searchCacheStats, withSearchTrace, sourceKey, sourceTtl } = await import("../lib/search-cache.ts");
const { recordSearchAction, searchFollowThrough } = await import("../lib/search-actions.ts");
const db = await getDb();
await test("isolated persistent search lifecycle", async (t) => {
t.after(() => { hooks.deregister(); process.chdir(originalCwd);
  if (originalUrl == null) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
  rmSync(temp, { recursive: true, force: true }); });
const user = async (name: string) => (await q1<{ id: number }>(
  "INSERT INTO users(email,password_hash) VALUES ($1,'test-only') RETURNING id", [`${name}@example.test`]))!.id;
const params = { source: "web", niche: "dentists", location: "London, UK", filter: "any", count: 10 };

await t.test("standalone PGlite writes cannot join a transaction that rolls back", async () => {
  let enter!: () => void; let release!: () => void;
  const entered = new Promise<void>(r => { enter = r; });
  const blocked = new Promise<void>(r => { release = r; });
  const failed = db.transaction(async tx => {
    await tx.query("INSERT INTO users(email,password_hash) VALUES ('rolled@example.test','test')");
    enter(); await blocked; throw new Error("rollback");
  });
  const rejection = assert.rejects(failed, /rollback/);
  await entered;
  const outside = q("INSERT INTO users(email,password_hash) VALUES ('outside@example.test','test')");
  release(); await rejection; await outside;
  assert.equal((await q("SELECT id FROM users WHERE email = 'rolled@example.test'")).length, 0);
  assert.equal((await q("SELECT id FROM users WHERE email = 'outside@example.test'")).length, 1);
});

await t.test("concurrent admission enforces two active searches per account", async () => {
  const id = await user("admission");
  const attempts = await Promise.all(Array.from({ length: 8 }, () => enqueueSearchJob(id, params)));
  assert.equal(attempts.filter(x => x.ok).length, 2);
  assert.equal(attempts.filter(x => x.status === 429).length, 6);
  assert.equal((await enqueueSearchJob(id, { ...params, niche: 123 as unknown as string })).status, 400);
  await q("DELETE FROM search_jobs WHERE user_id = $1", [id]);
});

await t.test("claims, leases, recovery, ownership and metering persist atomically", async () => {
  const id = await user("workers"); const other = await user("other");
  await enqueueSearchJob(id, params); await enqueueSearchJob(id, params); await enqueueSearchJob(other, params);
  const claims = await Promise.all([claimNextJob(), claimNextJob(), claimNextJob()]);
  const live = claims.filter(x => x != null);
  assert.equal(live.length, 2); assert.notEqual(live[0].worker_token, live[1].worker_token);
  assert.equal(await recoverSearchJobs(), 0, "boot must preserve unexpired work");
  assert.equal(await finishSearchJob({ ...live[0], worker_token: "wrong" }, { leads: [ { email: "fake@example.test" } ] }), false);
  assert.equal((await q1<{ n: number }>("SELECT COUNT(*)::int n FROM usage_daily WHERE user_id = $1", [id]))!.n, 0);
  await q("UPDATE search_jobs SET lease_until = now() - interval '1 second' WHERE id = $1", [live[0].id]);
  assert.equal(await recoverSearchJobs(), 1);
  assert.equal(await finishSearchJob(live[0], { leads: [{}] }), false, "expired worker cannot publish");
  const job = live[1];
  await q("INSERT INTO usage_daily(user_id,day,kind,count) VALUES ($1,$2,'leads',49)", [id, new Date().toISOString().slice(0,10)]);
  const result = { leads: [{ email: "one@example.test" }, { email: "two@example.test" }], meta: {} };
  assert.equal(await finishSearchJob(job, result), true);
  assert.equal(result.leads.length, 1, "delivery clamps to the locked remaining quota");
  assert.equal((await jobResult(id, job.id))!.leads.length, 1);
  assert.equal(await jobResult(other, job.id), null);
  assert.equal(await finishSearchJob(job, result), false, "duplicate completion must not charge twice");
  assert.equal((await q1<{ n: number }>("SELECT SUM(count)::int n FROM usage_daily WHERE user_id = $1 AND kind = 'leads'", [id]))!.n, 50);
  await q("DELETE FROM search_jobs WHERE user_id IN ($1,$2)", [id, other]);
});

await t.test("a failed result write rolls back its allowance charge", async () => {
  const id = await user("rollback-result");
  await enqueueSearchJob(id, params); const job = (await claimNextJob())!;
  const circular: { self?: unknown } = {}; circular.self = circular;
  await assert.rejects(finishSearchJob(job, { leads: [{}], meta: circular }), /circular/i);
  assert.equal((await q1<{ n: number }>("SELECT COALESCE(SUM(count),0)::int n FROM usage_daily WHERE user_id = $1", [id]))!.n, 0);
  assert.equal((await q1<{ status: string }>("SELECT status FROM search_jobs WHERE id = $1", [job.id]))!.status, "running");
  await finishSearchJob(job, null, "test cleanup");
  await q("DELETE FROM search_jobs WHERE user_id = $1", [id]);
});

await t.test("concurrent quota consumers share one remaining allowance", async () => {
  const id = await user("quota");
  await q("INSERT INTO usage_daily(user_id,day,kind,count) VALUES ($1,$2,'leads',49)", [id, new Date().toISOString().slice(0,10)]);
  const results = await Promise.all([consumeLeadQuota(id, 10), consumeLeadQuota(id, 1)]);
  assert.equal(results.reduce((n,r) => n + r.accepted, 0), 1);
});

await t.test("linked actions are tenant scoped, idempotent and count one job", async () => {
  const id = await user("actions"); const other = await user("actions-other");
  const queued = (await enqueueSearchJob(id, params)).job!;
  assert.equal(await recordSearchAction(id, queued.id, "opened"), false, "unfinished search");
  const job = (await claimNextJob())!;
  await finishSearchJob(job, { leads: [{ email: "a@example.test" }] });
  assert.equal(await recordSearchAction(other, job.id, "opened"), false);
  assert.equal(await recordSearchAction(id, job.id, "__proto__" as never), false);
  await Promise.all([recordSearchAction(id, job.id, "opened"), recordSearchAction(id, job.id, "opened")]);
  let summary = (await searchFollowThrough())!;
  assert.equal(summary.opened, 1); assert.equal(summary.no_action, 1);
  await recordSearchAction(id, job.id, "exported"); await recordSearchAction(id, job.id, "saved");
  summary = (await searchFollowThrough())!;
  assert.equal(summary.exported, 1); assert.equal(summary.saved, 1); assert.equal(summary.no_action, 0);
});

await t.test("cold cache bursts share a fetch; failure retries; hot rows obey data TTL", async () => {
  const opts = { key: "test|burst", kind: "site" as const, ttlSeconds: 0.02 };
  let calls = 0;
  const produce = async () => { calls++; await new Promise(r => setTimeout(r, 15)); return { n: calls }; };
  const results = await Promise.all(Array.from({ length: 8 }, () => withSearchTrace(() => cachedWithMeta(opts, produce))));
  assert.equal(calls, 1);
  assert.equal(results.filter(r => !r.value.reused).length, 1);
  assert.equal(results.reduce((n,r) => n+r.trace.misses, 0), 1);
  await new Promise(r => setTimeout(r, 30));
  await cachedWithMeta(opts, produce); assert.equal(calls, 2, "60-second memory layer cannot extend source TTL");
  const failure = { ...opts, key: "test|failure", ttlSeconds: 60 };
  let failedCalls = 0;
  const fail = async (): Promise<null> => { failedCalls++; await new Promise(r => setTimeout(r, 10)); throw new Error("provider failed"); };
  const failures = await Promise.allSettled([cachedWithMeta(failure, fail), cachedWithMeta(failure, fail)]);
  assert.ok(failures.every(f => f.status === "rejected")); assert.equal(failedCalls, 1);
  assert.equal((await cachedWithMeta(failure, async () => "recovered")).value, "recovered");
  clearMemoryCache();
  assert.equal((await cachedWithMeta(failure, async () => "wrong")).value, "recovered", "persistent cache survives memory clear");
});

await t.test("location variants reuse one persisted fetch and preserve its original freshness", async () => {
  clearMemoryCache();
  let calls = 0;
  const produce = async () => ({ leads: [{ name: "Fictional estate agent" }], call: ++calls });
  const read = (location: string) => withSearchTrace(() => cachedWithMeta({
    key: sourceKey("companies_house", "real estate", location, 10),
    kind: "source", ttlSeconds: sourceTtl("companies_house"),
  }, produce));
  const first = await read("london,uk");
  const second = await read("London , UK");
  assert.deepEqual(first.trace, { hits: 0, misses: 1 });
  assert.deepEqual(second.trace, { hits: 1, misses: 0 });
  assert.equal(second.value.reused, true);
  assert.equal(second.value.fetchedAt, first.value.fetchedAt);
  clearMemoryCache();
  const persisted = await read("london, uk");
  assert.equal(persisted.value.reused, true);
  assert.deepEqual(persisted.trace, { hits: 1, misses: 0 });
  assert.equal(calls, 1, "neither memory nor persistent reuse may refetch the provider");
  assert.equal((await q1<{n:number}>("SELECT COUNT(*)::int n FROM search_cache WHERE cache_key=$1", [sourceKey("companies_house", "real estate", "London, UK", 10)]))!.n, 1);
});

await t.test("cache stats use the same per-source TTLs as reads", async () => {
  await q("DELETE FROM search_cache");
  for (const [key,kind,age] of [["geo|London","geo",100],["src|osm|a|b|25","source",20],
    ["src|companies_house|a|b|25","source",8],["src|web|a|b|25","source",10],
    ["site:v2|a","site",8],["contact|a","contact",20]] as const) {
    await q("INSERT INTO search_cache(cache_key,kind,payload,refreshed_at) VALUES ($1,$2,'[]', now() - $3 * interval '1 day')", [key,kind,age]);
  }
  const stats = (await searchCacheStats())!;
  assert.equal(stats.entries, 6); assert.equal(stats.fresh, 4); assert.equal(stats.expired, 2);
});

});
