"use client";
import { Suspense,useState } from "react";
import Link from "next/link";
import AuthFrame from "@/app/components/AuthFrame";
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
  return <AuthFrame><section className="w-full max-w-md rounded-xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="admin-login-title">
      <h1 id="admin-login-title" className="text-[26px] font-semibold tracking-tight text-ink">Sign in to admin</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Use your administrator account. This session is separate from your customer workspace.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-sm font-medium text-ink">Administrator email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="ui-input mt-2"/></label>
        <label className="block text-sm font-medium text-ink">Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="ui-input mt-2"/></label>
        {error&&<p role="alert" className="rounded-md border border-danger-line bg-danger-surface p-3 text-sm text-danger">{error}</p>}
        <button disabled={busy} className="ui-primary w-full">{busy?"Signing in…":"Sign in to admin"}</button>
      </form>
      <div className="mt-6 flex justify-between text-xs text-muted"><Link href="/forgot-password" className="underline underline-offset-4">Reset password</Link><Link href="/login" className="underline underline-offset-4">Customer sign-in</Link></div>
      <p className="mt-9 border-t border-line pt-5 text-xs leading-5 text-muted">Admin access expires after eight hours. Customer registration does not grant access to this panel.</p>
    </section></AuthFrame>;
}
export default function AdminLogin(){return <Suspense><AdminLoginForm/></Suspense>;}
