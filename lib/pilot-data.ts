import { q } from './db';
import type { AdminFilters } from './admin-data';
import { PILOT_AUDIENCES,type PilotAudience } from './pilot';

export async function pilotData(filters:AdminFilters){
  const start=new Date();start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-(filters.days-1));
  const rows=await q<{audience:PilotAudience;landing:string|null;preview:string|null;signup:string|null;started:string|null;results:string|null;extracted:string|null;interest:string|null;preview_error:boolean;signup_error:boolean;failed:boolean;empty:boolean;created_at:string}>(`
    SELECT s.audience,s.created_at,
      MIN(e.created_at) FILTER(WHERE e.event='landing_view') landing,
      MIN(e.created_at) FILTER(WHERE e.event='preview_loaded') preview,
      MIN(e.created_at) FILTER(WHERE e.event='signup_complete') signup,
      MIN(e.created_at) FILTER(WHERE e.event='search_started') started,
      MIN(e.created_at) FILTER(WHERE e.event='search_results') results,
      MIN(e.created_at) FILTER(WHERE e.event IN ('exported','copied','saved')) extracted,
      MIN(e.created_at) FILTER(WHERE e.event='upgrade_interest') interest,
      COALESCE(BOOL_OR(e.event='preview_error'),false) preview_error,
      COALESCE(BOOL_OR(e.event='signup_error'),false) signup_error,
      COALESCE(BOOL_OR(e.event='search_failed'),false) failed,
      COALESCE(BOOL_OR(e.event='search_empty'),false) empty
    FROM pilot_sessions s LEFT JOIN pilot_events e ON e.session_id=s.id
    WHERE s.created_at>=$1 AND ($2='' OR s.audience=$2)
    GROUP BY s.id,s.audience,s.created_at`,[start.toISOString(),filters.audience??'']);
  const after=(next:string|null,prior:string|null)=>Boolean(next&&prior&&new Date(next)>=new Date(prior));
  const cohort=rows.filter(r=>r.landing);
  function summarize(values:typeof rows){
    const landed=values.filter(r=>r.landing),signed=landed.filter(r=>after(r.signup,r.landing));
    const searched=signed.filter(r=>after(r.started,r.signup)),answered=searched.filter(r=>after(r.results,r.started));
    const extracted=answered.filter(r=>after(r.extracted,r.results));
    return {landing:landed.length,signup:signed.length,started:searched.length,results:answered.length,extracted:extracted.length,
      preview:landed.filter(r=>after(r.preview,r.landing)).length,
      interest:answered.filter(r=>after(r.interest,r.results)).length};
  }
  const totals=summarize(cohort);
  const stages=[['Landing viewed',totals.landing],['Account created',totals.signup],['Search queued',totals.started],['Results returned',totals.results],['Saved, copied or export requested',totals.extracted]] as const;
  return {start:start.toISOString(),totals,stages:stages.map(([label,count],i)=>({label,count,denominator:i?stages[i-1][1]:count,
    rate:(i?stages[i-1][1]:count)>0?Math.round(count/(i?stages[i-1][1]:count)*100):null,
    notObserved:i?stages[i-1][1]-count:0})),
    audiences:(Object.keys(PILOT_AUDIENCES) as PilotAudience[]).map(audience=>({audience,label:PILOT_AUDIENCES[audience].label,...summarize(cohort.filter(r=>r.audience===audience))})),
    coverage:{consentedJourneys:rows.length,withoutLanding:rows.length-cohort.length,createdLast24h:cohort.filter(r=>Date.now()-new Date(r.created_at).getTime()<86400_000).length},
    issues:{preview:rows.filter(r=>r.preview_error).length,signup:rows.filter(r=>r.signup_error).length,failed:rows.filter(r=>r.failed).length,empty:rows.filter(r=>r.empty).length}};
}
