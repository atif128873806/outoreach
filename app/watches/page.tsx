"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Watch {
  id: number;
  niche: string;
  location: string;
  lastCheckedAt: string | null;
  unseen: number;
  lastError: string;
}

interface Company {
  company_number: string;
  business_name: string;
  address: string;
  notes: string;
  directors: string;
  incorporated_on: string;
  found_at: string;
  /** 1 once the user has looked at the list since this company was found. */
  seen: number;
}

interface Group {
  watch: { id: number; niche: string; location: string; lastCheckedAt: string | null };
  companies: Company[];
}

/** The register's own page for a company — the evidence behind the row. */
function registerUrl(number: string): string {
  return `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(number)}`;
}

/**
 * What is left of a company's notes once the parts this row already shows are
 * removed. They were written for a lead row, so they repeat the registration
 * date, the company number and the directors; what they add is the SIC codes —
 * "what the trade actually is" when the name doesn't say, which matters here
 * because "Virtex Renewables Ltd" tells you nothing — plus the standing warning
 * that a registered office is not necessarily where anyone works.
 */
function extraNotes(notes: string): string {
  return notes
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !/^(Registered |Company no\.|Directors:)/i.test(s))
    .join("; ");
}

function whenPhrase(iso: string): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "registered today";
  if (days === 1) return "registered yesterday";
  if (days < 14) return `registered ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `registered ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  const months = Math.floor(days / 30);
  return `registered ${months} ${months === 1 ? "month" : "months"} ago`;
}

export default function WatchesPage() {
  const [watchList, setWatchList] = useState<Watch[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [registerConfigured, setRegisterConfigured] = useState(true);
  // null until the server has answered: whether email is delivered is a fact
  // about the deployment, and guessing either way shows one of the two
  // sentences briefly — the wrong one, to whoever it matters to.
  const [emailDigest, setEmailDigest] = useState<boolean | null>(null);
  const [eligible, setEligible] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");

  const loadWatches = useCallback(async () => {
    const res = await fetch("/api/watches");
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error ?? "Could not load your searches");
      return;
    }
    setWatchList(data.watches ?? []);
    setUnseen(Number(data.unseen ?? 0));
    setRegisterConfigured(Boolean(data.registerConfigured));
    setEmailDigest(Boolean(data.emailDigest));
    return data.watches as Watch[];
  }, []);

  const loadDigest = useCallback(async () => {
    const res = await fetch("/api/watches/digest");
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) setEligible(false);
      setNotice(data.error ?? "Could not load your digest");
      return;
    }
    setEligible(true);
    setGroups(data.groups ?? []);
    setUnseen(Number(data.unseen ?? 0));
    setRegisterConfigured(Boolean(data.registerConfigured));
    setEmailDigest(Boolean(data.emailDigest));
  }, []);

  useEffect(() => {
    (async () => {
      const watches = await loadWatches();
      await loadDigest();
      setLoaded(true);
      // A watch that has never been checked has nothing to show, so the first
      // visit does the check rather than presenting an empty page and a button.
      if (watches && watches.length > 0 && watches.some((w) => !w.lastCheckedAt)) {
        void check();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWatches, loadDigest]);

  async function check() {
    setBusy(true);
    setNotice(null);
    setErrors([]);
    try {
      const res = await fetch("/api/watches/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "Check failed");
        return;
      }
      setGroups(data.groups ?? []);
      setUnseen(Number(data.unseen ?? 0));
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      if (data.checked === 0) setNotice("Nothing to check yet.");
      await loadWatches();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  async function addWatch(e: React.FormEvent) {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim(), location: location.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "Could not save that search");
        return;
      }
      setWatchList(data.watches ?? []);
      setNiche("");
      setLocation("");
      await check();
    } finally {
      setBusy(false);
    }
  }

  async function removeWatch(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/watches?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setWatchList(data.watches ?? []);
        setGroups((g) => g.filter((x) => x.watch.id !== id));
        setUnseen(Number(data.unseen ?? 0));
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * Clears the badge once the list has been rendered — not before. The clear is
   * a *count* being reset: the companies stay on the page, and the sidebar stops
   * claiming there is something the user has not seen.
   */
  useEffect(() => {
    if (!loaded || unseen === 0) return;
    void fetch("/api/watches/digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seen" }),
    }).then((res) => {
      if (!res.ok) return;
      setUnseen(0);
      // The sidebar's badge is loaded once per page and refreshed on
      // navigation; without this it would still say "13" while the user looks at
      // the thirteen rows on this very page.
      window.dispatchEvent(new Event("watches:seen"));
    });
  }, [loaded, unseen]);

  const totalShown = groups.reduce((n, g) => n + g.companies.length, 0);

  if (!eligible) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">New businesses</h1>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="font-medium text-zinc-800">Watching a search is part of Starter and Pro</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Save a niche and a place, and each week we ask the official UK register what has been
            incorporated since you last looked — with the directors named. New businesses are
            collected for you, so you are not checking a list that has not changed.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            See plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New businesses</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Save a search and we ask the UK register what has been incorporated since you last
            looked. A business registered this week has no website yet — and often no site at all.
          </p>
          {emailDigest === true && (
            <p className="mt-2 text-xs text-zinc-400">
              Checked daily, and one email a week per account covering everything new since your
              last one.
            </p>
          )}
        </div>
        <button
          onClick={check}
          disabled={busy || watchList.length === 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check for new"}
        </button>
      </div>

      {!registerConfigured && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This deployment isn&apos;t connected to Companies House, so it can&apos;t watch for new
          businesses. Everything else on the Lead Finder works without it.
        </div>
      )}

      {registerConfigured && emailDigest === false && (
        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          New registrations are collected here every day — they simply aren&apos;t emailed, because
          this deployment has no system mailer configured (<code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">SYSTEM_SMTP_*</code>).
          Open this page, or press <b>Check for new</b>, to collect them.
        </div>
      )}

      <form onSubmit={addWatch} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Niche
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="roofers"
            className="w-44 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Place (UK)
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Leeds, UK"
            className="w-52 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !niche.trim() || !location.trim()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Watch this search
        </button>
        <span className="text-xs text-zinc-400">Up to 10 searches. The register is UK-only.</span>
      </form>

      {notice && <div className="mt-4 text-sm text-amber-600">{notice}</div>}
      {errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      {watchList.length === 0 && loaded && (
        <p className="mt-6 text-sm text-zinc-500">
          Nothing watched yet. Add a niche and a place above — the first check runs immediately.
        </p>
      )}

      {watchList.length > 0 && loaded && totalShown === 0 && (
        <p className="mt-6 text-sm text-zinc-500">
          Nothing registered in your searches yet. That is normal — this is a weekly feed, not a
          live one, and a quiet trade in a quiet town can go a fortnight without an incorporation.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {groups.map(({ watch, companies }) => (
          <section key={watch.id} className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
              <div>
                <div className="text-sm font-semibold text-zinc-800">
                  {watch.niche} in {watch.location}
                </div>
                <div className="text-xs text-zinc-400">
                  {companies.filter((c) => !c.seen).length > 0
                    ? `${companies.filter((c) => !c.seen).length} new since your last look`
                    : `${companies.length} found in the last few weeks`}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Link
                  href={`/leads?niche=${encodeURIComponent(watch.niche)}&location=${encodeURIComponent(
                    watch.location
                  )}&source=companies_house&filter=without`}
                  className="text-sky-700 hover:underline"
                >
                  Work these in Lead Finder →
                </Link>
                <button
                  onClick={() => removeWatch(watch.id)}
                  className="text-zinc-400 hover:text-red-600"
                  title="Stop watching this search"
                >
                  Remove
                </button>
              </div>
            </header>

            {companies.length === 0 ? (
              <p className="px-5 py-4 text-sm text-zinc-400">
                Nothing registered in this trade here yet.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {companies.map((c) => (
                  <li
                    key={c.company_number}
                    className={`px-5 py-3 ${c.seen ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      {!c.seen && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                          new
                        </span>
                      )}
                      <a
                        href={registerUrl(c.company_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-zinc-800 hover:underline"
                      >
                        {c.business_name}
                      </a>
                      {c.company_number && (
                        <span className="font-mono text-xs text-zinc-400">{c.company_number}</span>
                      )}
                      <span className="text-xs text-zinc-400">{whenPhrase(c.incorporated_on)}</span>
                    </div>
                    {c.directors && (
                      <div className="mt-1 text-xs text-zinc-600">
                        <span className="text-zinc-400">Director:</span> {c.directors}
                      </div>
                    )}
                    {c.address && <div className="mt-0.5 text-xs text-zinc-400">{c.address}</div>}
                    {extraNotes(c.notes) && (
                      <div className="mt-0.5 text-xs text-zinc-400">{extraNotes(c.notes)}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-zinc-400">
        Every row comes from the official UK company register, which publishes who runs a company
        but not its website. That is why a row here is a name, a place and a director rather than a
        site audit — open it in the Lead Finder to confirm whether the business has a website before
        you approach them.
      </p>
    </div>
  );
}
