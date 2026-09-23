"use client";

import { useEffect, useState } from "react";

/**
 * Shows until the signed-in user verifies their email. Verification gates
 * real SMTP sending and the free global AI in the outreach half, and keeps a
 * lead-generation account from being created on a throwaway address.
 */
export default function VerifyEmailBanner() {
  const [unverified, setUnverified] = useState(false);
  const [outreachEnabled, setOutreachEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setOutreachEnabled(Boolean(data?.outreachEnabled));
        if (data?.user && data.user.emailVerified === false) {
          setUnverified(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!unverified) return null;

  async function resend() {
    setStatus("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the email");
      setStatus("sent");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send the email");
      setStatus("error");
    }
  }

  return (
    <div id="verify-email" className="scroll-mt-6 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
        aria-hidden
      >
        <path d="M4 4h16v16H4zM4 7l8 6 8-6" />
      </svg>
      <span className="flex-1">
        {outreachEnabled ? (
          <>
            <b>Verify your email</b> to unlock real sending and free AI writing — we
            sent you a confirmation link when you signed up.
          </>
        ) : (
          <>
            <b>Verify your email</b> to secure your account — we sent you a
            confirmation link when you signed up.
          </>
        )}
      </span>
      {status === "sent" ? (
        <span className="font-medium text-emerald-700">Sent — check your inbox ✓</span>
      ) : (
        <button
          onClick={resend}
          disabled={status === "sending"}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1 font-medium hover:bg-amber-100 disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Resend email"}
        </button>
      )}
      {status === "error" && <span className="text-red-600">{message}</span>}
    </div>
  );
}
