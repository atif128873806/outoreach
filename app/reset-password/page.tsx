"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import AuthFrame from "../components/AuthFrame";
import { useRouter, useSearchParams } from "next/navigation";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      router.replace("/leads");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
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
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="text-sm leading-6 text-muted mt-3 mb-6">
        You&apos;ll be signed in right after.
      </p>
      {!token ? (
        <div className="rounded-lg bg-warning-surface px-3 py-3 text-sm text-warning">
          This page needs the link from your reset email.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </div>
      ) : (
        <>
          <label className="block mb-4">
            <div className="text-sm font-medium text-muted mb-1.5">New password</div>
            <input
              type="password"

              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="text-xs text-muted mt-1">At least 8 characters.</div>
          </label>
          <label className="block">
            <div className="text-sm font-medium text-muted mb-1.5">Repeat password</div>
            <input
              type="password"
              className={input}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <div role="alert" className="text-sm text-danger mt-3">{error}</div>}
          <button
            type="submit"
            disabled={busy || !password || !confirm}
            className="ui-primary mt-6 w-full"
          >
            {busy ? "Saving…" : "Set new password"}
          </button>
        </>
      )}
      <p className="text-xs text-muted mt-4 text-center">
        <Link href="/login" className="underline hover:text-muted">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthFrame>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthFrame>
  );
}
