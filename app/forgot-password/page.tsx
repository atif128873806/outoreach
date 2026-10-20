"use client";

import { useState } from "react";
import Link from "next/link";
import AuthFrame from "../components/AuthFrame";

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
    "ui-input";

  return (
    <AuthFrame>
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm leading-6 text-muted mt-3 mb-6">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
        {sent ? (
          <div className="rounded-lg bg-success-surface px-3 py-3 text-sm text-success">
            If an account exists for <b>{email}</b>, a reset link is on its way. Check
            your inbox — and the spam folder, just in case.
          </div>
        ) : (
          <>
            <label className="block">
              <div className="text-sm font-medium text-muted mb-1.5">Email</div>
              <input
                type="email"

                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && <div role="alert" className="text-sm text-danger mt-3">{error}</div>}
            <button
              type="submit"
              disabled={busy || !email}
              className="ui-primary mt-6 w-full"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <p className="text-xs text-muted mt-4 text-center">
          Remembered it?{" "}
          <Link href="/login" className="underline hover:text-muted">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
