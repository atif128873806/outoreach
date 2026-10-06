import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Papa from "papaparse";
import { resolveRelativeTs } from "./helpers/resolve-ts.mjs";
const cwd=process.cwd(),url=process.env.DATABASE_URL;
const temp=mkdtempSync(path.join(tmpdir(),"outreach-admin-test-"));
process.chdir(temp);delete process.env.DATABASE_URL;
const hooks=resolveRelativeTs();
const globalDb=globalThis as typeof globalThis&{__outreachPg?:unknown};const beforeDb=globalDb.__outreachPg;globalDb.__outreachPg=undefined;
const {q,q1}=await import("../lib/db.ts");
const {hashPassword,createSessionToken,verifySessionToken}=await import("../lib/crypto.ts");
const {issueAdminSession,adminSessionUser,revokeAdminSession,tokenHash}=await import("../lib/admin-session.ts");
const {safeAdminNext,validAdminOrigin}=await import("../lib/admin-policy.ts");
const {adminFilters,overviewData,activityData,errorsData,usersData,retainedJobDetail,redactAdminDetail,metadataCsv}=await import("../lib/admin-data.ts");
const {recordSearchAction}=await import("../lib/search-actions.ts");
const {recordSearchEvent}=await import("../lib/search-cache.ts");
const password="Isolated-admin-test-2026";
const create=async(email:string,admin=0)=>(await q1<{id:number}>("INSERT INTO users(email,name,password_hash,is_admin) VALUES($1,'Fixture user',$2,$3) RETURNING id",[email,hashPassword(password),admin]))!.id;
await test("isolated admin sessions and operational data",async t=>{
  t.after(()=>{hooks.deregister();process.chdir(cwd);if(url==null)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=url;globalDb.__outreachPg=beforeDb;rmSync(temp,{recursive:true,force:true});});
  const admin=await create("admin@example.test",1),customer=await create("customer@example.test"),other=await create("other@example.test");
  await t.test("only correct current administrator credentials issue separate hashed sessions",async()=>{
    assert.equal(await issueAdminSession(customer,password),null);assert.equal(await issueAdminSession(admin,"wrong"),null);
    const token=(await issueAdminSession(admin,password))!;assert.equal(await adminSessionUser(token),admin);
    assert.equal(verifySessionToken(token),null);assert.equal(await adminSessionUser(createSessionToken(admin).value),null);
    const row=await q1<{token_hash:string}>("SELECT token_hash FROM admin_sessions WHERE user_id=$1",[admin]);assert.equal(row!.token_hash,tokenHash(token));assert.notEqual(row!.token_hash,token);
    await revokeAdminSession(token);assert.equal(await adminSessionUser(token),null);
  });
  await t.test("expired sessions, password changes and role removal reject old access",async()=>{
    const expiry=(await issueAdminSession(admin,password))!;await q("UPDATE admin_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(expiry)]);assert.equal(await adminSessionUser(expiry),null);
    const role=(await issueAdminSession(admin,password))!;await q("UPDATE users SET is_admin=0 WHERE id=$1",[admin]);assert.equal(await adminSessionUser(role),null);await q("UPDATE users SET is_admin=1 WHERE id=$1",[admin]);
    const changed=(await issueAdminSession(admin,password))!;await q("UPDATE users SET password_hash=$1 WHERE id=$2",[hashPassword(password),admin]);assert.equal(await adminSessionUser(changed),null);
  });
  await t.test("admin origins and return URLs reject cross-site and unsafe targets",()=>{
    const headers=new Headers({origin:"https://outreach.example.test",host:"localhost:3000","x-forwarded-proto":"https"});
    assert.equal(validAdminOrigin("http://localhost:3000",headers,"https://outreach.example.test"),true);
    headers.set('origin','https://evil.example.test');assert.equal(validAdminOrigin('http://localhost:3000',headers,'https://outreach.example.test'),false);
    headers.set('origin','https://outreach.example.test');headers.set('host','outreach.example.test');assert.equal(validAdminOrigin('http://localhost:3000',headers,''),true);
    for(const bad of ['//evil.test','https://evil.test/admin','/leads','/admin/login','/admin/../../login','/admin\\evil'])assert.equal(safeAdminNext(bad),'/admin');
    assert.equal(safeAdminNext('/admin/activity?userId=2'),'/admin/activity?userId=2');
  });
  const filter={days:7,page:1,query:"",source:"",outcome:"",userId:null};
  const job=(await q1<{id:number}>(`INSERT INTO search_jobs(user_id,niche,location,source,status,lead_count,result)
    VALUES($1,'dentists','Croydon, London','web','done',1,$2) RETURNING id`,[customer,JSON.stringify({leads:[{business_name:"Fictional Dental",address:"Croydon, London",category:"Dentist",website:"https://example.test",email:"private@example.test",phone:"secret",api_key:"should-not-expose"}]})]))!.id;
  await recordSearchEvent({jobId:job,stage:"lead-search",userId:customer,niche:"dentists",location:"Croydon, London",source:"web",filter:"any",requested:10,returned:1,cacheHits:2,cacheMisses:1,latencyMs:1000,outcome:"ok"});
  await recordSearchEvent({userId:other,niche:"accountants",location:"Hackney, London",source:"osm",filter:"any",requested:10,returned:0,cacheHits:0,cacheMisses:1,latencyMs:2000,outcome:"error",detail:"token=private-token request failed"});
  await t.test("filtered charts, metadata and account totals reflect real users and places",async()=>{
    const data=await overviewData({...filter,userId:customer});assert.equal(data.totals!.attempts,1);assert.equal(data.totals!.leads,1);
    const activity=await activityData({...filter,query:"Croydon"});assert.equal(activity.total,1);assert.equal(activity.rows[0].email,"customer@example.test");assert.equal(activity.rows[0].job_id,job);
    assert.equal(activity.rows[0].cache_hits,2);assert.equal(activity.rows[0].cache_misses,1);
    const csv=Papa.parse<Record<string,string>>(metadataCsv(activity.rows),{header:true});
    assert.equal(csv.data[0].cache_hits,'2');assert.equal(csv.data[0].cache_misses,'1');
    const users=await usersData({...filter,query:"customer"});assert.equal(users.total,1);assert.equal(users.rows[0].searches,1);
    assert.equal((await activityData({...filter,query:"' OR 1=1 --"})).total,0);
    for(const query of ['view=wrong','days=0','source=evil','page=-1','userId=NaN','outcome=failed'])assert.throws(()=>adminFilters(new URLSearchParams(query)));
  });
  await t.test("retained details project business fields without contact or secret payload",async()=>{
    const details=(await retainedJobDetail(job))!;assert.equal(details.leads[0].business,"Fictional Dental");
    assert.equal('email' in details.leads[0],false);assert.equal('phone' in details.leads[0],false);assert.equal('api_key' in details.leads[0],false);
    assert.equal(await retainedJobDetail(999999),null);
  });
  await t.test("extraction metadata is owned, idempotent and survives full result expiry",async()=>{
    assert.equal(await recordSearchAction(other,job,"exported"),false);
    assert.equal(await recordSearchAction(customer,job,"exported"),true);await recordSearchAction(customer,job,"exported");await recordSearchAction(customer,job,"saved");
    const overview=await overviewData(filter);assert.equal(overview.extraction!.searches,1);assert.equal(overview.extraction!.exports,1);assert.equal(overview.extraction!.saves,1);
    await q("DELETE FROM search_jobs WHERE id=$1",[job]);assert.equal(await retainedJobDetail(job),null);
    assert.equal((await q1<{n:number}>("SELECT COUNT(*)::int n FROM search_extractions WHERE job_id=$1",[job]))!.n,2);
    assert.equal((await activityData({...filter,userId:customer})).rows[0].job_id,null);
  });
  await t.test("issue queries include unlogged queue failures and redact credential strings",async()=>{
    await q("INSERT INTO search_jobs(user_id,niche,location,status,error,finished_at) VALUES($1,'builders','London','failed','Search interrupted',now())",[customer]);
    await q("INSERT INTO recheck_events(user_id,website,outcome,detail) VALUES($1,'https://example.test','failed','password=private failure')",[other]);
    const errors=await errorsData(filter);assert.equal(errors.total,3);
    assert.equal(errors.rows.some(r=>r.kind==='queue'),true);assert.equal(JSON.stringify(errors).includes('private-token'),false);assert.equal(JSON.stringify(errors).includes('password=private'),false);
    assert.equal((await errorsData({...filter,userId:customer})).total,1);
  });
  await t.test("metadata CSV neutralizes formulas, quotes and secrets",async()=>{
    const rows=(await activityData(filter)).rows;rows[0].niche=' =HYPERLINK("evil")';const csv=metadataCsv(rows);
    assert.equal(csv.includes("' =HYPERLINK"),true);assert.equal(csv.includes('private-token'),false);
    assert.equal(redactAdminDetail('Authorization: Bearer secret-value api_key=abc https://u:p@example.test'), 'Authorization: [redacted] [redacted] api_key=[redacted] https://[redacted]@example.test');
  });
});
