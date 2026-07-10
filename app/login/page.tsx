"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400";

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
    >
      <div className="text-lg font-semibold tracking-tight">Outreach Studio</div>
      <p className="text-sm text-zinc-400 mt-1 mb-6">Sign in to your workspace.</p>
      <label className="block mb-4">
        <div className="text-sm font-medium text-zinc-600 mb-1.5">Email</div>
        <input type="email" autoFocus className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block">
        <div className="text-sm font-medium text-zinc-600 mb-1.5">Password</div>
        <input type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
      <button
        type="submit"
        disabled={busy || !email || !password}
        className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-zinc-400 mt-4 text-center">
        No account yet?{" "}
        <Link href="/signup" className="underline hover:text-zinc-600">
          Create one
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
