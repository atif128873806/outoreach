"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "../components/ui";
// Type-only import — the audit engine itself stays server-side.
import type { SiteAudit } from "@/lib/siteaudit";
// The source inventory is client-safe (metadata only) — the picker renders
// itself from it, so a new source appears here without a change to this page.
import {
  ACTIVE_SOURCES,
  SOURCE_META,
  isSourceId,
  sourceLabel,
  type SourceId,
} from "@/lib/sources/meta";
// Freshness wording comes from its own dependency-free module: the audit age has
// to be described identically here and on the server (lib/freshness.ts).
import { describeFreshness, isOlderThan } from "@/lib/freshness";
// The queue's shape as the server hands it over. Type-only on purpose:
// importing the module itself would drag the database into the browser bundle.
import type { PublicJob } from "@/lib/search-jobs";

interface PersonCandidate {
  name: string;
  /** LinkedIn path ("in/janedoe") or "" when the person was found on X. */
  linkedin: string;
  /** X (Twitter) handle, or "" when found on LinkedIn. */
  x: string;
  role: string;
  isOwner: boolean;
  /** Matched against a director's name from an official record. */
  verified?: boolean;
}

/** The person's own profile, whichever network they were found on. */
function personHref(c: PersonCandidate): string {
  return c.linkedin ? `https://www.linkedin.com/${c.linkedin}` : `https://x.com/${c.x}`;
}

function personLabel(c: PersonCandidate): string {
  return c.linkedin ? `linkedin.com/${c.linkedin}` : `x.com/${c.x}`;
}

type WebsiteFilter = "any" | "with" | "without" | "outdated";

/** One filter as the server reports it: unlocked, or gated behind a plan. */
interface LeadFilterAccess {
  id: WebsiteFilter;
  label: string;
  unlocked: boolean;
  /** Plan that unlocks it, or null when it is already unlocked. */
  requires: string | null;
}

/**
 * The three filters ARE the product: each one is a problem to sell against.
 * "Any business" is the default and still audits whatever it finds.
 */
const WEBSITE_FILTERS: { value: WebsiteFilter; title: string; desc: string }[] = [
  { value: "any", title: "Any business", desc: "Everything found — each one audited" },
  { value: "without", title: "No website", desc: "Sell them their first site" },
  { value: "outdated", title: "Outdated or broken site", desc: "Redesign prospects, evidence included" },
  { value: "with", title: "Has a website", desc: "Website owners — the audit shows the gaps" },
];

/** What the primary button will actually do for the chosen filter — the
 *  button never promises more than the search delivers. */
const FILTER_CTA: Record<WebsiteFilter, string> = {
  any: "Every result is audited — you'll see the score and what's wrong with each site.",
  without: "Finds businesses with no site, then hunts a phone, Instagram or email for each.",
  outdated: "Keeps only sites with a real, checkable problem — worst site first.",
  with: "Website owners, with the audit showing the gaps to pitch against.",
};

/** Short filter wording for the results header. */
const FILTER_SHORT: Record<WebsiteFilter, string> = {
  any: "all businesses, each audited",
  without: "no website",
  outdated: "outdated or broken site",
  with: "has a website",
};

const SORT_SHORT: Record<"prospects" | "worst" | "reachable", string> = {
  prospects: "best prospects first",
  worst: "worst site first",
  reachable: "easiest to reach first",
};

function FilterOption({
  active,
  onClick,
  title,
  desc,
  lockedFor,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  /** Plan name that unlocks this filter, or undefined when it is available. */
  lockedFor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-disabled={Boolean(lockedFor)}
      title={lockedFor ? `${title} is part of ${lockedFor}` : undefined}
      className={`rounded-xl border p-3 text-left transition-colors ${
        lockedFor
          ? "border-dashed border-zinc-300 bg-zinc-50/70 text-zinc-500 hover:border-zinc-400"
          : active
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-white hover:border-zinc-400"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {lockedFor && <span aria-hidden>🔒</span>}
        {title}
      </div>
      <div
        className={`mt-0.5 text-xs ${
          active && !lockedFor ? "text-zinc-300" : "text-zinc-500"
        }`}
      >
        {lockedFor ? `Unlocked on ${lockedFor}` : desc}
      </div>
    </button>
  );
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
  /** Directors from an official register, when the source publishes them. */
  directors?: string[];
  /** The confirmed human for this lead, and their own profile page. */
  contact_name?: string;
  contact_profile?: string;
  source: string;
  site_flags?: string[];
  site_audit?: SiteAudit;
  /** When the audit was actually taken — a cached visit carries an older date. */
  site_audited_at?: string;
  tech?: string;
  pixels?: string[];
}

/** Score colour + wording for a website audit. */
function auditTone(audit: SiteAudit): { cls: string; label: string } {
  if (audit.grade === "unknown") {
    return { cls: "bg-zinc-100 text-zinc-500", label: "couldn't load" };
  }
  if (audit.score >= 85) return { cls: "bg-emerald-50 text-emerald-700", label: "healthy" };
  if (audit.score >= 65) return { cls: "bg-amber-50 text-amber-700", label: "needs work" };
  if (audit.score >= 40) return { cls: "bg-orange-100 text-orange-700", label: "poor" };
  return { cls: "bg-red-100 text-red-700", label: "broken" };
}

const SEVERITY_CLS: Record<string, string> = {
  critical: "text-red-700",
  high: "text-orange-700",
  medium: "text-amber-700",
  low: "text-zinc-500",
};

/**
 * The audit, in one cell: the score with the worst findings listed, so the user
 * can see at a glance which leads already have a concrete reason to be pitched.
 *
 * The date is part of the cell, not a detail: the website visit behind an audit
 * is cached by site, so a score can be days old, and a user about to quote it at
 * a stranger is entitled to know when it was taken — and to ask for a fresh one.
 * Past three days the date turns amber, which is the point at which "their site
 * is broken" stops being safe to say without looking again.
 */
function SiteAuditCell({
  audit,
  auditedAt,
  busy,
  message,
  onRecheck,
}: {
  audit?: SiteAudit;
  auditedAt?: string;
  busy?: boolean;
  message?: string;
  onRecheck?: () => void;
}) {
  if (!audit) return <span className="text-zinc-300">not checked</span>;
  const tone = auditTone(audit);
  const findings = audit.checks.filter((c) => c.severity === "critical" || c.severity === "high");
  const stale = isOlderThan(auditedAt, 3 * 86_400);
  const age = describeFreshness(auditedAt);

  return (
    <div className="min-w-[210px]">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.cls}`}
      >
        {audit.grade === "unknown" ? "site" : `${audit.score}/100`}
        <span className="font-normal opacity-80">{tone.label}</span>
      </span>
      {findings.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {findings.slice(0, 3).map((c) => (
            <li key={c.id} className="text-[11px] leading-4 text-zinc-600" title={c.detail}>
              <span className="text-orange-500">•</span> {c.label}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-[11px] text-zinc-400">
          {audit.grade === "unknown" ? "verify manually" : "no big problems found"}
        </div>
      )}
      {audit.checks.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-600">
            full audit ({audit.checks.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {audit.checks.map((c) => (
              <li key={c.id} className="text-[11px] leading-4">
                <span className={`font-medium ${SEVERITY_CLS[c.severity] ?? "text-zinc-500"}`}>
                  {c.label}
                </span>
                <div className="text-zinc-400">{c.detail}</div>
              </li>
            ))}
          </ul>
          {(audit.facts.status > 0 || audit.facts.ms > 0) && (
            <div className="mt-1.5 text-[11px] text-zinc-400">
              HTTP {audit.facts.status} · {(audit.facts.ms / 1000).toFixed(1)}s ·{" "}
              {Math.max(1, Math.round(audit.facts.bytes / 1024))} KB
            </div>
          )}
        </details>
      )}
      {(onRecheck || auditedAt) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={`text-[11px] ${stale ? "text-amber-600" : "text-zinc-400"}`}
            title={auditedAt ? new Date(auditedAt).toLocaleString() : undefined}
          >
            {age}
          </span>
          {onRecheck && (
            <button
              onClick={onRecheck}
              disabled={busy}
              className="text-[11px] text-zinc-500 underline hover:text-zinc-700 disabled:opacity-50"
              title="Visit the site again now, and use what comes back instead of the cached audit"
            >
              {busy ? "checking…" : "re-check"}
            </button>
          )}
          {message && <span className="text-[11px] text-zinc-500">{message}</span>}
        </div>
      )}
    </div>
  );
}

/** Filename-safe slug for CSV downloads. */
function slug(v: string): string {
  return (
    v
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "leads"
  );
}

/**
 * The words the table shows for a score. Exported alongside the raw grade so
 * the spreadsheet and the screen never disagree about the same lead.
 */
function verdictLabel(audit: SiteAudit | undefined): string {
  if (!audit) return "";
  if (audit.grade === "unknown") return "couldn't load";
  return auditTone(audit).label;
}

/**
 * The reason to reach out, in one quotable line. This is the product's whole
 * pitch, so it leads the export — the freelancer can read it straight off the
 * spreadsheet or paste it into a first message.
 */
function whyReachOut(l: Lead): string {
  if (!l.website) return "No website at all — needs one built.";
  const a = l.site_audit;
  if (!a) return "";
  if (a.grade === "unknown") return "Site refused our automated check — verify by hand before pitching.";
  if (a.needsWork) return a.flags[0] ?? a.summary;
  return "Site looks healthy — pitch something other than a rebuild.";
}

function toCsv(leads: Lead[]): string {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  // Column order follows how the list is worked: who and where, then every way
  // to reach them, then why to reach out and the evidence behind it. Import
  // maps by header name, so this round-trips.
  const header =
    "business_name,category,address,website,email,phone,instagram,linkedin,contact_name,contact_profile,why_reach_out,site_score,site_grade,site_verdict,site_problems,site_audit_summary,site_audited_at,notes";
  const rows = leads.map((l) =>
    [
      l.business_name,
      l.category,
      l.address,
      l.website,
      l.email,
      l.phone,
      l.instagram,
      l.linkedin,
      // The person, beside the company: "who" next to "where to reach them".
      l.contact_name ?? "",
      l.contact_profile ?? "",
      whyReachOut(l),
      // The audit travels with the row: score, grade, the quotable problems,
      // and the plain-language summary that becomes the opening line of a pitch.
      l.site_audit ? String(l.site_audit.score) : "",
      l.site_audit ? l.site_audit.grade : "",
      verdictLabel(l.site_audit),
      l.site_audit ? l.site_audit.flags.join("; ") : l.website ? "" : "no website at all",
      l.site_audit ? l.site_audit.summary : "",
      // When the audit was taken, ISO. The export leaves the app and gets quoted
      // in public, so the date travels with it — a stale finding in a pitch is
      // the user's embarrassment, not ours to hide.
      l.site_audit && l.site_audited_at ? l.site_audited_at : "",
      // Company intel + address both help the AI personalize
      [l.notes, l.address].filter(Boolean).join(" — "),
    ]
      .map(esc)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

/**
 * The freelancer's working artifact: one block per business, ready to paste
 * into an email, a DM or a call script. The audit line IS the reason to reach
 * out, so it leads.
 */
function toPitchText(leads: Lead[]): string {
  return leads
    .map((l) => {
      const reach = [
        l.email,
        l.phone && `phone ${l.phone}`,
        l.instagram && `@${l.instagram}`,
        l.linkedin && `linkedin.com/${l.linkedin}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const why = whyReachOut(l);
      return [`${l.business_name}${l.category ? ` (${l.category})` : ""}`, l.website, reach, `Why them: ${why}`]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

/** Lower rank = a better prospect to pitch. No website is the strongest pitch. */
function prospectRank(l: Lead): number {
  if (!l.website) return 0;
  const a = l.site_audit;
  if (!a) return 4;
  if (a.grade === "unknown") return 3;
  return a.needsWork ? 1 : 2;
}

/**
 * A lead's notes carry the audit and tech segments for export and for the AI.
 * The table row shows only the company intel, so the audit isn't printed twice.
 */
function intelOnly(notes: string): string {
  return notes
    .split(" | ")
    .filter((part) => !/^(Website audit |Site tech: |Website issues: )/.test(part))
    .join(" · ");
}

/** Higher is easier to actually reach today. */
function reachScore(l: Lead): number {
  return (
    Number(Boolean(l.email)) * 4 +
    Number(Boolean(l.instagram)) * 2 +
    Number(Boolean(l.phone))
  );
}

/** Whether a job is still waiting or in flight — the two "wait for me" states. */
function isActiveJob(job: PublicJob): boolean {
  return job.status === "queued" || job.status === "running";
}

/** A job's filter, narrowed from JSON without trusting it. */
function asWebsiteFilter(value: unknown): WebsiteFilter {
  return value === "with" || value === "without" || value === "outdated" ? value : "any";
}

/**
 * When a search finished, in words — coarse, like the audit ages on the rows.
 * A stored result is worth saying *when* about, because that is how stale the
 * audit inside it might be.
 */
function describeWhen(at: string | null): string {
  if (!at) return "finished";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "finished";
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function LeadsPage() {
  const [source, setSource] = useState<SourceId>("web");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [count, setCount] = useState(10);
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("any");
  /**
   * The search queue as the server reports it: this account's recent searches,
   * newest first, without their leads — a finished payload is the largest thing
   * in the database and this list is polled every couple of seconds
   * (see app/api/leads/jobs/route.ts).
   */
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  /** How many searches this account may have in flight at once (server-owned). */
  const [queueCap, setQueueCap] = useState(2);
  /** The job whose leads are on screen, so the list can mark it as showing. */
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  /**
   * The job this browser is waiting for. Set when the user submits a search,
   * cleared when its result opens or its failure is shown — so a search the user
   * started always ends in either leads or an error on screen, even though the
   * request that started it answered two minutes earlier.
   */
  const [watchJobId, setWatchJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [meta, setMeta] = useState<{
    found: number;
    withEmail: number;
    withInstagram: number;
    withPhone?: number;
    sitesAudited?: number;
    needsWork?: number;
    /** Results found but left out because their address is in another place. */
    outOfArea?: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  /** Per-row re-check state, keyed by row index: busy while it runs, plus what it said. */
  const [rechecks, setRechecks] = useState<
    Record<number, { busy?: boolean; message?: string }>
  >({});
  const [people, setPeople] = useState<Record<number, PeopleState>>({});
  /** Result-view chip: null = all, "pixels"/"issues" = special, else a stack name. */
  const [chip, setChip] = useState<string | null>(null);
  /** How the result list is ordered. Prospects first is the product's promise. */
  const [sort, setSort] = useState<"prospects" | "worst" | "reachable">("prospects");
  /** Original indexes of the rows the user ticked — export/import follow this. */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  /** The search that produced the current results — the list always says what it is. */
  const [lastSearch, setLastSearch] = useState<{
    niche: string;
    location: string;
    filter: WebsiteFilter;
  } | null>(null);
  /** Row whose pitch was just copied, for the inline confirmation. */
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  /** Which filters this plan unlocks (server-owned; see /api/auth/me). */
  const [filterAccess, setFilterAccess] = useState<LeadFilterAccess[] | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  /** Set when the user clicks a filter their plan doesn't include. */
  const [lockedNotice, setLockedNotice] = useState<LeadFilterAccess | null>(null);
  /**
   * The sources this deployment can actually run. Server-owned because one of
   * them (Companies House) runs on the deployment's own key, which the client
   * cannot know: a deployment that hasn't set that key must not offer the
   * source, or the user clicks it and gets an error that isn't their fault.
   */
  const [sourceIds, setSourceIds] = useState<SourceId[] | null>(null);

  const activeJobs = jobs.filter(isActiveJob);
  /** Whether anything is waiting or in flight — the form stays usable either way. */
  const hasActive = activeJobs.length > 0;
  const runningJob = activeJobs.find((j) => j.status === "running");
  /** Settled searches, newest first — the ones worth reopening. */
  const finishedJobs = jobs.filter((j) => !isActiveJob(j));
  /** At the cap the server would answer 429, so the button says so first. */
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const pollingRef = useRef(false);
  const [queueWarning, setQueueWarning] = useState<string | null>(null);

  const capReached = activeJobs.length >= queueCap;

  /**
   * Prefill from the query string, so a link like the digest's "search this
   * niche" arrives with the form already filled in.
   *
   * Read from `window.location` rather than `useSearchParams` on purpose: this
   * page is a client component, and useSearchParams would put it behind a
   * Suspense boundary to keep it prerenderable — for four optional fields that
   * only ever matter after a click from another page.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("niche")?.trim();
    const where = params.get("location")?.trim();
    const from = params.get("source");
    const filter = params.get("filter");
    const many = Number(params.get("count"));
    if (q) setNiche(q);
    if (where) setLocation(where);
    if (from && isSourceId(from)) setSource(from);
    if (filter === "with" || filter === "outdated" || filter === "without" || filter === "any") {
      setWebsiteFilter(filter);
    }
    if (Number.isFinite(many) && many > 0) setCount(Math.min(50, Math.max(1, many)));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (Array.isArray(d.leadFilters)) setFilterAccess(d.leadFilters);
        if (d.planName) setPlanName(d.planName);
        if (Array.isArray(d.sources)) setSourceIds(d.sources.filter(isSourceId));
      })
      .catch(() => {
        // Gating is a convenience: leaving every card enabled here is safe,
        // because the search route refuses a locked filter on its own — and an
        // unconfigured source answers with its own setup message.
      });
  }, []);

  /** The inventory until the server narrows it; the server's answer afterwards. */
  const visibleSources: SourceId[] =
    sourceIds && sourceIds.length ? sourceIds : ACTIVE_SOURCES;

  // A source the deployment can't run must not stay selected behind the user's
  // back: if the picker is left on one that isn't offered, it moves to the first
  // that is rather than failing on submit.
  useEffect(() => {
    if (sourceIds && sourceIds.length && !sourceIds.includes(source)) {
      setSource(sourceIds[0]);
    }
  }, [sourceIds, source]);

  /** Pulls the queue's current state. Cheap: no lead payloads travel with it. */
  const refreshJobs = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await fetch("/api/leads/jobs");
      if (!res.ok) throw new Error("Could not check search progress. Retrying…");
      const data = (await res.json()) as { jobs?: PublicJob[]; cap?: number };
      if (Array.isArray(data.jobs)) setJobs(data.jobs);
      if (typeof data.cap === "number" && data.cap > 0) setQueueCap(data.cap);
      setQueueWarning(null);
    } catch {
      setQueueWarning("Search progress is temporarily unavailable. Retrying…");
    } finally {
      pollingRef.current = false;
    }
  }, []);

  const trackAction = useCallback((id: number | null, action: "opened" | "exported" | "copied") => {
    if (id == null) return;
    void fetch(`/api/leads/jobs/${id}/actions`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => {});
  }, []);

  /**
   * Opens one finished search's leads.
   *
   * The queue list deliberately carries no leads, so this is where a result is
   * actually read — and the job's own parameters are what the results header
   * describes, not the form as it happens to look now. Reopening a stored result
   * costs nothing: the work was already done and paid for when it ran.
   */
  const openJob = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/leads/jobs/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open that search");
      if (!data.result) throw new Error("That search has no leads to show");
      const job = data.job as PublicJob;
      setLeads(data.result.leads as Lead[]);
      setMeta(data.result.meta ?? null);
      setNote(typeof data.result.note === "string" ? data.result.note : null);
      setLastSearch({
        niche: job?.niche ?? niche,
        location: job?.location ?? location,
        filter: asWebsiteFilter(job?.filter),
      });
      setOpenJobId(id);
      trackAction(id, "opened");
      setError(null);
      setChip(null);
      setSelected(new Set());
      setImportMsg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that search");
    }
  }, [niche, location, trackAction]);


  // On arrival, read the queue once: a search started in another tab, or before
  // a reload, is still this account's search and should still be on screen.
  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  /**
   * Polls while anything is in flight, then stops.
   *
   * Two seconds is the compromise: often enough that a finished search feels
   * immediate, rarely enough that a minute-long cold search costs thirty tiny
   * JSON reads rather than a stream. `hasActive` and `watchJobId` are the
   * dependencies rather than `jobs` itself, because a new array every poll would
   * rebuild the interval every two seconds — and an idle screen makes no
   * requests at all.
   */
  useEffect(() => {
    if (!hasActive && watchJobId == null && !queueWarning) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      await refreshJobs();
    };
    void tick();
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [hasActive, watchJobId, queueWarning, refreshJobs]);

  /**
   * A search the user started has to end somewhere. When the job it asked for
   * finishes, its leads open; if it fails, its own message is shown. Without
   * this the 202 would leave the screen silent.
   */
  useEffect(() => {
    if (watchJobId == null) return;
    const job = jobs.find((j) => j.id === watchJobId);
    if (!job) return;
    if (job.status === "done") {
      setWatchJobId(null);
      void openJob(job.id);
    } else if (job.status === "failed") {
      setWatchJobId(null);
      setError(job.error || "That search failed.");
    }
  }, [jobs, watchJobId, openJob]);

  /** The plan that unlocks a filter, or undefined when it is available. */
  function accessFor(f: WebsiteFilter): LeadFilterAccess | undefined {
    return filterAccess?.find((a) => a.id === f);
  }

  function lockedFor(f: WebsiteFilter): string | undefined {
    const access = accessFor(f);
    return access && !access.unlocked ? access.requires ?? "a paid plan" : undefined;
  }

  const chipMatch = (l: Lead) =>
    chip === null
      ? true
      : chip === "pixels"
        ? (l.pixels?.length ?? 0) > 0
        : chip === "issues"
          ? l.site_audit?.needsWork === true
          : l.tech === chip;
  /** Rows shown in the table: chip-filtered, then sorted. Original indexes are
   *  kept so selection and the decision-maker lookups survive re-filtering. */
  const visible = (leads ?? [])
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => chipMatch(l))
    .sort((a, b) => {
      if (sort === "worst") {
        // Pure audit order: the worst site on top. Unaudited leads sink, since
        // there is no evidence to pitch.
        return (a.l.site_audit?.score ?? 101) - (b.l.site_audit?.score ?? 101);
      }
      if (sort === "reachable") {
        return reachScore(b.l) - reachScore(a.l) || prospectRank(a.l) - prospectRank(b.l);
      }
      return (
        prospectRank(a.l) - prospectRank(b.l) ||
        (a.l.site_audit?.score ?? 100) - (b.l.site_audit?.score ?? 100)
      );
    });

  /**
   * What the export/import buttons act on: exactly what the user ticked, or
   * everything currently visible when nothing is ticked. Triage first, act
   * second — which is how a list of 40 becomes the 12 worth contacting.
   */
  const actionRows = () =>
    selected.size > 0
      ? (leads ?? []).filter((_, i) => selected.has(i))
      : visible.map((v) => v.l);

  const allVisibleSelected = visible.length > 0 && visible.every(({ i }) => selected.has(i));

  function toggleAllVisible() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((v) => v.i)));
  }

  function toggleOne(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function findPeople(i: number) {
    const lead = leads?.[i];
    if (!lead) return;
    setPeople((p) => ({ ...p, [i]: { loading: true } }));
    try {
      const res = await fetch("/api/leads/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: lead.business_name,
          // The place from the search that produced this row, not whatever the
          // form happens to hold now — results stay open while the next search
          // is being typed.
          location: lastSearch?.location ?? location,
          // When the source already named the people behind the company, the
          // lookup is for those people — not a guess at who runs it. Both
          // directors go in one search: the one with a profile is often not the
          // first listed, and asking for both costs the same single call.
          people: lead.directors ?? [],
        }),
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
      const line = `Decision maker: ${c.name}${c.role ? ` (${c.role})` : ""} — ${personLabel(c)}`;
      l.notes = l.notes ? `${l.notes} | ${line}` : line;
      // The person gets their own fields as well as the note: a list is worked
      // down a column, and "who do I contact here" should be a column, not a
      // sentence buried inside company intel. The export carries both.
      l.contact_name = c.name;
      l.contact_profile = personHref(c);
      // Only a LinkedIn path belongs in the LinkedIn column. An X profile is
      // carried by the person's own fields above and shown on the row's person
      // cell, rather than mislabelled as a LinkedIn one.
      if (!l.linkedin && c.linkedin) l.linkedin = c.linkedin;
      next[i] = l;
      return next;
    });
    setPeople((p) => ({ ...p, [i]: { chosen: c } }));
  }

  /**
   * Visits one lead's site again, now, and replaces the row's audit with what
   * comes back.
   *
   * Nothing about this is optimistic: the row keeps showing the old audit until
   * the fresh one arrives, and a site that can't be reached says so rather than
   * silently keeping a date the user would read as "checked just now".
   */
  async function recheck(i: number) {
    const lead = leads?.[i];
    if (!lead?.website) return;
    setRechecks((r) => ({ ...r, [i]: { busy: true } }));
    try {
      const res = await fetch("/api/leads/recheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: lead.website,
          // The row's own search, so re-checking an older result audits it under
          // the filter and place it was found with rather than the current form's.
          location: lastSearch?.location ?? location,
          filter: lastSearch?.filter ?? websiteFilter,
          // Only what a fresh visit can change, so the server merges against the
          // row as the user sees it without being trusted with the rest of it.
          lead: {
            business_name: lead.business_name,
            email: lead.email,
            phone: lead.phone,
            instagram: lead.instagram,
            linkedin: lead.linkedin,
            address: lead.address,
            notes: lead.notes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Re-check failed");
      setLeads((ls) => {
        if (!ls) return ls;
        const next = [...ls];
        next[i] = { ...next[i], ...data.lead };
        return next;
      });
      // The server's line, not ours: it is the one that knows whether the audit
      // moved ("82 → 74/100 (worse), 3 days ago") or held ("still 82/100, 3 days
      // ago"), and that comparison is the only reason to press the button.
      setRechecks((r) => ({ ...r, [i]: { message: data.note ?? "updated" } }));
    } catch (err) {
      setRechecks((r) => ({
        ...r,
        [i]: { message: err instanceof Error ? err.message : "Re-check failed" },
      }));
    }
  }

  /**
   * Queues a search and returns immediately.
   *
   * The request used to run the whole search, which is why the screen felt
   * broken: a cold search takes a minute and the user could not do anything else.
   * Now it stores a job (202) and this polls for it, so the form stays usable and
   * a second search can be queued while the first one runs. Whatever results are
   * already on screen stay there until the new ones arrive, rather than blanking
   * the page the moment a search starts.
   */
  async function search() {
    if (submittingRef.current) return;
    const gate = accessFor(websiteFilter);
    if (gate && !gate.unlocked) {
      setLockedNotice(gate);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setImportMsg(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, niche, location, count, websiteFilter }),
      });
      const data = await res.json();
      // A refusal — rate limited, the queue full, a filter this plan doesn't
      // include — arrives in the queue's own words, so it is shown as it came.
      if (!res.ok) throw new Error(data.error || "Search failed");
      const job = data.job as PublicJob | undefined;
      if (job) {
        setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
        setWatchJobId(job.id);
        void refreshJobs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function downloadCsv() {
    const rows = actionRows();
    if (!rows.length) return;
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    // Named after the search the rows came from, not after the form: results
    // stay open while the next search is being typed.
    const named = lastSearch ?? { niche, location, filter: websiteFilter };
    a.download = `leads-${slug(named.niche)}-${slug(named.location)}-${named.filter}.csv`;
    a.click();
    trackAction(openJobId, "exported");
    URL.revokeObjectURL(a.href);
  }

  /** Copy the selected leads as paste-ready pitch notes. */
  async function copyPitch() {
    const rows = actionRows();
    if (!rows.length) return;
    try {
      await navigator.clipboard.writeText(toPitchText(rows));
      trackAction(openJobId, "copied");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setImportMsg("Couldn't copy to the clipboard — use Download CSV instead.");
    }
  }

  /** Copy one lead's pitch block — for working the list a lead at a time. */
  async function copyOne(i: number) {
    const lead = leads?.[i];
    if (!lead) return;
    try {
      await navigator.clipboard.writeText(toPitchText([lead]));
      trackAction(openJobId, "copied");
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 2000);
    } catch {
      setImportMsg("Couldn't copy to the clipboard — use Download CSV instead.");
    }
  }

  /** A lead is importable with an email — or, for offline businesses, with a
   *  name plus another way to reach them (Instagram DM or phone). */
  const importable = (l: Lead) => Boolean(l.email || (l.business_name && (l.instagram || l.phone)));

  async function importToContacts() {
    const withEmail = actionRows().filter(importable);
    if (withEmail.length === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: toCsv(withEmail), searchJobId: openJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportMsg(`Imported ${data.imported} contact${data.imported === 1 ? "" : "s"} — saved to your Contacts.`);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // Counts follow the selection when there is one, so the buttons never
  // promise more than they will do.
  const importableCount = actionRows().filter(importable).length;
  const actionLabel = selected.size > 0 ? `${selected.size} selected` : `all ${visible.length}`;

  // Chip options derived from the current results (stack names by frequency).
  const stackCounts = new Map<string, number>();
  for (const l of leads ?? []) if (l.tech) stackCounts.set(l.tech, (stackCounts.get(l.tech) ?? 0) + 1);
  const pixelCount = (leads ?? []).filter((l) => (l.pixels?.length ?? 0) > 0).length;
  const needsWorkCount = (leads ?? []).filter((l) => l.site_audit?.needsWork === true).length;
  const chipDefs: { key: string; label: string }[] = [
    // The reason this product exists — surfaced first.
    ...(needsWorkCount > 0
      ? [{ key: "issues", label: `Site needs work (${needsWorkCount})` }]
      : []),
    ...[...stackCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => ({ key: name, label: `${name} (${n})` })),
    ...(pixelCount > 0 ? [{ key: "pixels", label: `Runs marketing tags (${pixelCount})` }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Find businesses that need you"
        subtitle="Real businesses pulled live from the web — each one audited, with what's wrong with its site and what to say about it"
      />

      <Card className="p-6 mb-6">
        <details className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-600">
            Search source:{" "}
            <span className="font-medium text-zinc-800">{sourceLabel(source)}</span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleSources.map((id) => (
              <SourceOption
                key={id}
                active={source === id}
                // A source that lists no websites can only serve the "No
                // website" search, so choosing it moves the filter there
                // instead of letting the request fail.
                onClick={() => {
                  setSource(id);
                  if (SOURCE_META[id].gives.website === false) setWebsiteFilter("without");
                }}
                title={SOURCE_META[id].label}
                // A source that lists no websites can only ever run the No
                // website search, so on a plan that doesn't unlock it the picker
                // says so instead of offering an entry that fails on submit.
                desc={
                  SOURCE_META[id].gives.website === false && lockedFor("without")
                    ? `${SOURCE_META[id].desc} Needs ${lockedFor("without")}.`
                    : SOURCE_META[id].desc
                }
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Web search finds the most businesses that have a site to audit. The map sources are
            better when you want businesses with no website at all.
          </p>
        </details>

        <div className="grid gap-4 md:grid-cols-12 items-end">
          <label className="block md:col-span-5">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">Niche</div>
            <input
              className={inputCls}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. restaurant, dentist, gym"
            />
          </label>
          <label className="block md:col-span-5">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">Location</div>
            <input
              className={inputCls}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. New York, USA"
            />
          </label>
          <label className="block md:col-span-2">
            <div className="text-sm font-medium text-zinc-600 mb-1.5">How many</div>
            <select className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium text-zinc-600 mb-2">
            Who are you looking for?{" "}
            <span className="font-normal text-zinc-400">— this picks which leads you get</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WEBSITE_FILTERS.map((f) => {
              const locked = lockedFor(f.value);
              return (
                <FilterOption
                  key={f.value}
                  active={websiteFilter === f.value}
                  onClick={() => {
                    if (locked) {
                      setLockedNotice(accessFor(f.value) ?? null);
                      return;
                    }
                    setLockedNotice(null);
                    setWebsiteFilter(f.value);
                  }}
                  title={f.title}
                  desc={f.desc}
                  lockedFor={locked}
                />
              );
            })}
          </div>
        </div>

        {lockedNotice && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            <span>
              <span className="font-medium text-zinc-800">{lockedNotice.label}</span> is part of
              the {lockedNotice.requires} plan.
              {planName && <> Your {planName} plan keeps everything else here.</>}
            </span>
            <Link href="/pricing" className="font-medium text-blue-600 hover:underline">
              See what each plan unlocks →
            </Link>
          </div>
        )}

        {/* The button sits after the choice it acts on, and says what it will do. */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className={`${btnPrimary} justify-center sm:min-w-52`}
            onClick={search}
            disabled={submitting || capReached || !niche.trim() || !location.trim()}
          >
            {submitting ? "Queueing…" : capReached
              ? `${queueCap} searches in flight`
              : hasActive
                ? "Queue another search"
                : `Find ${count} leads`}
          </button>
          <span className="text-xs text-zinc-500">{FILTER_CTA[websiteFilter]}</span>
        </div>
        {queueWarning && <p role="status" className="mt-3 text-sm text-amber-700">{queueWarning}</p>}
        {capReached && (
          <p className="mt-2 text-xs text-amber-600">
            You already have {queueCap} searches queued or running — the next one can start the
            moment one of them finishes.
          </p>
        )}
        {websiteFilter === "outdated" && !hasActive && (
          <p className="text-xs text-zinc-500 mt-3">
            Only sites with at least one serious, checkable problem are kept: unreachable or
            erroring pages, invalid certificates, no HTTPS, no mobile layout, broken homepage
            links, free-builder hosting, stale content. Soft gaps like a missing meta
            description are recorded but never used to call a working site broken.
          </p>
        )}
        {websiteFilter === "without" && !hasActive && (
          <p className="text-xs text-zinc-500 mt-3">
            Businesses with no website at all — the strongest pitch there is.{" "}
            {/* Which data behind this search depends on the source picked above;
                saying "map data" while the register is selected contradicts the
                line right over it. */}
            {source === "companies_house"
              ? "This search reads the official UK register (newly registered companies, with the people behind them), then hunts each business's Instagram, phone and email across the web so you can actually reach them."
              : "This search reads open map data (OpenStreetMap), then looks up each business's Instagram, phone and email across the web so you can actually reach them."}
          </p>
        )}
        {/*
          What is in flight right now, one card per job. The queue's whole point
          is that these can be plural: two searches running side by side, with
          the form still open underneath for the next one.
        */}
        {activeJobs.map((job) => (
          <div key={job.id} className="mt-4 rounded-xl border border-zinc-200 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-sm font-medium text-zinc-800">
                {job.niche} in {job.location}
              </span>
              <span className="text-xs text-zinc-400">
                {job.status === "queued" ? "Queued" : "In progress"} · {job.count} leads
              </span>
            </div>
            {job.status === "running" ? (
              <SearchProgress source={job.source} startedAt={job.startedAt} />
            ) : (
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-400" />
                Waiting for a free slot…
              </div>
            )}
          </div>
        ))}
        {error && <div className="text-sm text-red-500 mt-3">{error}</div>}
        {note && <div className="text-sm text-amber-600 mt-3">{note}</div>}
      </Card>

      {finishedJobs.length > 0 && (
        <Card className="p-0 mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3">
            <span className="text-sm font-medium text-zinc-700">Your recent searches</span>
            <span className="text-xs text-zinc-400">
              Kept for a week — reopen one without spending another search
            </span>
          </div>
          <div className="divide-y divide-zinc-100">
            {finishedJobs.map((job) => {
              const open = job.id === openJobId;
              return (
                <div
                  key={job.id}
                  className={`flex flex-wrap items-center gap-3 px-5 py-3 ${open ? "bg-blue-50/60" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-800">
                      {job.niche} in {job.location}
                      {job.filter !== "any" && (
                        <span className="font-normal text-zinc-400"> · {job.filter}</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {job.status === "failed" ? (
                        <span className="text-red-500">{job.error || "That search failed."}</span>
                      ) : (
                        `${job.leadCount} lead${job.leadCount === 1 ? "" : "s"} · ${describeWhen(job.finishedAt)}`
                      )}
                    </div>
                  </div>
                  {job.status === "done" && (
                    <button
                      className={btnSecondary}
                      onClick={() => void openJob(job.id)}
                      disabled={open}
                    >
                      {open ? "Showing" : "View leads"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {runningJob != null && leads == null && (
        <SkeletonResults rows={Math.min(runningJob.count, 6)} />
      )}

      {leads && leads.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              {lastSearch && (
                <div className="mb-0.5 text-xs text-zinc-400">
                  {lastSearch.niche} in {lastSearch.location} · {FILTER_SHORT[lastSearch.filter]} ·{" "}
                  {SORT_SHORT[sort]}
                </div>
              )}
              <span className="font-medium">{meta?.found} leads</span>
              <span className="text-zinc-400">
                {" "}· {meta?.withEmail} with email · {meta?.withInstagram} with Instagram
                {lastSearch?.filter === "without" && <> · {meta?.withPhone ?? 0} with phone</>}
                {(meta?.sitesAudited ?? 0) > 0 && <> · {meta?.sitesAudited} sites audited</>}
              </span>
              {(meta?.needsWork ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {meta?.needsWork} need work
                </span>
              )}
              {(meta?.outOfArea ?? 0) > 0 && (
                <span
                  className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                  title="These businesses are in a different place, so they are not in this list"
                >
                  {meta?.outOfArea} outside {lastSearch?.location} left out
                </span>
              )}
              {selected.size > 0 && (
                <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
                  {selected.size} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="mr-1 flex items-center gap-1.5 text-xs text-zinc-500">
                Order
                <select
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "prospects" | "reachable")}
                >
                  <option value="prospects">Best prospects first</option>
                  <option value="worst">Worst site first</option>
                  <option value="reachable">Easiest to reach first</option>
                </select>
              </label>
              <button className={btnSecondary} onClick={copyPitch}>
                {copied ? "Copied ✓" : `Copy pitch (${actionLabel})`}
              </button>
              <button className={btnSecondary} onClick={downloadCsv}>
                Download CSV ({actionLabel})
              </button>
              <button
                className={btnPrimary}
                onClick={importToContacts}
                disabled={importing || importableCount === 0}
              >
                {importing ? "Importing…" : `Import ${importableCount} → My leads`}
              </button>
            </div>
          </div>
          {importMsg && (
            <div className="px-5 py-3 border-b border-zinc-100 text-sm text-emerald-700 bg-emerald-50">
              {importMsg}{" "}
              <Link href="/contacts" className="underline font-medium">
                View my leads →
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
              <span className="text-xs text-zinc-400">
                {visible.length !== leads.length && `showing ${visible.length} of ${leads.length} — `}
                tick rows to work on just those
              </span>
            </div>
          )}
          <div className="x-scroll">
            <table className="w-full min-w-[1560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium border-r border-zinc-100">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-zinc-900"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible rows"
                      />
                      Business
                    </label>
                  </th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Social</th>
                  <th className="px-4 py-2.5 font-medium">Decision maker</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 font-medium">Website</th>
                  <th className="px-4 py-2.5 font-medium">Site audit — why them</th>
                  <th className="px-4 py-2.5 font-medium">Pitch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.map(({ l, i }) => (
                  <tr key={i} className="group hover:bg-zinc-50">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-zinc-50 px-4 py-2.5 border-r border-zinc-100">
                      <div className="flex gap-2.5">
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0 accent-zinc-900"
                          checked={selected.has(i)}
                          onChange={() => toggleOne(i)}
                          aria-label={`Select ${l.business_name}`}
                        />
                        <div className="min-w-0">
                          <div className="max-w-[230px] font-medium">{l.business_name}</div>
                          {l.address && <div className="max-w-[230px] truncate text-xs text-zinc-400">{l.address}</div>}
                          {l.notes && (
                            <div className="text-xs text-zinc-400 mt-0.5 max-w-[230px] truncate" title={l.notes}>
                              {intelOnly(l.notes)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] break-all px-4 py-2.5">
                      {/* break-all is right for a long address, which has to wrap
                          somewhere — but it also broke "not found" into "not fou / nd"
                          once the column was squeezed, so the placeholder holds
                          itself together. */}
                      {l.email || <span className="text-zinc-300 whitespace-nowrap">not found</span>}
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
                        director={l.directors?.[0]}
                        onFind={() => findPeople(i)}
                        onChoose={(c) => choosePerson(i, c)}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs">{l.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-xs max-w-48 truncate">
                      {l.website ? (
                        <div>
                          <a
                            href={l.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={l.website}
                            className="inline-block max-w-[200px] truncate align-bottom text-zinc-500 hover:underline"
                          >
                            {l.website.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
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
                    <td className="px-4 py-2.5 align-top">
                      {l.website ? (
                        <SiteAuditCell
                          audit={l.site_audit}
                          auditedAt={l.site_audited_at}
                          busy={rechecks[i]?.busy}
                          message={rechecks[i]?.message}
                          onRecheck={() => recheck(i)}
                        />
                      ) : (
                        <div className="min-w-[210px]">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            no website
                          </span>
                          <div className="mt-1 text-[11px] leading-4 text-zinc-500">
                            the strongest pitch there is — needs a site built
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <button
                        onClick={() => copyOne(i)}
                        title="Copy this lead's pitch — the business, its site, how to reach them, and why them"
                        className="whitespace-nowrap rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        {copiedIdx === i ? "Copied ✓" : "Copy pitch"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {leads && leads.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-sm font-medium text-zinc-700">
            {websiteFilter === "outdated"
              ? "These sites look modern — nothing to pitch here"
              : "No businesses matched this search"}
          </div>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Nothing is broken — the search just came up empty. Three things to try:
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              "Broaden the niche — “restaurant”, not “vegan bistro”",
              "Widen the area — the city, not the suburb",
              "Switch source — OpenStreetMap finds different businesses",
            ].map((tip) => (
              <span key={tip} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
                {tip}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PersonCell({
  state,
  director,
  onFind,
  onChoose,
}: {
  state?: PeopleState;
  /** The register's own name for a director, when the source published one. */
  director?: string;
  onFind: () => void;
  onChoose: (c: PersonCandidate) => void;
}) {
  if (state?.chosen) {
    return (
      <a
        href={personHref(state.chosen)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-sky-700 hover:underline"
        title={`${state.chosen.role} — ${personLabel(state.chosen)}`}
      >
        ✓ {state.chosen.name}
        <span className="text-zinc-400"> · {state.chosen.linkedin ? "LinkedIn" : "X"}</span>
      </a>
    );
  }
  if (state?.loading) return <span className="text-xs text-zinc-400">Searching…</span>;
  // Errors from the search provider are full sentences, and a table cell will
  // happily stretch to fit them — one row grew to three lines while the rest of
  // the list stayed single-spaced. Clamped to the column, with the whole message
  // on hover: nothing is hidden, but nothing is deformed either.
  if (state?.error) {
    return (
      <span
        className="inline-block max-w-[190px] truncate align-bottom text-xs text-amber-700"
        title={state.error}
      >
        ⚠ {state.error}
      </span>
    );
  }
  if (state?.candidates) {
    return (
      <div className="flex flex-col gap-1">
        {state.candidates.map((c) => (
          <button
            key={c.linkedin || `x/${c.x}`}
            onClick={() => onChoose(c)}
            title={`Attach to this lead${c.role ? ` — ${c.role}` : ""} (${personLabel(c)})`}
            className="text-left text-xs rounded border border-zinc-200 px-1.5 py-0.5 hover:border-zinc-400"
          >
            {c.isOwner && "★ "}
            {c.name}
            <span className="text-zinc-400"> · {c.linkedin ? "LinkedIn" : "X"}</span>
            {c.role && <span className="text-zinc-400"> · {c.role.slice(0, 22)}</span>}
          </button>
        ))}
      </div>
    );
  }
  // A director the register names is a person to look for, which is a narrower
  // and more honest promise than "find owner" — so the button says the name.
  return (
    <button
      onClick={onFind}
      title={
        director
          ? `Find ${director} — named as a director on the register`
          : "Find the owner or a senior decision maker"
      }
      className="text-xs text-zinc-400 hover:text-zinc-700 underline decoration-dotted"
    >
      {director ? `👤 Find ${director.split(/\s+/)[0]}` : "👤 Find owner"}
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

/** Whole seconds since a job started, read from the job's own clock. */
function secondsSince(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  const at = Date.parse(startedAt);
  return Number.isFinite(at) ? Math.max(0, Math.floor((Date.now() - at) / 1000)) : 0;
}

/**
 * The stage the running search is at.
 *
 * It counts from the job's `startedAt` rather than from when this component
 * mounted: a search that has been running for a minute, opened in a second tab,
 * must not read "1s" simply because that tab just noticed it.
 */
function SearchProgress({ source, startedAt }: { source: string; startedAt?: string | null }) {
  const [elapsed, setElapsed] = useState(() => secondsSince(startedAt));
  useEffect(() => {
    const t = setInterval(() => setElapsed(secondsSince(startedAt)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  // Web search reads as "the web" in a sentence; everything else is its label.
  const srcName = source === "web" ? "the web" : sourceLabel(source);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2.5 text-sm text-zinc-600">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
        Searching {srcName} and checking business details…
        <span className="text-xs tabular-nums text-zinc-400">{elapsed}s</span>
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
