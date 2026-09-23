"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
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
    "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400";

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
    >
      <div className="text-lg font-semibold tracking-tight">Choose a new password</div>
      <p className="text-sm text-zinc-400 mt-1 mb-6">
        You&apos;ll be signed in right after.
      </p>
      {!token ? (
        <div className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-700">
          This page needs the link from your reset email.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </div>
      ) : (
        <>
          <label className="block mb-4">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">New password</div>
            <input
              type="password"
              autoFocus
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="text-xs text-zinc-400 mt-1">At least 8 characters.</div>
          </label>
          <label className="block">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">Repeat password</div>
            <input
              type="password"
              className={input}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
          <button
            type="submit"
            disabled={busy || !password || !confirm}
            className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Set new password"}
          </button>
        </>
      )}
      <p className="text-xs text-zinc-400 mt-4 text-center">
        <Link href="/login" className="underline hover:text-zinc-600">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
