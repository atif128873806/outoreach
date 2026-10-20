"use client";

import { useState } from "react";
import { checkSpam, type SpamCheck } from "@/lib/spamcheck";

/** Runs entirely in the browser — nothing you type is sent anywhere. */
export default function SpamCheckerClient() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<SpamCheck | null>(null);

  function run() {
    setResult(checkSpam(subject, body));
  }

  const verdict =
    result == null
      ? null
      : result.score === 0
        ? { label: "Clean — no spam flags", tone: "bg-success-surface text-success border-success-line" }
        : result.score <= 4
          ? { label: `Minor flags (score ${result.score})`, tone: "bg-warning-surface text-warning border-warning-line" }
          : { label: `High spam risk (score ${result.score})`, tone: "bg-danger-surface text-danger border-danger-line" };

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <label className="block">
        <div className="mb-1.5 text-sm font-medium text-muted">Subject line</div>
        <input
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-field"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Quick question about Bright Smile Dental"
        />
      </label>
      <label className="mt-4 block">
        <div className="mb-1.5 text-sm font-medium text-muted">Email body</div>
        <textarea
          rows={8}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-field"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste your cold email here…"
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={run}
          disabled={!subject && !body}
          className="rounded-lg bg-action px-5 py-2.5 text-sm font-semibold text-action-ink hover:bg-action-hover disabled:opacity-50"
        >
          Check for spam flags
        </button>
        <span className="text-xs text-muted">
          Runs in your browser — your email never leaves this page.
        </span>
      </div>

      {result && verdict && (
        <div className="mt-6">
          <div className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${verdict.tone}`}>
            {verdict.label}
          </div>
          {result.warnings.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {result.warnings.map((w) => (
                <li
                  key={w}
                  className="flex gap-2.5 rounded-lg border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-muted"
                >
                  <span className="text-warning">⚠</span>
                  {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No trigger phrases, caps abuse, punctuation spam, or link overload
              detected. Nice — this reads like a human wrote it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
