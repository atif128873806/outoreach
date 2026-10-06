import { registerHooks } from 'node:module';
export function schedulerMocks() {
  const scripts = {
    'node-cron': 'export default {schedule:(spec,fn)=>globalThis.__schedulerFixture.schedules.push(spec)};',
    './runner': 'export async function tick(){globalThis.__schedulerFixture.sends++;}',
    './inbox': 'export async function checkAllInboxes(){globalThis.__schedulerFixture.inboxes++;}',
    './watches': 'export async function runWeeklyDigest(){throw new Error("Unexpected digest");}',
    './db': 'export async function getDb(){return {};}',
    './search-jobs': 'export async function recoverSearchJobs(){return 0;} export async function pumpSearchJobs(){globalThis.__schedulerFixture.searches++;}',
  };
  return registerHooks({resolve(specifier,context,next){
    if(context.parentURL?.includes('/lib/scheduler.ts') && Object.hasOwn(scripts,specifier))
      return {url:'data:text/javascript,'+encodeURIComponent(scripts[specifier]),shortCircuit:true};
    return next(specifier,context);
  }});
}
