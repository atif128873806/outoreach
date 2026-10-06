import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRelativeTs } from "./helpers/resolve-ts.mjs";
import { schedulerMocks } from "./helpers/scheduler-mocks.mjs";
const globals=globalThis as typeof globalThis&{__schedulerFixture?:{schedules:string[];sends:number;inboxes:number;searches:number};__outreachCron?:boolean};
const resolve=resolveRelativeTs(),mocks=schedulerMocks();
const {startScheduler}=await import('../lib/scheduler.ts');
await test('parked outreach never schedules or starts sending/inbox work; lead queue still runs',async()=>{
  const outreach=process.env.OUTREACH_ENABLED,watches=process.env.NEW_BUSINESSES_ENABLED,cron=globals.__outreachCron;
  try {
    process.env.OUTREACH_ENABLED='false';process.env.NEW_BUSINESSES_ENABLED='false';delete globals.__outreachCron;
    globals.__schedulerFixture={schedules:[],sends:0,inboxes:0,searches:0};
    await startScheduler();await new Promise(r=>setImmediate(r));
    assert.equal(globals.__schedulerFixture.sends,0);assert.equal(globals.__schedulerFixture.inboxes,0);
    assert.deepEqual(globals.__schedulerFixture.schedules,['*/10 * * * * *']);assert.equal(globals.__schedulerFixture.searches,1);
    await startScheduler();assert.equal(globals.__schedulerFixture.schedules.length,1,'hot reload must not stack cron');
    process.env.OUTREACH_ENABLED='true';delete globals.__outreachCron;globals.__schedulerFixture={schedules:[],sends:0,inboxes:0,searches:0};
    await startScheduler();await new Promise(r=>setImmediate(r));
    assert.equal(globals.__schedulerFixture.sends,1);assert.equal(globals.__schedulerFixture.inboxes,1);
    assert.equal(globals.__schedulerFixture.schedules.includes('* * * * *'),true);
  } finally {
    if(outreach==null)delete process.env.OUTREACH_ENABLED;else process.env.OUTREACH_ENABLED=outreach;
    if(watches==null)delete process.env.NEW_BUSINESSES_ENABLED;else process.env.NEW_BUSINESSES_ENABLED=watches;
    globals.__outreachCron=cron;delete globals.__schedulerFixture;mocks.deregister();resolve.deregister();
  }
});
