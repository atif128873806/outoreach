"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import AuthFrame from "../components/AuthFrame";
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
      router.replace(next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !next.startsWith("/api/") && !next.startsWith("/admin") ? next : "/leads");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  const input =
    "ui-input";

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
      <p className="text-sm leading-6 text-muted mt-3 mb-6">Continue your business research and return to your saved work.</p>
      <label className="block mb-4">
        <div className="text-sm font-medium text-muted mb-1.5">Email</div>
        <input type="email" required autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block">
        <div className="flex items-baseline justify-between mb-1.5">
          <div className="text-sm font-medium text-muted">Password</div>
          <Link href="/forgot-password" className="text-xs text-muted underline hover:text-muted">
            Forgot password?
          </Link>
        </div>
        <input type="password" required autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <div role="alert" className="text-sm text-danger mt-3">{error}</div>}
      <button
        type="submit"
        disabled={busy || !email || !password}
        className="ui-primary mt-6 w-full"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-muted mt-4 text-center">
        No account yet?{" "}
        <Link href="/signup" className="underline hover:text-muted">
          Create one
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
