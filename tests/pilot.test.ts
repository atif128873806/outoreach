import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {resolveRelativeTs} from './helpers/resolve-ts.mjs';
const cwd=process.cwd(),url=process.env.DATABASE_URL,temp=mkdtempSync(path.join(tmpdir(),'outreach-pilot-test-'));
process.chdir(temp);delete process.env.DATABASE_URL;
const hooks=resolveRelativeTs();
const {q,q1,getDb}=await import('../lib/db.ts');
const {projectPreviewElements,publicPreviewWebsite,loadPilotPreview,reservePilotWindow}=await import('../lib/pilot-preview.ts');
const {pilotSearchPath,pilotAudience,isPilotAudience,isPilotBrowserEvent}=await import('../lib/pilot.ts');
const {startPilotSession,pilotSession,withdrawPilotSession,recordPilotBrowserEvent,linkPilotSignup,linkPilotSearch,recordPilotJobEvent,recordPilotJobEventSafely,recordPilotPreview,cleanupPilotJourneys}=await import('../lib/pilot-journey.ts');
const {readPilotBody}=await import('../lib/pilot-request.ts');
const {pilotData}=await import('../lib/pilot-data.ts');
const filters={days:7 as const,page:1,query:'',source:'',outcome:'',userId:null};
await test('isolated London preview and consented journeys',async t=>{
 t.after(()=>{hooks.deregister();process.chdir(cwd);if(url==null)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=url;rmSync(temp,{recursive:true,force:true});});
 await t.test('allowlists preserve all three first-search intents and exclude forged conversions',()=>{
  for(const audience of ['agencies','accountants','sales'] as const){const p=new URL(pilotSearchPath(audience),'https://example.test');assert.equal(p.pathname,'/leads');assert.equal(p.searchParams.get('audience'),audience);assert.equal(p.searchParams.get('source'),'osm');assert.equal(p.searchParams.get('filter'),'any');}
  for(const value of ['__proto__','https://evil.test',null])assert.equal(isPilotAudience(value),false);
  assert.equal(pilotAudience('//evil.test'),'agencies');assert.equal(isPilotBrowserEvent('signup_complete'),false);assert.equal(isPilotBrowserEvent('search_results'),false);assert.equal(isPilotBrowserEvent('landing_view'),true);
 });
 await t.test('public envelopes are bounded before parsing',async()=>{
  const request=(body:string)=>new Request('https://example.test/api/pilot',{method:'POST',body});
  assert.deepEqual(await readPilotBody(request('{"audience":"agencies"}')),{audience:'agencies'});
  for(const body of ['[1]','null','{','x'.repeat(513)])assert.equal(await readPilotBody(request(body)),null);
 });
 await t.test('preview drops contacts, wrong category, wrong area, duplicates and excessive rows',()=>{
  const row=(name:string,lat=51.37,amenity='dentist')=>({lat,lon:-0.1,tags:{name,amenity,website:'https://example.test/site?token=secret#private',email:'private@example.test',phone:'secret'}});
  const result=projectPreviewElements([row('Outside',52),row('Wrong',51.37,'cafe'),row('A'),row('A'),row('B'),row('C'),row('D')],'agencies');
  assert.equal(result.length,3);assert.deepEqual(Object.keys(result[0]).sort(),['area','category','name','website']);assert.equal(result[0].website,'https://example.test/site');assert.equal(JSON.stringify(result).includes('secret'),false);
  assert.throws(()=>projectPreviewElements(null,'agencies'));
 });
 await t.test('website projection rejects credentials and unsafe protocols',()=>{
  for(const url of ['javascript:alert(1)','http://localhost/x','http://127.0.0.1','https://u:p@example.test','https://10.0.0.1'])assert.equal(publicPreviewWebsite(url),'');
  assert.equal(publicPreviewWebsite('example.test/path?a=1'),'https://example.test/path');
 });
 await t.test('same sample concurrent work coalesces and survives subsequent DB reads',async()=>{
  let calls=0;const producer=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return [{name:'Fixture dentist',website:'https://example.test?secret=x',area:'Untrusted',category:'Untrusted',email:'private'}];};
  const [a,b]=await Promise.all([loadPilotPreview('agencies',producer),loadPilotPreview('agencies',producer)]);
  const c=await loadPilotPreview('agencies',producer);assert.equal(calls,1);assert.equal(a.fetchedAt,b.fetchedAt);assert.equal(c.fetchedAt,a.fetchedAt);assert.equal(c.reused,true);assert.equal(c.businesses[0].area,'Croydon, London');assert.equal(JSON.stringify(c).includes('private'),false);
 });
 await t.test('provider budget blocks another cold sample before fetching',async()=>{
  let called=false;await assert.rejects(loadPilotPreview('sales',async()=>{called=true;return [];}));assert.equal(called,false);
 });
 await t.test('fixed windows reset and deny beyond their limit',async()=>{
  const db=await getDb();assert.equal(await reservePilotWindow(db,'fixture-budget',1,10000),true);assert.equal(await reservePilotWindow(db,'fixture-budget',1,10000),false);
  await q("UPDATE rate_limits SET reset_at=now()-interval '1 second' WHERE key='fixture-budget'");assert.equal(await reservePilotWindow(db,'fixture-budget',1,10000),true);
 });
 await t.test('expired preview failure is not returned as fresh and has a cooldown',async()=>{
  await q("UPDATE rate_limits SET reset_at=now()-interval '1 second' WHERE key='pilot-preview-provider-minute'");
  await q("UPDATE pilot_preview_samples SET fetched_at=now()-interval '8 days' WHERE audience='agencies'");
  let calls=0;const failure=async()=>{calls++;throw new Error('private provider details');};
  await assert.rejects(loadPilotPreview('agencies',failure),/temporarily unavailable/);await assert.rejects(loadPilotPreview('agencies',failure));assert.equal(calls,1);
 });
 await t.test('daily provider ceiling denies new work independently of the minute cap',async()=>{
  await q("UPDATE rate_limits SET reset_at=now()-interval '1 second' WHERE key='pilot-preview-provider-minute'");
  await q("UPDATE rate_limits SET count=12 WHERE key='pilot-preview-provider-day'");
  let called=false;await assert.rejects(loadPilotPreview('accountants',async()=>{called=true;return [];}));assert.equal(called,false);
  await q("UPDATE rate_limits SET count=1 WHERE key='pilot-preview-provider-day'");
 });
 await t.test('HTTP 200 provider runtime errors are not cached as a successful empty sample',async()=>{
  await q("UPDATE rate_limits SET reset_at=now()-interval '1 second' WHERE key='pilot-preview-provider-minute'");
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({remark:'runtime error: timeout',elements:[]}),{status:200});
  try{await assert.rejects(loadPilotPreview('sales'));assert.equal((await q1<{fetched_at:string|null}>("SELECT fetched_at FROM pilot_preview_samples WHERE audience='sales'"))!.fetched_at,null);}finally{globalThis.fetch=original;}
 });
 const uid=(await q1<{id:number}>("INSERT INTO users(email,password_hash) VALUES('pilot@example.test','fixture') RETURNING id"))!.id;
 const other=(await q1<{id:number}>("INSERT INTO users(email,password_hash) VALUES('other@example.test','fixture') RETURNING id"))!.id;
 let session='';let job=0;
 await t.test('unconsented events create no sessions; consent can be withdrawn',async()=>{
  await recordPilotBrowserEvent(undefined,'landing_view','agencies',null);assert.equal((await q1<{n:number}>('SELECT count(*)::int n FROM pilot_sessions'))!.n,0);
  const id=await startPilotSession('sales',null,undefined);await recordPilotBrowserEvent(id,'landing_view','sales',null);await withdrawPilotSession(id);assert.equal(await pilotSession(id),undefined);assert.equal((await q1<{n:number}>('SELECT count(*)::int n FROM pilot_events'))!.n,0);
 });
 await t.test('registration and search events are owned, server-confirmed and idempotent',async()=>{
  session=await startPilotSession('agencies',null,undefined);await recordPilotBrowserEvent(session,'landing_view','agencies',null);await recordPilotPreview(session,null,true);await linkPilotSignup(session,uid,'agencies');await linkPilotSignup(session,other,'sales');
  assert.equal(await pilotSession(session,other),undefined);assert.equal((await pilotSession(session,uid))!.user_id,uid);
  job=(await q1<{id:number}>("INSERT INTO search_jobs(user_id,niche,location,status) VALUES($1,'dentists','London','done') RETURNING id",[uid]))!.id;
  await linkPilotSearch(session,other,job);assert.equal((await q1<{n:number}>("SELECT count(*)::int n FROM pilot_events WHERE event='search_started'"))!.n,0);
  await linkPilotSearch(session,uid,job);await linkPilotSearch(session,uid,job);
  await recordPilotJobEvent(await getDb(),other,job,'search_results');await recordPilotJobEvent(await getDb(),uid,job,'search_results');await recordPilotJobEvent(await getDb(),uid,job,'saved');await recordPilotJobEvent(await getDb(),uid,job,'saved');
  assert.equal((await q1<{n:number}>("SELECT count(*)::int n FROM pilot_events WHERE event='saved'"))!.n,1);
 });
 await t.test('ordered funnel excludes direct signup and uses prior-step denominators',async()=>{
  const direct=await startPilotSession('accountants',null,undefined);await linkPilotSignup(direct,other,'accountants');
  const landed=await startPilotSession('sales',null,undefined);await recordPilotBrowserEvent(landed,'landing_view','sales',null);
  const data=await pilotData(filters);assert.deepEqual(data.stages.map(s=>s.count),[2,1,1,1,1]);assert.equal(data.stages[1].denominator,2);assert.equal(data.stages[1].rate,50);assert.equal(data.coverage.withoutLanding,1);assert.equal(data.audiences.length,3);
  const restricted=await pilotData({...filters,audience:'sales'});assert.equal(restricted.totals.landing,1);assert.equal(restricted.totals.signup,0);
 });
 await t.test('journey metadata survives job expiry but withdrawal deletes it',async()=>{
  await q('DELETE FROM search_jobs WHERE id=$1',[job]);assert.equal((await q1<{n:number}>("SELECT count(*)::int n FROM pilot_events WHERE job_id=$1",[job]))!.n,3);
  await withdrawPilotSession(session);assert.equal((await q1<{n:number}>("SELECT count(*)::int n FROM pilot_events WHERE session_id=$1",[session]))!.n,0);
 });
 await t.test('an analytics SQL failure cannot roll back customer work',async()=>{
  await (await getDb()).transaction(async tx=>{
    await tx.query("UPDATE users SET name='Customer change preserved' WHERE id=$1",[uid]);
    const failing={query:(sql:string,params:unknown[])=>tx.query(sql.startsWith('INSERT INTO pilot_events')?'SELECT nonexistent_column FROM users':sql,params)};
    await recordPilotJobEventSafely(failing,uid,1,'saved');
  });
  assert.equal((await q1<{name:string}>('SELECT name FROM users WHERE id=$1',[uid]))!.name,'Customer change preserved');
 });
 await t.test('expired identifiers reject events and 90-day cleanup removes retained records',async()=>{
  const id=await startPilotSession('sales',null,undefined);await q("UPDATE pilot_sessions SET expires_at=now()-interval '1 day',created_at=now()-interval '91 days' WHERE id=$1",[id]);await recordPilotBrowserEvent(id,'landing_view','sales',null);assert.equal(await pilotSession(id),undefined);await cleanupPilotJourneys();assert.equal(await q1('SELECT id FROM pilot_sessions WHERE id=$1',[id]),undefined);
 });
});
