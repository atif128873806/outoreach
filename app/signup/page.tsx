"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="text-lg font-semibold tracking-tight">Create your account</div>
        <p className="text-sm text-zinc-400 mt-1 mb-6">
          The first account on a fresh install automatically adopts any existing local data.
        </p>
        <label className="block mb-4">
          <div className="text-sm font-medium text-zinc-600 mb-1.5">Your name</div>
          <input autoFocus className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block mb-4">
          <div className="text-sm font-medium text-zinc-600 mb-1.5">Email</div>
          <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <div className="text-sm font-medium text-zinc-600 mb-1.5">Password</div>
          <input type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="text-xs text-zinc-400 mt-1">At least 8 characters.</div>
        </label>
        {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
        <button
          type="submit"
          disabled={busy || !email || password.length < 8}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-xs text-zinc-400 mt-4 text-center">
          Already have an account?{" "}
          <Link href="/login" className="underline hover:text-zinc-600">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
