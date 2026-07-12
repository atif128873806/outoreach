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
        ? { label: "Clean — no spam flags", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" }
        : result.score <= 4
          ? { label: `Minor flags (score ${result.score})`, tone: "bg-amber-50 text-amber-700 border-amber-200" }
          : { label: `High spam risk (score ${result.score})`, tone: "bg-red-50 text-red-600 border-red-200" };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <label className="block">
        <div className="mb-1.5 text-sm font-medium text-zinc-600">Subject line</div>
        <input
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Quick question about Bright Smile Dental"
        />
      </label>
      <label className="mt-4 block">
        <div className="mb-1.5 text-sm font-medium text-zinc-600">Email body</div>
        <textarea
          rows={8}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste your cold email here…"
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={run}
          disabled={!subject && !body}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Check for spam flags
        </button>
        <span className="text-xs text-zinc-400">
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
                  className="flex gap-2.5 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3.5 py-2.5 text-sm text-zinc-600"
                >
                  <span className="text-amber-500">⚠</span>
                  {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              No trigger phrases, caps abuse, punctuation spam, or link overload
              detected. Nice — this reads like a human wrote it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
