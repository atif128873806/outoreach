import { q, q1 } from "./db";
import { searchCacheStats } from "./search-cache";
import { isOutreachEnabled, isNewBusinessesEnabled } from "./product";

export type AdminView = "overview" | "activity" | "errors" | "users" | "operations";
export interface AdminFilters { days: number; page: number; query: string; source: string; outcome: string; userId: number | null; }
const VIEWS = ["overview","activity","errors","users","operations"];
export function adminFilters(params: URLSearchParams): {view:AdminView;filters:AdminFilters} {
  const view=params.get("view")??"overview";
  const days=Number(params.get("days")??7), page=Number(params.get("page")??1);
  const source=params.get("source")??"",outcome=params.get("outcome")??"";
  const user=params.get("userId"),userId=user==null||user===""?null:Number(user);
  if (!VIEWS.includes(view) || ![7,30,90].includes(days) || !Number.isSafeInteger(page) || page<1 || page>10000 ||
    !["","web","osm","companies_house"].includes(source) || !["","ok","empty","rejected","error"].includes(outcome) ||
    (userId!=null && (!Number.isSafeInteger(userId)||userId<1))) throw new Error("Invalid dashboard filters");
  return {view:view as AdminView,filters:{days,page,source,outcome,userId,query:(params.get("q")??"").trim().slice(0,120)}};
}
export function redactAdminDetail(value: unknown): string {
  return String(value??"").replace(/(bearer\s+)[a-z0-9._~-]+/gi,"$1[redacted]")
    .replace(/((?:api[_-]?key|token|password|secret|authorization|credential)["']?\s*[:=]\s*["']?)[^\s,"';&]+/gi,"$1[redacted]")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,"$1[redacted]@").slice(0,500);
}
function period(filters:AdminFilters) {
  const at=new Date();at.setUTCHours(0,0,0,0);at.setUTCDate(at.getUTCDate()-(filters.days-1));return at.toISOString();
}
function where(f:AdminFilters, alias="e", field="niche", hasOutcome=true) {
  const values:unknown[]=[period(f)];
  const clauses=[`${alias}.created_at >= $1`];
  const add=(clause:string,value:unknown)=>{values.push(value);clauses.push(clause.replaceAll("?",`$${values.length}`));};
  if(f.source)add(`${alias}.source=?`,f.source);
  if(f.userId!=null)add(`${alias}.user_id=?`,f.userId);
  if(hasOutcome&&f.outcome)add(`${alias}.outcome=?`,f.outcome);
  if(f.query)add(`(u.email ILIKE ? OR u.name ILIKE ? OR ${alias}.${field} ILIKE ? OR ${alias}.location ILIKE ?)`,`%${f.query}%`);
  return {sql:clauses.join(" AND "),values};
}
export const ADMIN_PAGE_SIZE=25;
export interface ActivityRecord {
  id:number;job_id:number|null;user_id:number|null;email:string|null;name:string|null;niche:string;location:string;source:string;
  filter:string;requested:number;returned:number;outcome:string;stage:string;detail:string;created_at:string;
  latency_ms:number;cache_hits:number;cache_misses:number;opened_at:string|null;exported_at:string|null;copied_at:string|null;saved_at:string|null;
}
export async function activityData(f:AdminFilters,exportRows=false) {
  const {sql,values}=where(f);
  const count=await q1<{total:number}>(`SELECT COUNT(*)::int total FROM search_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${sql}`,values);
  const rows=await q<ActivityRecord>(`SELECT e.*,u.email,u.name,j.opened_at,j.exported_at,j.copied_at,j.saved_at
    FROM search_events e LEFT JOIN users u ON u.id=e.user_id LEFT JOIN search_jobs j ON j.id=e.job_id
    WHERE ${sql} ORDER BY e.id DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,
    [...values,exportRows?1000:ADMIN_PAGE_SIZE,exportRows?0:(f.page-1)*ADMIN_PAGE_SIZE]);
  const ext=where({...f,outcome:""});
  const extractions=await q(`SELECT e.id,e.job_id,e.user_id,u.email,u.name,e.niche,e.location,e.source,e.action,e.lead_count,e.created_at
    FROM search_extractions e LEFT JOIN users u ON u.id=e.user_id WHERE ${ext.sql}
    ORDER BY e.id DESC LIMIT 25`,ext.values);
  return {rows:rows.map(row=>({...row,detail:redactAdminDetail(row.detail)})),total:count?.total??0,page:f.page,pageSize:ADMIN_PAGE_SIZE,extractions};
}
export async function overviewData(f:AdminFilters) {
  const {sql,values}=where(f);
  const [totals,daily,sources,queries]=await Promise.all([
    q1(`SELECT COUNT(*)::int attempts,COUNT(DISTINCT e.user_id)::int accounts,
      COALESCE(SUM(e.returned),0)::int leads,COUNT(*) FILTER(WHERE outcome='ok')::int answered,
      COUNT(*) FILTER(WHERE outcome='empty')::int empty,COUNT(*) FILTER(WHERE outcome='error')::int errors,
      COUNT(*) FILTER(WHERE outcome='rejected')::int rejected,COALESCE(SUM(cache_hits),0)::int hits,
      COALESCE(SUM(cache_misses),0)::int misses,ROUND(AVG(latency_ms))::int avg_ms
      FROM search_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${sql}`,values),
    q(`SELECT to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS "day",COUNT(*)::int attempts,
      COUNT(*) FILTER(WHERE outcome='error')::int errors,COALESCE(SUM(returned),0)::int leads
      FROM search_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${sql} GROUP BY 1 ORDER BY 1`,values),
    q(`SELECT e.source,COUNT(*)::int attempts,COUNT(*) FILTER(WHERE outcome='ok')::int answered,
      COUNT(*) FILTER(WHERE outcome='empty')::int empty,COUNT(*) FILTER(WHERE outcome='error')::int errors,
      COUNT(*) FILTER(WHERE outcome='rejected')::int rejected,ROUND(AVG(latency_ms))::int avg_ms
      FROM search_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${sql} GROUP BY 1 ORDER BY attempts DESC`,values),
    q(`SELECT e.niche,e.location,e.source,COUNT(*)::int attempts,COALESCE(SUM(returned),0)::int leads
      FROM search_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${sql} GROUP BY 1,2,3 ORDER BY attempts DESC LIMIT 8`,values)
  ]);
  const ext=where({...f,outcome:""});
  const extraction=await q1(`SELECT COUNT(DISTINCT e.job_id)::int searches,
    COUNT(*) FILTER(WHERE action='exported')::int exports,COUNT(*) FILTER(WHERE action='copied')::int copies,
    COUNT(*) FILTER(WHERE action='saved')::int saves FROM search_extractions e LEFT JOIN users u ON u.id=e.user_id WHERE ${ext.sql}`,ext.values);
  return {totals,daily,sources,queries,extraction,start:period(f)};
}
export async function errorsData(f:AdminFilters) {
  const combined=`(SELECT 'search' kind,e.id,e.user_id,e.job_id,e.niche,e.location,e.source,e.stage,
    e.outcome,e.detail,e.created_at FROM search_events e WHERE e.outcome IN ('error','rejected')
    UNION ALL SELECT 'audit-recheck',r.id,r.user_id,NULL,r.website,'','', 'audit-recheck',r.outcome,r.detail,r.created_at
      FROM recheck_events r WHERE r.outcome IN ('failed','refused')
    UNION ALL SELECT 'queue',j.id,j.user_id,j.id,j.niche,j.location,j.source,'queue-interruption',
      'error',j.error,COALESCE(j.finished_at,j.created_at) FROM search_jobs j WHERE j.status='failed'
      AND NOT EXISTS(SELECT 1 FROM search_events s WHERE s.job_id=j.id)) e`;
  const {sql,values}=where(f);
  const [count,rows]=await Promise.all([
    q1<{total:number}>(`SELECT COUNT(*)::int total FROM ${combined} LEFT JOIN users u ON u.id=e.user_id WHERE ${sql}`,values),
    q<Record<string,unknown>>(`SELECT e.*,u.email,u.name FROM ${combined} LEFT JOIN users u ON u.id=e.user_id WHERE ${sql}
      ORDER BY e.created_at DESC,e.kind,e.id DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,
      [...values,ADMIN_PAGE_SIZE,(f.page-1)*ADMIN_PAGE_SIZE])
  ]);
  return {rows:rows.map((r):Record<string,unknown>=>({...r,detail:redactAdminDetail(r.detail)})),total:count?.total??0,page:f.page,pageSize:ADMIN_PAGE_SIZE};
}
export async function usersData(f:AdminFilters) {
  const values:unknown[]=[`%${f.query}%`];let sql="(u.email ILIKE $1 OR u.name ILIKE $1)";
  if(f.userId!=null){values.push(f.userId);sql+=" AND u.id=$2";}
  const [count,rows]=await Promise.all([
    q1<{total:number}>(`SELECT COUNT(*)::int total FROM users u WHERE ${sql}`,values),
    q(`SELECT u.id,u.name,u.email,u.plan,u.is_admin,u.email_verified,u.created_at,
      (SELECT COUNT(*)::int FROM contacts c WHERE c.user_id=u.id) contacts,
      (SELECT COALESCE(SUM(count),0)::int FROM usage_daily d WHERE d.user_id=u.id AND d.kind='leads' AND d.day >= to_char(date_trunc('month',now() AT TIME ZONE 'UTC'),'YYYY-MM-DD')) used,
      (SELECT COUNT(*)::int FROM search_events s WHERE s.user_id=u.id) searches,
      (SELECT COUNT(*)::int FROM search_extractions x WHERE x.user_id=u.id) extraction_actions,
      (SELECT MAX(created_at) FROM search_events s WHERE s.user_id=u.id) last_search
      FROM users u WHERE ${sql} ORDER BY u.id DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,
      [...values,ADMIN_PAGE_SIZE,(f.page-1)*ADMIN_PAGE_SIZE])
  ]);
  return {rows,total:count?.total??0,page:f.page,pageSize:ADMIN_PAGE_SIZE};
}
export async function operationsData(f:AdminFilters) {
  const [cache,queue,audit,rechecks]=await Promise.all([
    searchCacheStats(),q(`SELECT status,COUNT(*)::int jobs,MIN(created_at) oldest,
      COUNT(*) FILTER(WHERE status='running' AND lease_until <= now())::int expired FROM search_jobs GROUP BY status`),
    q(`SELECT a.id,a.action,a.detail,a.created_at,u.email actor,t.email subject FROM admin_audit_events a
      LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN users t ON t.id=a.subject_id
      WHERE a.created_at >= $1 ORDER BY a.id DESC LIMIT 25`,[period(f)]),
    q1(`SELECT COUNT(*)::int attempts,COUNT(*) FILTER(WHERE outcome='ok')::int ok,
      COUNT(*) FILTER(WHERE outcome='failed')::int failed,COUNT(*) FILTER(WHERE outcome='refused')::int refused
      FROM recheck_events WHERE created_at >= $1`,[period(f)])
  ]);
  return {cache,queue,audit,rechecks,features:{outreach:isOutreachEnabled(),newBusinesses:isNewBusinessesEnabled(),
    companiesHouseConfigured:Boolean(process.env.COMPANIES_HOUSE_API_KEY?.trim()),exaConfigured:Boolean(process.env.EXA_API_KEY?.trim()),
    signupsOpen:process.env.SIGNUPS_DISABLED!=="true",database:process.env.DATABASE_URL?"PostgreSQL":"PGlite",
    publicUrlConfigured:Boolean(process.env.APP_URL),secureAdminCookie:process.env.NODE_ENV==="production"&&process.env.INSECURE_COOKIES!=="true"}};
}
export async function retainedJobDetail(id:number) {
  const row=await q1<{id:number;user_id:number;email:string;name:string;niche:string;location:string;source:string;status:string;lead_count:number;result:string|null}>(
    `SELECT j.id,j.user_id,u.email,u.name,j.niche,j.location,j.source,j.status,j.lead_count,j.result
     FROM search_jobs j JOIN users u ON u.id=j.user_id WHERE j.id=$1`,[id]);
  if(!row)return null;
  let results:Record<string,unknown>[]=[];
  try{const parsed=JSON.parse(row.result??"null");if(Array.isArray(parsed?.leads))results=parsed.leads;}catch{}
  const text=(v:unknown)=>typeof v==="string"?v.slice(0,200):"";
  return {id:row.id,userId:row.user_id,email:row.email,name:row.name,niche:row.niche,location:row.location,
    source:row.source,status:row.status,leadCount:row.lead_count,leads:results.slice(0,500).map(l=>({
      business:text(l.business_name??l.name),location:text(l.address??l.location),category:text(l.category??l.business_type),website:text(l.website)
    }))};
}
export function metadataCsv(rows:ActivityRecord[]):string {
  const fields:[string,(row:ActivityRecord)=>unknown][]=[['time_utc',r=>r.created_at],['user',r=>r.email],['name',r=>r.name],
    ['niche',r=>r.niche],['location',r=>r.location],['source',r=>r.source],['filter',r=>r.filter],['requested',r=>r.requested],
    ['returned',r=>r.returned],['cache_hits',r=>r.cache_hits],['cache_misses',r=>r.cache_misses],
    ['outcome',r=>r.outcome],['stage',r=>r.stage],['duration_ms',r=>r.latency_ms],['detail',r=>r.detail]];
  const cell=(v:unknown)=>{let s=redactAdminDetail(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;};
  return [fields.map(([label])=>cell(label)).join(','),...rows.map(r=>fields.map(([,value])=>cell(value(r))).join(','))].join('\n');
}
