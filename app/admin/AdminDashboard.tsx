"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import type { AdminView } from "@/lib/admin-data";

type Row=Record<string,unknown>;
type Column=[string,(row:Row)=>React.ReactNode];
const num=(v:unknown)=>Number(v??0);
const text=(v:unknown)=>v==null||v===""?"—":String(v);
const list=(d:Row,key:string)=>(d[key]??[]) as Row[];
const obj=(d:Row,key:string)=>(d[key]??{}) as Row;
const count=(v:unknown)=>num(v).toLocaleString('en-GB');
const source=(v:unknown)=>({web:'Web search',osm:'OpenStreetMap',companies_house:'Companies House'}[String(v)]??text(v));
const when=(v:unknown)=>v?new Date(String(v)).toISOString().replace('T',' ').slice(0,16)+' UTC':'—';
const duration=(v:unknown)=>v==null?'—':num(v)<1000?`${Math.round(num(v))} ms`:`${(num(v)/1000).toFixed(1)} s`;
const TITLES:Record<AdminView,[string,string]>={overview:['Product overview','Search demand, returned results and recorded extraction activity.'],
  activity:['Search activity','See who searched, which niche and location, and what happened next.'],
  errors:['Errors & refusals','Investigate failed searches, audit rechecks and interrupted queue work.'],
  users:['Users','Account activity and the existing manual plan-assignment workflow.'],
  operations:['Operations','Queue state, cache performance and the features configured on this instance.']};
const field='rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600';
const button='rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40';

export default function AdminDashboard({view}:{view:AdminView}){
  const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams();
  const paramsString=searchParams.toString();
  const [data,setData]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[refresh,setRefresh]=useState(0),[updated,setUpdated]=useState('');
  const[detailId,setDetailId]=useState<number|null>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const days=searchParams.get('days')??'7';
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){setBusy(true);setError('');
      try{const params=new URLSearchParams(paramsString);params.set('view',view);
        const r=await fetch(`/api/admin/dashboard?${params}`,{signal:controller.signal,cache:'no-store'});
        if(r.status===401){router.replace('/admin/login');return;}
        const body=await r.json();if(!r.ok)throw new Error(body.error??'Unable to load dashboard');
        setData(body.data);setUpdated(body.generatedAt);
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load dashboard');}
      finally{if(!controller.signal.aborted)setBusy(false);}
    }void load();return()=>controller.abort();
  },[paramsString,view,refresh,router]);
  function apply(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget),next=new URLSearchParams();
    for(const[key,value]of form.entries())if(String(value))next.set(key,String(value));router.push(`${pathname}?${next}`);
  }
  function page(value:number){const next=new URLSearchParams(paramsString);next.set('page',String(value));router.push(`${pathname}?${next}`);}
  const csv=new URLSearchParams(paramsString);csv.set('view','activity');csv.set('format','csv');
  return <>
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Lead intelligence · Operations</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{TITLES[view][0]}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{TITLES[view][1]}</p></div>
      <div className="flex gap-2"><button disabled={busy} onClick={()=>setRefresh(v=>v+1)} className={button}>{busy?'Loading…':'Refresh'}</button>{view==='activity'&&<a href={`/api/admin/dashboard?${csv}`} className={button}>Export metadata</a>}</div>
    </header>
    <form ref={formRef} key={pathname+paramsString} onSubmit={apply} className="my-6 flex flex-wrap items-end gap-3" aria-label="Dashboard filters">
      {view!=='users'&&<label className="text-xs font-medium text-zinc-600">Period<select name="days" defaultValue={days} className={`${field} mt-1.5 block`}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>}
      {view!=='operations'&&<label className="min-w-[min(100%,240px)] flex-[1_1_240px] text-xs font-medium text-zinc-600">{view==='users'?'Find account':'User, niche or location'}<input name="q" defaultValue={searchParams.get('q')??''} placeholder={view==='users'?'Name or email':'e.g. dentists, London or user email'} className={`${field} mt-1.5 block w-full min-w-0`} maxLength={120}/></label>}
      {view!=='users'&&view!=='operations'&&<><label className="text-xs font-medium text-zinc-600">Source<select name="source" defaultValue={searchParams.get('source')??''} className={`${field} mt-1.5 block`}><option value="">All sources</option><option value="web">Web search</option><option value="osm">OpenStreetMap</option><option value="companies_house">Companies House</option></select></label>
        <label className="text-xs font-medium text-zinc-600">Outcome<select name="outcome" defaultValue={searchParams.get('outcome')??''} className={`${field} mt-1.5 block`}><option value="">All outcomes</option>{(view==='errors'?['error','rejected']:['ok','empty','error','rejected']).map(v=><option key={v} value={v}>{v==='ok'?'Results returned':v==='empty'?'No results':v==='error'?'Failed':'Refused'}</option>)}</select></label></>}
      {searchParams.get('userId')&&<input type="hidden" name="userId" value={searchParams.get('userId')??''}/>}
      <button className={`${button} py-2.5`}>Apply filters</button><Link href={pathname} className="py-2.5 text-xs text-zinc-500 underline underline-offset-4">Reset</Link>
    </form>
    {searchParams.get('userId')&&<p className="mb-4 text-sm text-blue-700">Filtered to account #{searchParams.get('userId')}. Use Reset to view all users.</p>}
    <div className="mb-5 flex flex-wrap justify-between gap-2 text-[11px] text-zinc-500"><span>{view==='users'?'Account totals · usage this calendar month':`Selected period: ${days} calendar days · UTC`}</span><span>{updated?`Updated ${when(updated)}`:'Waiting for records'}</span></div>
    {error?<div role="alert" className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}<button onClick={()=>setRefresh(v=>v+1)} className="ml-4 underline">Retry</button></div>:busy?<div role="status" className="border-y border-zinc-200 py-16 text-center text-sm text-zinc-500">Loading operational records…</div>:data&&<>
      {view==='overview'&&<Overview data={data} days={Number(days)}/>}
      {view==='activity'&&<Activity data={data} inspect={setDetailId}/>}
      {view==='errors'&&<Errors data={data}/>}
      {view==='users'&&<Users data={data} refresh={()=>setRefresh(v=>v+1)}/>}
      {view==='operations'&&<Operations data={data}/>}
      {['activity','errors','users'].includes(view)&&<div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500"><span>{count(data.total)} records · Page {num(data.page)} of {Math.max(1,Math.ceil(num(data.total)/num(data.pageSize)))}</span><div className="flex gap-2"><button disabled={num(data.page)<=1} onClick={()=>page(num(data.page)-1)} className={button}>Previous</button><button disabled={num(data.page)*num(data.pageSize)>=num(data.total)} onClick={()=>page(num(data.page)+1)} className={button}>Next</button></div></div>}
    </>}
    <footer className="mt-10 border-t border-zinc-200 pt-5 text-xs leading-6 text-zinc-500">Recorded activity only. Search events and extraction actions have different coverage; missing actions do not prove abandonment. Full result details expire after seven days. Older searches may have no linked result or extraction history.</footer>
    {detailId!=null&&<ResultDetail id={detailId} close={()=>setDetailId(null)}/>}
  </>;
}
function Panel({title,hint,children}:{title:string;hint?:string;children:React.ReactNode}){return <section className="min-w-0 rounded-lg border border-zinc-200 bg-white"><div className="border-b border-zinc-100 px-5 py-4"><h2 className="text-sm font-semibold">{title}</h2>{hint&&<p className="mt-1 text-xs leading-5 text-zinc-500">{hint}</p>}</div><div className="p-5">{children}</div></section>;}
function Table({rows,columns,empty='No matching records.'}:{rows:Row[];columns:Column[];empty?:string}){return rows.length===0?<p className="py-8 text-center text-sm text-zinc-500">{empty}</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-500">{columns.map(([title])=><th key={title} scope="col" className="whitespace-nowrap px-3 py-3 font-medium first:pl-0">{title}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={`${text(r.kind??"")}:${text(r.id??i)}:${i}`} className="border-b border-zinc-100 align-top last:border-b-0 hover:bg-zinc-50/80">{columns.map(([title,render])=><td key={title} className="max-w-[340px] px-3 py-4 first:pl-0">{render(r)}</td>)}</tr>)}</tbody></table></div>;}
function Account({row}:{row:Row}){return <div><div className="font-medium text-zinc-800">{text(row.name||row.email||'Deleted account')}</div>{Boolean(row.name)&&<div className="mt-1 text-xs text-zinc-500">{text(row.email)}</div>}{row.user_id!=null&&<Link href={`/admin/activity?userId=${num(row.user_id)}`} className="mt-1 inline-block text-xs text-blue-700 underline underline-offset-2">Account #{num(row.user_id)}</Link>}</div>;}
function Outcome({value}:{value:unknown}){const v=String(value);return <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${v==='ok'||v==='done'?'bg-emerald-50 text-emerald-800':v==='error'||v==='failed'?'bg-red-50 text-red-800':v==='empty'?'bg-amber-50 text-amber-800':'bg-zinc-100 text-zinc-600'}`}>{({ok:'Results',empty:'No results',error:'Failed',failed:'Failed',rejected:'Refused',refused:'Refused'} as Row)[v] as string??v}</span>;}
function Overview({data,days}:{data:Row;days:number}){
  const t=obj(data,'totals'),x=obj(data,'extraction'),daily=list(data,'daily'),sources=list(data,'sources'),queries=list(data,'queries');
  return <div className="space-y-6">
    <dl className="grid grid-cols-2 divide-x divide-zinc-200 rounded-lg border border-zinc-200 bg-white sm:grid-cols-4">{[['Search attempts',t.attempts],['Searching accounts',t.accounts],['Returned results',t.leads],['Searches extracted',x.searches]].map(([label,value])=><div key={String(label)} className="p-5"><dt className="text-xs text-zinc-500">{String(label)}</dt><dd className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{count(value)}</dd></div>)}</dl>
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><Panel title="Search demand over time" hint="Logged attempts and failed searches · daily counts in UTC"><Trend data={daily} days={days} start={String(data.start)}/></Panel>
      <Panel title="Search outcomes" hint="Refusals are eligibility or admission decisions, separate from technical failures."><Bars rows={[{label:'Results returned',value:t.answered,tone:'bg-blue-600'},{label:'No results',value:t.empty,tone:'bg-amber-500'},{label:'Failed',value:t.errors,tone:'bg-red-500'},{label:'Refused',value:t.rejected,tone:'bg-zinc-400'}]}/><p className="mt-5 text-xs text-zinc-500">Average recorded duration: {duration(t.avg_ms)}. Empty results alone do not identify a source fault.</p></Panel></div>
    <div className="grid gap-6 xl:grid-cols-2"><Panel title="Source performance" hint="Results, empty answers and failures from completed activity logs."><Table rows={sources} columns={[
      ['Source',r=><span className="font-medium">{source(r.source)}</span>],['Runs',r=>count(r.attempts)],['Results',r=>count(r.answered)],['Empty',r=>count(r.empty)],['Failed',r=>count(r.errors)],['Avg.',r=>duration(r.avg_ms)]]}/></Panel>
      <Panel title="Recorded extraction" hint="Unique searches per action. Actions overlap; they are not sequential funnel stages."><Bars rows={[{label:'CSV requested',value:x.exports,tone:'bg-blue-600'},{label:'Copied',value:x.copies,tone:'bg-zinc-600'},{label:'Saved contacts',value:x.saves,tone:'bg-emerald-600'}]}/><p className="mt-5 text-xs leading-5 text-zinc-500">Export and copy are browser-reported. Saves require a successful contact import. New metadata persists after result expiry. Returned results may include repeat businesses.</p></Panel></div>
    <Panel title="Most requested niches and places" hint="Use real query demand to prioritize London audiences and source coverage."><Table rows={queries} columns={[
      ['Business niche',r=><span className="font-medium">{text(r.niche)}</span>],['Location',r=>text(r.location)],['Source',r=>source(r.source)],['Attempts',r=>count(r.attempts)],['Returned',r=>count(r.leads)]]}/></Panel>
  </div>;
}
function Bars({rows}:{rows:{label:string;value:unknown;tone:string}[]}){const max=Math.max(1,...rows.map(r=>num(r.value)));return <div className="space-y-5">{rows.map(r=><div key={r.label}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-zinc-600">{r.label}</span><span className="font-semibold tabular-nums">{count(r.value)}</span></div><div className="h-2 rounded bg-zinc-100"><div className={`h-2 rounded ${r.tone}`} style={{width:`${num(r.value)/max*100}%`}}/></div></div>)}</div>;}
function Trend({data,days,start}:{data:Row[];days:number;start:string}){
  const points=Array.from({length:days},(_,i)=>{const at=new Date(start);at.setUTCDate(at.getUTCDate()+i);const day=at.toISOString().slice(0,10);const row=data.find(r=>r.day===day);return {day,attempts:num(row?.attempts),errors:num(row?.errors)};});
  const max=Math.max(1,...points.map(r=>r.attempts)),w=640,h=210,left=35,bottom=170;
  const path=(key:'attempts'|'errors')=>points.map((p,i)=>`${i?'L':'M'}${left+i*(w-left-12)/Math.max(1,days-1)} ${bottom-p[key]/max*145}`).join(' ');
  return <><div className="mb-3 flex gap-5 text-xs text-zinc-500"><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-600"/>Attempts</span><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500"/>Failures</span></div>
    {data.length===0?<p className="py-16 text-center text-sm text-zinc-500">No searches logged in this period.</p>:<svg role="img" aria-label={`Daily search attempts and failures across ${days} days. Exact values in the table below.`} viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0,.5,1].map(k=><g key={k}><line x1={left} x2={w-12} y1={bottom-k*145} y2={bottom-k*145} stroke="#e4e4e7" strokeDasharray="3 4"/><text x="2" y={bottom-k*145+4} fontSize="10" fill="#71717a">{Math.round(max*k)}</text></g>)}
      <path d={path('attempts')} fill="none" stroke="#2563eb" strokeWidth="2.5"/><path d={path('errors')} fill="none" stroke="#ef4444" strokeWidth="2"/>
      {points.map((p,i)=><circle key={p.day} cx={left+i*(w-left-12)/Math.max(1,days-1)} cy={bottom-p.attempts/max*145} r={days>30?1:3} fill="#2563eb"><title>{p.day}: {p.attempts} attempts, {p.errors} failures</title></circle>)}
      <text x={left} y="198" fontSize="10" fill="#71717a">{points[0].day}</text><text x={w-12} y="198" fontSize="10" textAnchor="end" fill="#71717a">{points.at(-1)?.day}</text>
    </svg>}
    <details className="mt-2 text-xs text-zinc-500"><summary className="cursor-pointer underline underline-offset-4">View exact daily counts</summary><Table rows={points} columns={[
      ['Date UTC',r=>text(r.day)],['Attempts',r=>count(r.attempts)],['Failures',r=>count(r.errors)]]}/></details></>;
}
function Activity({data,inspect}:{data:Row;inspect:(id:number)=>void}){return <div className="space-y-6"><Panel title="Individual search records" hint="Cache hits count reused lookups, including memory and shared work; misses start fresh fetches. Searches can combine both. These are not lead counts or per-business provenance. Export includes the first 1,000 matching records."><Table rows={list(data,'rows')} columns={[
  ['Account',r=><Account row={r}/>],['Search',r=><div className="min-w-44"><p className="font-medium">{text(r.niche)}</p><p className="mt-1 text-xs text-zinc-500">{text(r.location)}</p><p className="mt-2 text-[11px] text-zinc-400">{when(r.created_at)}</p></div>],
  ['Source / filter',r=><div>{source(r.source)}<p className="mt-1 text-xs text-zinc-500">{text(r.filter)}</p></div>],['Results',r=><span className="whitespace-nowrap tabular-nums">{count(r.returned)} / {count(r.requested)}</span>],
  ['Cache lookups',r=><div className="whitespace-nowrap text-xs leading-6 tabular-nums"><div>{count(r.cache_hits)} hits</div><div className="text-zinc-500">{count(r.cache_misses)} misses</div>{num(r.cache_hits)===0&&num(r.cache_misses)===0&&<div className="text-zinc-400">No recorded lookups</div>}</div>],
  ['Outcome',r=><><Outcome value={r.outcome}/><p className="mt-2 text-xs text-zinc-500">{duration(r.latency_ms)}</p>{Boolean(r.detail)&&<details className="mt-2 max-w-52 text-xs"><summary className="cursor-pointer text-zinc-500">Details</summary><p className="mt-2 break-words">{text(r.detail)}</p></details>}</>],
  ['Follow-through',r=><div className="min-w-28 text-xs leading-6 text-zinc-500">{Boolean(r.opened_at)&&<div>Opened</div>}{Boolean(r.exported_at)&&<div>CSV requested</div>}{Boolean(r.copied_at)&&<div>Copied</div>}{Boolean(r.saved_at)&&<div>Saved contacts</div>}{!r.opened_at&&!r.exported_at&&!r.copied_at&&!r.saved_at&&<div>No linked action</div>}{r.job_id!=null&&<button onClick={()=>inspect(num(r.job_id))} className="mt-1 font-medium text-blue-700 underline underline-offset-4">View businesses</button>}</div>]
  ]}/></Panel><Panel title="Extraction history" hint="Latest 25 export, copy and save actions matching user, niche/location, source and date. Outcome filter applies to the search table above only."><Table rows={list(data,'extractions')} columns={[
    ['Account',r=><Account row={r}/>],['Business niche',r=>text(r.niche)],['Location',r=>text(r.location)],['Action',r=>({exported:'CSV requested',copied:'Copied',saved:'Saved contacts'} as Row)[String(r.action)] as string],['Result count',r=>count(r.lead_count)],['Recorded',r=>when(r.created_at)]]}/></Panel></div>;}
function Errors({data}:{data:Row}){return <Panel title="Recorded issues" hint="Coverage: search eligibility/admission/execution, audit rechecks and queue interruptions. General browser errors and every provider substep are not recorded. Refused audit requests appear when All outcomes is selected."><Table rows={list(data,'rows')} columns={[
  ['Account',r=><Account row={r}/>],['Flow / stage',r=><div className="min-w-32 font-medium">{text(r.kind)}<p className="mt-1 text-xs font-normal text-zinc-500">{text(r.stage)}</p></div>],['Query / website',r=><div className="min-w-40"><p className="break-words">{text(r.niche)}</p><p className="mt-1 text-xs text-zinc-500">{text(r.location)}</p></div>],['Source',r=>source(r.source)],['Issue',r=><div className="min-w-48"><Outcome value={r.outcome}/><p className="mt-2 break-words text-xs leading-5 text-zinc-600">{text(r.detail)}</p></div>],['Recorded',r=><span className="whitespace-nowrap text-xs text-zinc-500">{when(r.created_at)}</span>]]}/></Panel>;}
function Users({data,refresh}:{data:Row;refresh:()=>void}){
  const[drafts,setDrafts]=useState<Record<string,string>>({}),[busy,setBusy]=useState<number|null>(null),[error,setError]=useState('');
  async function save(row:Row){const id=num(row.id);setBusy(id);setError('');try{const res=await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:id,plan:drafts[id]})});const body=await res.json();if(!res.ok)throw new Error(body.error??'Plan update failed');refresh();}catch(e){setError(e instanceof Error?e.message:'Plan update failed');}finally{setBusy(null);}}
  return <Panel title="Account directory" hint="Plan assignments do not collect payment. Confirm the commercial agreement before applying a paid plan. Every changed assignment is logged.">{error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}<Table rows={list(data,'rows')} columns={[
    ['Account',r=><Account row={{...r,user_id:r.id}}/>],['Access',r=><div className="text-xs text-zinc-500">{num(r.is_admin)===1?'Administrator':'Customer'}<p className="mt-1">{num(r.email_verified)?'Email verified':'Email unverified'}</p></div>],
    ['Plan',r=><div className="flex min-w-40 flex-wrap items-center gap-2"><label><span className="sr-only">Plan for {text(r.email)}</span><select disabled={busy===num(r.id)} value={drafts[String(r.id)]??String(r.plan)} onChange={e=>setDrafts(v=>({...v,[String(r.id)]:e.target.value}))} className={field}>{['free','starter','pro'].map(p=><option value={p} key={p}>{p}</option>)}</select></label>{drafts[String(r.id)]&&drafts[String(r.id)]!==r.plan&&<button disabled={busy!=null} onClick={()=>save(r)} className={button}>{busy===num(r.id)?'Saving…':'Apply'}</button>}</div>],
    ['Usage this month',r=><span className="tabular-nums">{count(r.used)} results</span>],['Contacts',r=>count(r.contacts)],['Search / actions',r=><div className="text-xs leading-6">{count(r.searches)} searches<br/>{count(r.extraction_actions)} extraction actions</div>],['Last search',r=><span className="whitespace-nowrap text-xs text-zinc-500">{when(r.last_search)}</span>]]}/></Panel>;
}
function Operations({data}:{data:Row}){
  const c=obj(data,'cache'),f=obj(data,'features'),r=obj(data,'rechecks');
  const features=[['Business discovery','Available'],['Website audits and rechecks','Available'],['Export, copy and saved contacts','Available'],['Owner lookups','Available · shares result allowance'],['Manual plan assignment','Available · self-serve checkout not connected'],['Outreach / campaigns',f.outreach?'Enabled':'Parked'],['New-business watches',f.newBusinesses?'Enabled':'Parked'],['Companies House key',f.companiesHouseConfigured?'Configured · connectivity not verified':'Not configured'],['Exa key',f.exaConfigured?'Configured · connectivity not verified':'Not configured · fallback may apply'],['Customer registration',f.signupsOpen?'Open':'Closed'],['Database adapter',text(f.database)],['Public origin',f.publicUrlConfigured?'APP_URL configured':'APP_URL not configured'],['Admin cookie transport',f.secureAdminCookie?'Secure cookie enabled':'Local HTTP override / development']];
  return <div className="space-y-6"><div className="grid gap-6 xl:grid-cols-2"><Panel title="Queue state" hint="Current retained jobs across accounts. An expired lease waits for the worker recovery sweep."><Table rows={list(data,'queue')} columns={[
    ['State',x=><Outcome value={x.status}/>],['Jobs',x=>count(x.jobs)],['Expired claims',x=>count(x.expired)],['Oldest',x=><span className="whitespace-nowrap text-xs">{when(x.oldest)}</span>]]}/></Panel>
    <Panel title="Cache inventory" hint="Source-specific freshness. Disk hits count database reads only; memory and shared work appear in Activity. Entries and hits are not billable lead units."><div className="mb-4 flex justify-between text-sm"><span>{count(c.entries)} entries</span><span className="text-zinc-500">{count(c.fresh)} fresh</span></div><Table rows={list(c,'byKind')} columns={[
      ['Kind',x=>text(x.kind)],['Entries',x=>count(x.entries)],['Disk hits',x=>count(x.hits)]]}/></Panel></div>
    <Panel title="Feature and configuration inventory" hint="Configuration status is not proof of connectivity. This panel does not enable features or expose credentials."><dl className="grid gap-x-10 md:grid-cols-2">{features.map(([label,value])=><div key={label} className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 py-3 text-xs"><dt className="font-medium text-zinc-600">{label}</dt><dd>{value}</dd></div>)}</dl><p className="mt-5 text-xs leading-6 text-zinc-500">When Outreach is parked, campaign/message APIs and campaign/inbox workers are disabled. Search workers continue processing the lead queue.</p></Panel>
    <Panel title="Audit rechecks" hint="Selected period · a recheck is separate from a new search."><div className="flex flex-wrap gap-8 text-sm">{[['Attempts',r.attempts],['Completed',r.ok],['Failed',r.failed],['Refused',r.refused]].map(([label,value])=><p key={String(label)}><span className="text-zinc-500">{String(label)}</span><strong className="ml-3 tabular-nums">{count(value)}</strong></p>)}</div></Panel>
    <Panel title="Administrator activity" hint="Latest 25 sign-ins, sign-outs and changed plan assignments within the selected period."><Table rows={list(data,'audit')} columns={[
      ['Action',x=>text(x.action)],['Administrator',x=>text(x.actor)],['Affected user',x=>text(x.subject)],['Change',x=>text(x.detail)],['Recorded',x=>when(x.created_at)]]}/></Panel>
  </div>;
}
function ResultDetail({id,close}:{id:number;close:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);const[data,setData]=useState<Row|null>(null),[error,setError]=useState('');
  useEffect(()=>{ref.current?.showModal();const controller=new AbortController();void fetch(`/api/admin/jobs/${id}`,{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error??'Result unavailable');setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message??'Unable to load result');});return()=>controller.abort();},[id]);
  return <dialog ref={ref} onClose={close} aria-labelledby="result-title" className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl backdrop:bg-zinc-950/40">
    <div className="flex items-start justify-between gap-4"><div><h2 id="result-title" className="text-lg font-semibold">Retained search #{id}</h2><p className="mt-1 text-xs text-zinc-500">Business names and public qualification fields only. Results expire after seven days.</p></div><button onClick={()=>ref.current?.close()} className={button} autoFocus>Close</button></div>
    {error?<p role="alert" className="mt-6 text-sm text-red-700">{error}</p>:!data?<p role="status" className="py-12 text-sm text-zinc-500">Loading businesses…</p>:<><p className="mt-6 border-y border-zinc-200 py-4 text-sm"><strong>{text(data.niche)}</strong> · {text(data.location)}<span className="mt-1 block text-xs text-zinc-500">{text(data.email)} · {source(data.source)} · {count(data.leadCount)} results</span></p><Table rows={list(data,'leads')} columns={[
      ['Business',r=><span className="font-medium">{text(r.business)}</span>],['Location',r=>text(r.location)],['Category',r=>text(r.category)],['Website',r=><span className="break-all text-xs">{text(r.website)}</span>]]}/></>}
  </dialog>;
}
