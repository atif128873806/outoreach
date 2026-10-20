import { registerHooks } from 'node:module';
const scripts={
 './leads':`export async function enrichLeads(leads){globalThis.__leadQualityFixture.enriched+=leads.length;return leads;} export async function geocodePoint(address){const f=globalThis.__leadQualityFixture;f.geocoded.push(address);return f.points[address]??null;} export function withSiteNotes(l){return l.notes;}`,
 './siteaudit':'export function isRedesignProspect(){return false;}',
 './exa':'export async function findOfflineContact(){throw new Error("Unexpected provider call");}',
 './sources':`export class SourceSetupError extends Error{};const source={id:'fixture',label:'Fixture',gives:{website:true},search:async()=>structuredClone(globalThis.__leadQualityFixture.leads)};export function getSource(){return source;} export function offeredSources(){return [source];} export function requireSource(){return source;} export function sourceFitsFilter(){return true;} export function sourceFilterMessage(){return '';} export function sourceUnlocked(){return true;} export function sourceUpgradeMessage(){return '';}`,
 './settings':'export async function getSettings(){return {};}',
 './usage':`export async function getLeadQuota(){return {plan:{id:'free',filters:['any','with']},remaining:50,limit:50};} export function leadQuotaMessage(){return 'limit';}`,
 './db':'export async function q(){return [];}',
 './friendly-error':'export function friendlyProviderError(e){return e.message;}',
 './search-cache':'export async function pruneSearchCache(){}',
};
export function leadSearchMocks(){return registerHooks({resolve(s,c,next){if(c.parentURL?.endsWith('/lib/lead-search.ts')&&Object.hasOwn(scripts,s))return {url:'data:text/javascript,'+encodeURIComponent(scripts[s]),shortCircuit:true};return next(s,c);}});}
