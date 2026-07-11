"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
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
        <div className="text-lg font-semibold tracking-tight">Reset your password</div>
        <p className="text-sm text-zinc-400 mt-1 mb-6">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
        {sent ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            If an account exists for <b>{email}</b>, a reset link is on its way. Check
            your inbox — and the spam folder, just in case.
          </div>
        ) : (
          <>
            <label className="block">
              <div className="text-sm font-medium text-zinc-600 mb-1.5">Email</div>
              <input
                type="email"
                autoFocus
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
            <button
              type="submit"
              disabled={busy || !email}
              className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <p className="text-xs text-zinc-400 mt-4 text-center">
          Remembered it?{" "}
          <Link href="/login" className="underline hover:text-zinc-600">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
