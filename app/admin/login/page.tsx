"use client";
import { Suspense,useState } from "react";
import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import { safeAdminNext } from "@/lib/admin-policy";

function AdminLoginForm() {
  const router=useRouter(),params=useSearchParams();
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try {
      const response=await fetch("/api/admin/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      const body=await response.json();if(!response.ok)throw new Error(body.error??"Unable to sign in");
      router.replace(safeAdminNext(params.get("next")));router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Unable to sign in");setBusy(false);}
  }
  return <div className="grid min-h-screen bg-zinc-50 lg:grid-cols-2">
    <div className="hidden flex-col justify-between bg-zinc-950 p-12 text-white lg:flex">
      <Link href="/" className="text-lg font-semibold tracking-tight">Outreach Studio <span className="ml-3 text-xs font-normal text-zinc-400">Operations</span></Link>
      <div className="max-w-lg"><p className="text-xs font-medium uppercase tracking-widest text-blue-300">Administration</p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight">Understand the searches.<br/>Improve the product.</h1>
        <p className="mt-6 text-base leading-7 text-zinc-400">Search demand, extraction activity and operational issues in one workspace for the people running the product.</p>
        <div className="mt-9 border-t border-zinc-800 pt-5 text-sm text-zinc-400">User activity <span className="mx-4">/</span> Source performance <span className="mx-4">/</span> Errors</div>
      </div><p className="text-xs text-zinc-500">Restricted to existing administrator accounts.</p>
    </div>
    <main className="flex items-center justify-center px-6 py-14"><div className="w-full max-w-sm">
      <p className="mb-10 text-sm font-semibold text-zinc-950 lg:hidden">Outreach Studio · Administration</p>
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Admin workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Sign in to operations</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-500">Use your administrator account. This session is separate from your customer workspace.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-sm font-medium text-zinc-700">Administrator email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"/></label>
        <label className="block text-sm font-medium text-zinc-700">Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"/></label>
        {error&&<p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={busy} className="w-full rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">{busy?"Signing in…":"Sign in to admin"}</button>
      </form>
      <div className="mt-6 flex justify-between text-xs text-zinc-500"><Link href="/forgot-password" className="underline underline-offset-4">Reset password</Link><Link href="/login" className="underline underline-offset-4">Customer sign-in</Link></div>
      <p className="mt-9 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-500">Admin access expires after eight hours. Customer registration does not grant access to this panel.</p>
    </div></main>
  </div>;
}
export default function AdminLogin(){return <Suspense><AdminLoginForm/></Suspense>;}
