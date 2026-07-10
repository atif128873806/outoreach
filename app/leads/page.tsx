"use client";

import { useState } from "react";
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
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [meta, setMeta] = useState<{ found: number; withEmail: number; withInstagram: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [people, setPeople] = useState<Record<number, PeopleState>>({});

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
        body: JSON.stringify({ source, niche, location, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setLeads(data.leads);
      setMeta(data.meta);
      if (data.note) setNote(data.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function downloadCsv() {
    if (!leads?.length) return;
    const blob = new Blob([toCsv(leads)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${niche.replace(/\s+/g, "-")}-${location.replace(/[\s,]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importToContacts() {
    const withEmail = (leads ?? []).filter((l) => l.email);
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

        <div className="grid md:grid-cols-4 gap-4 items-end">
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
              placeholder="e.g. Lahore, Pakistan"
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
          <button
            className={`${btnPrimary} justify-center`}
            onClick={search}
            disabled={searching || !niche.trim() || !location.trim()}
          >
            {searching ? "Searching…" : "Find leads"}
          </button>
        </div>
        {searching && (
          <p className="text-xs text-zinc-400 mt-3">
            Searching {source === "web" ? "the web" : source === "osm" ? "OpenStreetMap" : "Google Places"}, then visiting each
            business&apos;s website to find emails and Instagram handles — this can take up to a minute…
          </p>
        )}
        {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
        {note && <div className="text-sm text-amber-600 mt-3">{note}</div>}
      </Card>

      {leads && leads.length > 0 && (
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
                disabled={importing || emailCount === 0}
              >
                {importing ? "Importing…" : `Import ${emailCount} with email → Contacts`}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                {leads.map((l, i) => (
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
                        <a href={l.website} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:underline">
                          {l.website.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
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
