"use client";

import { useState } from "react";

interface Check {
  name: string;
  pass: boolean;
  detail: string;
  advice?: string;
}

interface Result {
  domain: string;
  checks: Check[];
  summary: string;
}

export default function DnsCheckerClient() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tools/dns-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <form onSubmit={run} className="flex flex-wrap gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="yourcompany.com — or paste your email address"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check my domain"}
        </button>
      </form>

      {error && <div className="mt-4 text-sm text-red-500">{error}</div>}

      {result && (
        <div className="mt-6">
          <div className="text-sm text-zinc-600">
            Domain <span className="font-semibold">{result.domain}</span> — {result.summary}
          </div>
          <div className="mt-4 space-y-2.5">
            {result.checks.map((c) => (
              <div key={c.name} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      c.pass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    {c.pass ? "✓" : "✕"}
                  </span>
                  <span className="font-semibold">{c.name}</span>
                  <span className="truncate text-xs text-zinc-400">{c.detail}</span>
                </div>
                {c.advice && (
                  <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                    Fix: {c.advice}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
