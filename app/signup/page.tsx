"use client";

import { Suspense,useState } from "react";
import Link from "next/link";
import AuthFrame from "../components/AuthFrame";
import { useRouter,useSearchParams } from "next/navigation";
import { PILOT_AUDIENCES,pilotAudience,pilotSearchPath,type PilotAudience } from "@/lib/pilot";

export default function SignupPage() {
  return <Suspense fallback={<div className="p-8 text-sm text-muted">Loading signup…</div>}><SignupForm /></Suspense>;
}
function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audience,setAudience]=useState<PilotAudience>(()=>pilotAudience(params.get('audience')));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, audience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      router.replace(pilotSearchPath(audience));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setBusy(false);
    }
  }

  const input =
    "ui-input";

  return (
    <AuthFrame>
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm leading-6 text-muted mt-3 mb-6">
          Start with a London shortlist. No card required. Your niche and location
          will be ready to review before you run the search.
        </p>
        <label className="block mb-4"><span className="mb-1.5 block text-sm font-medium text-muted">Your workflow</span>
          <select className={input} value={audience} onChange={e=>setAudience(pilotAudience(e.target.value))}>
            {(Object.keys(PILOT_AUDIENCES) as PilotAudience[]).map(key=><option key={key} value={key}>{PILOT_AUDIENCES[key].label}</option>)}
          </select></label>
        <p className="mb-5 text-sm leading-6 text-muted">First search: <strong className="capitalize">{PILOT_AUDIENCES[audience].niche}</strong> in {PILOT_AUDIENCES[audience].area}. You can change it inside the app.</p>
        <label className="block mb-4">
          <div className="text-sm font-medium text-muted mb-1.5">Your name</div>
          <input autoComplete="name" maxLength={160} className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block mb-4">
          <div className="text-sm font-medium text-muted mb-1.5">Email</div>
          <input type="email" required autoComplete="email" maxLength={254} className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <div className="text-sm font-medium text-muted mb-1.5">Password</div>
          <input type="password" required autoComplete="new-password" minLength={8} maxLength={1024} className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="text-xs text-muted mt-1">At least 8 characters.</div>
        </label>
        {error && <div role="alert" className="text-sm text-danger mt-3">{error}</div>}
        <button
          type="submit"
          disabled={busy || !email || password.length < 8}
          className="ui-primary mt-6 w-full"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-xs text-muted mt-4 text-center">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(pilotSearchPath(audience))}`} className="underline hover:text-muted">
            Sign in
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
