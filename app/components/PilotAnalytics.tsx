"use client";
import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { pilotAudience,type PilotBrowserEvent } from "@/lib/pilot";
export function trackPilot(event:PilotBrowserEvent){
  void fetch('/api/pilot/journey',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'event',event,audience:pilotAudience(new URLSearchParams(window.location.search).get('audience'))})}).catch(()=>{});
}
export default function PilotAnalytics(){
  const pathname=usePathname();const[choice,setChoice]=useState<string|null|undefined>(undefined);
  const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const excluded=pathname.startsWith('/admin');
  function pageEvent(){if(pathname==='/')trackPilot('landing_view');if(pathname==='/demo')trackPilot('preview_view');if(pathname==='/signup')trackPilot('signup_view');}
  useEffect(()=>{if(excluded)return;const controller=new AbortController();
    void fetch('/api/pilot/journey',{signal:controller.signal,cache:'no-store'}).then(r=>r.json()).then(d=>{
      if(!controller.signal.aborted){setChoice(d.consented?'allowed':d.choice??null);if(d.consented){
        if(pathname==='/')trackPilot('landing_view');if(pathname==='/demo')trackPilot('preview_view');if(pathname==='/signup')trackPilot('signup_view');}}}).catch(()=>{});
    return()=>controller.abort();
  },[pathname,excluded]);
  async function choose(allow:boolean){setBusy(true);setError('');try{
    const r=await fetch('/api/pilot/journey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'consent',allow,audience:pilotAudience(new URLSearchParams(window.location.search).get('audience'))})});
    if(!r.ok)throw new Error();setChoice(allow?'allowed':'declined');setOpen(false);if(allow)pageEvent();
  }catch{setError('Could not save your preference. Please retry; you can keep using the product.');}finally{setBusy(false);}}
  if(excluded||choice===undefined)return null;
  return <aside aria-label="Pilot analytics preferences" className="border-t border-line bg-canvas px-6 py-5 text-sm text-ink"><div className="mx-auto max-w-6xl">
    {choice===null||open?<div className="flex flex-wrap items-center justify-between gap-4"><div className="max-w-2xl"><h2 className="font-semibold text-ink">Help improve the London pilot</h2><p className="mt-1 leading-6">Allow optional first-party analytics to connect this browser&apos;s preview, signup and search actions. After signup, those actions link to your account. No advertising trackers. You can withdraw below.</p><Link href="/privacy" className="mt-1 inline-block text-accent underline underline-offset-4">What we record and keep</Link></div>
      <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>void choose(false)} className="rounded-md border border-field px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">{choice==='allowed'?'Withdraw & delete journey':'No thanks'}</button><button disabled={busy} onClick={()=>void choose(true)} className="rounded-md border border-field px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">Allow pilot analytics</button>{choice!==null&&<button onClick={()=>setOpen(false)} className="px-2 py-2 underline underline-offset-4">Close</button>}</div></div>:<button onClick={()=>setOpen(true)} className="text-xs text-muted underline underline-offset-4">Analytics preferences · {choice==='allowed'?'allowed':'declined'}</button>}
    {error&&<p role="alert" className="mt-3 text-danger">{error}</p>}</div></aside>;
}
