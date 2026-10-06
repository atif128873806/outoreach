"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const NAV=[['/admin','Overview','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  ['/admin/activity','Search activity','M4 6h16M4 12h16M4 18h16'],['/admin/errors','Errors & refusals','M12 3 2 21h20L12 3ZM12 9v5m0 3v1'],
  ['/admin/users','Users','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8'],
  ['/admin/operations','Operations','M3 12h4l3-8 4 16 3-8h4']] as const;
export default function AdminFrame({email,children}:{email:string;children:React.ReactNode}){
  const pathname=usePathname();const[error,setError]=useState("");const[busy,setBusy]=useState(false);
  async function signOut(){setBusy(true);try{const r=await fetch('/api/admin/auth/logout',{method:'POST'});if(!r.ok)throw new Error();window.location.assign('/admin/login');}catch{setError('Sign-out failed. Please retry.');setBusy(false);}}
  return <div className="min-h-screen bg-zinc-50 text-zinc-900 lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
    <aside className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0">
      <div className="flex items-center justify-between gap-4 px-5 py-5 lg:block lg:py-8"><Link href="/admin" className="text-base font-semibold tracking-tight text-white">Outreach Studio</Link><div className="mt-1 text-[11px] uppercase tracking-widest text-zinc-500">Admin workspace</div></div>
      <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">{NAV.map(([href,label,path])=><Link key={href} href={href} aria-current={pathname===href?'page':undefined} className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-400 ${pathname===href?'bg-blue-600/15 font-medium text-blue-200':'hover:bg-zinc-900 hover:text-white'}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={path}/></svg>{label}</Link>)}</nav>
      <div className="hidden flex-1 lg:block"/><div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800 px-5 py-4 text-xs lg:block">
        <p className="max-w-full truncate text-zinc-300" title={email}>{email}</p><Link href="/leads" className="inline-block hover:text-white lg:mt-4">Open product ↗</Link><button onClick={signOut} disabled={busy} className="hover:text-white disabled:opacity-50 lg:mt-3 lg:block">{busy?'Signing out…':'Sign out of admin'}</button>{error&&<p role="alert" className="mt-2 text-red-300">{error}</p>}
      </div>
    </aside>
    <main id="admin-main" className="min-w-0 px-4 py-6 sm:px-8 lg:px-10 lg:py-8"><div className="mx-auto max-w-[1400px]">{children}</div></main>
  </div>;
}
