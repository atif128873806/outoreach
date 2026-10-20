"use client";

import { useState } from "react";
import Link from "next/link";
import { PILOT_AUDIENCES, pilotSignupPath, type PilotAudience } from "@/lib/pilot";
import type { PilotPreview } from "@/lib/pilot-preview";
import Icon from "./Icon";

export default function LondonPreview({ initialAudience = "agencies", compact = false }: { initialAudience?: PilotAudience; compact?: boolean }) {
  const [audience, setAudience] = useState<PilotAudience>(initialAudience);
  const [result, setResult] = useState<PilotPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = PILOT_AUDIENCES[audience];
  async function load() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/pilot/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The sample could not load. Please retry.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "The sample could not load. Please retry."); }
    finally { setBusy(false); }
  }
  function select(key: PilotAudience) {
    setAudience(key); setResult(null); setError("");
    const url = new URL(window.location.href); url.searchParams.set("audience", key);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  return <section aria-labelledby="london-preview-title" className="live-sample min-w-0 overflow-hidden rounded-xl border border-line bg-canvas">
    <div className="border-b border-line px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-center justify-between gap-4"><h2 id="london-preview-title" className="text-xl font-semibold tracking-tight">Explore the London sample</h2><Icon name="search" className="h-5 w-5 shrink-0 text-muted" /></div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Choose your workflow. Load up to three public business records before creating an account.</p>
      <div aria-label="Choose your workflow" className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(PILOT_AUDIENCES) as PilotAudience[]).map(key => <button key={key} type="button" disabled={busy} aria-pressed={key === audience} onClick={() => select(key)} className={`sample-audience min-h-11 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:opacity-50 ${key === audience ? "border-accent bg-info text-accent" : "border-field text-muted hover:border-muted hover:bg-canvas"}`}>{PILOT_AUDIENCES[key].label}</button>)}
      </div>
    </div>
    <div className="px-5 sm:px-7"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-5">
      <div><h3 className="text-base font-semibold"><span className="capitalize">{selected.niche}</span> in {selected.area}</h3><p className="mt-1 text-sm text-muted">{selected.title}</p></div>
      <button disabled={busy} onClick={() => void load()} className="ui-accent">{busy ? "Loading real sample…" : result ? "Reopen sample" : "Load live sample"}{!busy && <Icon name="arrow" className="h-4 w-4" />}</button>
    </div>
      <div aria-live="polite" aria-busy={busy}>
        <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,1fr)] gap-6 border-b border-line py-3 text-xs font-medium text-muted sm:grid"><span>Business & category</span><span>Sample area</span><span>Listed website</span></div>
        {busy && <p className="py-10 text-sm leading-6 text-muted">Checking the saved sample or fetching it from OpenStreetMap. This can take a few seconds.</p>}
        {error && <p role="alert" className="my-6 rounded-lg bg-danger-surface p-4 text-sm leading-6 text-danger">{error}</p>}
        {!busy && !error && !result && <div className="sample-empty py-8 sm:py-10"><Icon name="map" className="mb-4 h-6 w-6 text-accent"/><p className="text-base font-medium text-ink">A small window into your local market.</p><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Load the selected workflow to see names, categories, sample areas and listed websites. Contact details and website audits are outside this public sample.</p></div>}
        {result && <><ul className="divide-y divide-line">{result.businesses.map((business, index) => <li key={`${business.name}:${index}`} className="preview-record">
          <div className="min-w-0"><h4 className="break-words text-sm font-semibold">{business.name}</h4><p className="mt-1 text-xs leading-5 text-muted">{business.category}</p></div><p className="text-sm leading-6 text-muted">{business.area}</p>
          <div className="min-w-0 text-sm leading-6">{business.website ? <a href={business.website} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline underline-offset-4">{new URL(business.website).hostname}</a> : <span className="text-muted">Website not listed in this source</span>}</div>
        </li>)}</ul>{result.businesses.length === 0 && <p className="py-8 text-sm leading-6 text-muted">No named businesses appeared in this bounded sample. Try another workflow or run your own search after signup.</p>}
          <p className="border-t border-line py-4 text-xs leading-5 text-muted">{result.reused ? "Reused saved sample" : "Fetched from the source"} · Last fetched {new Date(result.fetchedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC. Samples expire after seven days and refresh on the next request.</p>
        </>}
      </div>
      <details className="border-t border-line py-4 text-xs leading-6 text-muted" open={!compact}><summary className="text-sm font-medium text-ink">About this sample</summary>
        <p className="mt-3">Map locations fall within the selected area&apos;s sample box; confirm the business&apos;s trading location. No audit has been run for this preview. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">© OpenStreetMap contributors · ODbL</a></p><p className="mt-2">{selected.guidance}</p>
      </details>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-5 border-t border-line bg-canvas px-5 py-5 sm:px-7"><p className="max-w-lg text-sm leading-6 text-muted">Make this search your own. Your niche and area will be ready to review after signup.</p><Link href={pilotSignupPath(audience)} className="ui-primary shrink-0">Start this search free<Icon name="arrow" className="h-4 w-4" /></Link></div>
  </section>;
}
