"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "../components/ui";

interface PersonCandidate {
  name: string;
  linkedin: string;
  role: string;
  isOwner: boolean;
}

interface PeopleState {
  loading?: boolean;
  error?: string;
  candidates?: PersonCandidate[];
  chosen?: PersonCandidate;
}

interface Lead {
  business_name: string;
  category: string;
  website: string;
  phone: string;
  email: string;
  instagram: string;
  linkedin: string;
  address: string;
  notes: string;
  source: string;
  site_flags?: string[];
  tech?: string;
  pixels?: string[];
}

function toCsv(leads: Lead[]): string {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const header = "email,business_name,category,website,instagram,linkedin,phone,notes";
  const rows = leads.map((l) =>
    [
      l.email,
      l.business_name,
      l.category,
      l.website,
      l.instagram,
      l.linkedin,
      l.phone,
      // Company intel + address both help the AI personalize
      [l.notes, l.address].filter(Boolean).join(" — "),
    ]
      .map(esc)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

export default function LeadsPage() {
  const [source, setSource] = useState<"web" | "osm" | "google">("web");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [count, setCount] = useState(10);
  const [websiteFilter, setWebsiteFilter] = useState<"any" | "with" | "without" | "outdated">("any");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [meta, setMeta] = useState<{ found: number; withEmail: number; withInstagram: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [people, setPeople] = useState<Record<number, PeopleState>>({});
  /** Result-view chip: null = all, "pixels" = runs marketing tags, else a stack name. */
  const [chip, setChip] = useState<string | null>(null);

  const chipMatch = (l: Lead) =>
    chip === null ? true : chip === "pixels" ? (l.pixels?.length ?? 0) > 0 : l.tech === chip;
  /** Rows shown in the table (original indexes kept for the people-lookup state). */
  const visible = (leads ?? []).map((l, i) => ({ l, i })).filter(({ l }) => chipMatch(l));

  async function findPeople(i: number) {
    const lead = leads?.[i];
    if (!lead) return;
    setPeople((p) => ({ ...p, [i]: { loading: true } }));
    try {
      const res = await fetch("/api/leads/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_name: lead.business_name, location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setPeople((p) => ({
        ...p,
        [i]: data.candidates.length
          ? { candidates: data.candidates }
          : { error: "No one found" },
      }));
    } catch (err) {
      setPeople((p) => ({
        ...p,
        [i]: { error: err instanceof Error ? err.message : "Lookup failed" },
      }));
    }
  }

  function choosePerson(i: number, c: PersonCandidate) {
    setLeads((ls) => {
      if (!ls) return ls;
      const next = [...ls];
      const l = { ...next[i] };
      const line = `Decision maker: ${c.name}${c.role ? ` (${c.role})` : ""} — linkedin.com/${c.linkedin}`;
      l.notes = l.notes ? `${l.notes} | ${line}` : line;
      if (!l.linkedin) l.linkedin = c.linkedin;
      next[i] = l;
      return next;
    });
    setPeople((p) => ({ ...p, [i]: { chosen: c } }));
  }

  async function search() {
    setSearching(true);
    setError(null);
    setNote(null);
    setLeads(null);
    setImportMsg(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, niche, location, count, websiteFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setLeads(data.leads);
      setMeta(data.meta);
      setNote(data.note ?? null);
      setChip(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function downloadCsv() {
    const rows = visible.map((v) => v.l);
    if (!rows.length) return;
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${niche.replace(/\s+/g, "-")}-${location.replace(/[\s,]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** A lead is importable with an email — or, for offline businesses, with a
   *  name plus another way to reach them (Instagram DM or phone). */
  const importable = (l: Lead) => Boolean(l.email || (l.business_name && (l.instagram || l.phone)));

  async function importToContacts() {
    const withEmail = visible.map((v) => v.l).filter(importable);
    if (withEmail.length === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: toCsv(withEmail) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportMsg(`Imported ${data.imported} contact${data.imported === 1 ? "" : "s"} — ready for a campaign.`);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const emailCount = (leads ?? []).filter((l) => l.email).length;
  const importableCount = visible.filter(({ l }) => importable(l)).length;

  // Chip options derived from the current results (stack names by frequency).
  const stackCounts = new Map<string, number>();
  for (const l of leads ?? []) if (l.tech) stackCounts.set(l.tech, (stackCounts.get(l.tech) ?? 0) + 1);
  const pixelCount = (leads ?? []).filter((l) => (l.pixels?.length ?? 0) > 0).length;
  const chipDefs: { key: string; label: string }[] = [
    ...[...stackCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => ({ key: name, label: `${name} (${n})` })),
    ...(pixelCount > 0 ? [{ key: "pixels", label: `Runs marketing tags (${pixelCount})` }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Lead Finder"
        subtitle="Discover businesses by niche and location, with emails and Instagram handles found automatically"
      />

      <Card className="p-6 mb-6">
        <div className="mb-4">
          <div className="text-sm font-medium text-zinc-600 mb-1.5">Data source</div>
          <div className="flex gap-2">
            <SourceOption
              active={source === "web"}
              onClick={() => setSource("web")}
              title="Web search (AI)"
              desc="Searches the whole web — often finds emails directly. Free, no key."
            />
            <SourceOption
              active={source === "osm"}
              onClick={() => setSource("osm")}
              title="OpenStreetMap"
              desc="Free, no key needed. Open business database."
            />
            <SourceOption
              active={source === "google"}
              onClick={() => setSource("google")}
              title="Google Places"
              desc="Official Google Maps data. Needs an API key in Settings."
            />
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-4 items-end">
          <label className="block md:col-span-1">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">Niche</div>
            <input
              className={inputCls}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. restaurant, dentist, gym"
            />
          </label>
          <label className="block md:col-span-1">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">Location</div>
            <input
              className={inputCls}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. New York, USA"
            />
          </label>
          <label className="block md:col-span-1">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">How many leads</div>
            <select className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-1">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">Website</div>
            <select
              className={inputCls}
              value={websiteFilter}
              onChange={(e) =>
                setWebsiteFilter(e.target.value as "any" | "with" | "without" | "outdated")
              }
            >
              <option value="any">Any</option>
              <option value="with">Has a website</option>
              <option value="without">No website (sell them one!)</option>
              <option value="outdated">Outdated website (redesign prospects)</option>
            </select>
          </label>
          <button
            className={`${btnPrimary} justify-center`}
            onClick={search}
            disabled={searching || !niche.trim() || !location.trim()}
          >
            {searching ? "Searching…" : "Find leads"}
          </button>
        </div>
        {websiteFilter === "outdated" && !searching && (
          <p className="text-xs text-amber-600 mt-3">
            Redesign-prospect mode: every website found is audited for concrete problems —
            no HTTPS, not mobile-friendly, free-builder hosting, ancient copyright dates,
            2000s-era code. Only flawed sites are kept, and each lead&apos;s notes list
            exactly what&apos;s wrong: ready-made talking points for your pitch.{" "}
            {source !== "web" && "Tip: the Web search (AI) source works best here — every result has a site to audit."}
          </p>
        )}
        {websiteFilter === "without" && !searching && (
          <p className="text-xs text-amber-600 mt-3">
            Offline-business mode: automatically searches map data (OpenStreetMap, plus
            Google Places if you added a key — your source selection above is ignored),
            then hunts each business&apos;s Instagram, phone, and email across the web.
            Ideal prospects for selling websites &amp; digital services; reach them with
            an Instagram DM campaign or a call.
          </p>
        )}
        {searching && <SearchProgress source={source} />}
        {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
        {note && <div className="text-sm text-amber-600 mt-3">{note}</div>}
      </Card>

      {searching && <SkeletonResults rows={Math.min(count, 6)} />}

      {!searching && leads && leads.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              <span className="font-medium">{meta?.found} leads</span>
              <span className="text-zinc-400">
                {" "}· {meta?.withEmail} with email · {meta?.withInstagram} with Instagram
              </span>
            </div>
            <div className="flex gap-2">
              <button className={btnSecondary} onClick={downloadCsv}>
                Download CSV
              </button>
              <button
                className={btnPrimary}
                onClick={importToContacts}
                disabled={importing || importableCount === 0}
              >
                {importing ? "Importing…" : `Import ${importableCount} → Contacts`}
              </button>
            </div>
          </div>
          {importMsg && (
            <div className="px-5 py-3 border-b border-zinc-100 text-sm text-emerald-700 bg-emerald-50">
              {importMsg}{" "}
              <Link href="/campaigns" className="underline font-medium">
                Create a campaign →
              </Link>
            </div>
          )}
          {chipDefs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-zinc-100">
              <button
                onClick={() => setChip(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  chip === null
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                All ({leads.length})
              </button>
              {chipDefs.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setChip(chip === c.key ? null : c.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    chip === c.key
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {chip !== null && (
                <span className="text-xs text-zinc-400">
                  showing {visible.length} of {leads.length} — import &amp; CSV follow this filter
                </span>
              )}
            </div>
          )}
          <div className="x-scroll">
            <table className="w-full min-w-[1150px] text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Business</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Social</th>
                  <th className="px-4 py-2.5 font-medium">Decision maker</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 font-medium">Website</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.map(({ l, i }) => (
                  <tr key={i} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{l.business_name}</div>
                      {l.address && <div className="text-xs text-zinc-400">{l.address}</div>}
                      {l.notes && (
                        <div className="text-xs text-zinc-400 mt-0.5 max-w-72 truncate" title={l.notes}>
                          {l.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {l.email || <span className="text-zinc-300">not found</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        {l.instagram && (
                          <a
                            href={`https://instagram.com/${l.instagram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pink-600 hover:underline text-xs"
                          >
                            @{l.instagram}
                          </a>
                        )}
                        {l.linkedin && (
                          <a
                            href={`https://www.linkedin.com/${l.linkedin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-700 hover:underline text-xs"
                          >
                            in/{l.linkedin.split("/")[1] ?? l.linkedin}
                          </a>
                        )}
                        {!l.instagram && !l.linkedin && <span className="text-zinc-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <PersonCell
                        state={people[i]}
                        onFind={() => findPeople(i)}
                        onChoose={(c) => choosePerson(i, c)}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs">{l.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-xs max-w-48 truncate">
                      {l.website ? (
                        <div>
                          <a href={l.website} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:underline">
                            {l.website.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
                          {(l.site_flags?.length ?? 0) > 0 && (
                            <div
                              className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                              title={l.site_flags!.join(" · ")}
                            >
                              ⚠ needs redesign · {l.site_flags!.length} issue{l.site_flags!.length > 1 ? "s" : ""}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {l.tech && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                {l.tech}
                              </span>
                            )}
                            {(l.pixels ?? []).map((p) => (
                              <span
                                key={p}
                                className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
                                title="This business invests in marketing"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {leads && leads.length === 0 && !note && (
        <Card className="p-12 text-center text-sm text-zinc-400">No results.</Card>
      )}
    </div>
  );
}

function PersonCell({
  state,
  onFind,
  onChoose,
}: {
  state?: PeopleState;
  onFind: () => void;
  onChoose: (c: PersonCandidate) => void;
}) {
  if (state?.chosen) {
    return (
      <a
        href={`https://www.linkedin.com/${state.chosen.linkedin}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-sky-700 hover:underline"
        title={state.chosen.role}
      >
        ✓ {state.chosen.name}
      </a>
    );
  }
  if (state?.loading) return <span className="text-xs text-zinc-400">Searching…</span>;
  if (state?.error) return <span className="text-xs text-zinc-400">{state.error}</span>;
  if (state?.candidates) {
    return (
      <div className="flex flex-col gap-1">
        {state.candidates.map((c) => (
          <button
            key={c.linkedin}
            onClick={() => onChoose(c)}
            title={`Attach to this lead${c.role ? ` — ${c.role}` : ""}`}
            className="text-left text-xs rounded border border-zinc-200 px-1.5 py-0.5 hover:border-zinc-400"
          >
            {c.isOwner && "★ "}
            {c.name}
            {c.role && <span className="text-zinc-400"> · {c.role.slice(0, 26)}</span>}
          </button>
        ))}
      </div>
    );
  }
  return (
    <button onClick={onFind} className="text-xs text-zinc-400 hover:text-zinc-700 underline decoration-dotted">
      👤 Find owner
    </button>
  );
}

function SourceOption({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
          : "border-zinc-200 hover:border-zinc-400"
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{desc}</div>
    </button>
  );
}

/** Staged progress line — tells the user what the pipeline is doing right now. */
const SEARCH_STAGES: { at: number; label: (src: string) => string }[] = [
  { at: 0, label: (src) => `Searching ${src} for businesses…` },
  { at: 6, label: () => "Found candidates — visiting their websites…" },
  { at: 16, label: () => "Extracting emails, Instagram, and LinkedIn…" },
  { at: 32, label: () => "Rendering JS-heavy sites to find hidden contact info…" },
  { at: 50, label: () => "Sorting the most contactable leads first — almost done…" },
];

function SearchProgress({ source }: { source: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const srcName =
    source === "web" ? "the web" : source === "osm" ? "OpenStreetMap" : "Google Places";
  let idx = 0;
  for (let i = 0; i < SEARCH_STAGES.length; i++) if (elapsed >= SEARCH_STAGES[i].at) idx = i;
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2.5 text-sm text-zinc-600">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
        {SEARCH_STAGES[idx].label(srcName)}
        <span className="text-xs tabular-nums text-zinc-400">{elapsed}s</span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {SEARCH_STAGES.map((s, i) => (
          <span
            key={s.at}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
              i <= idx ? "bg-blue-600" : "bg-zinc-100"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Shimmer placeholder rows where the results will appear. */
function SkeletonResults({ rows }: { rows: number }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 px-5 py-4">
            <span className="h-9 w-9 shrink-0 rounded-lg bg-zinc-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-44 max-w-full rounded bg-zinc-100" />
              <div className="h-3 w-64 max-w-full rounded bg-zinc-100/80" />
            </div>
            <span className="hidden h-5 w-24 rounded-full bg-zinc-100 sm:block" />
            <span className="hidden h-5 w-20 rounded-full bg-zinc-100 md:block" />
          </div>
        ))}
      </div>
    </Card>
  );
}
