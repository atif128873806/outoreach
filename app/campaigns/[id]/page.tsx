"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  ChannelBadge,
  PageHeader,
  StatusBadge,
  btnSecondary,
  fmtDate,
} from "../../components/ui";

interface Campaign {
  id: number;
  name: string;
  description: string;
  tone: string;
  channel: string;
  category_filter: string;
  scheduled_at: string | null;
  throttle_per_hour: number;
  followup_count: number;
  followup_interval_days: number;
  send_window_start: number | null;
  send_window_end: number | null;
  ab_test: number;
  test_batch: number;
  test_done: number;
  status: string;
}

const TONES = ["professional", "friendly", "casual", "enthusiastic", "formal"];
const inputCls =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400";

interface EmailItem {
  id: number;
  step: number;
  scheduled_for: string | null;
  subject: string;
  body: string;
  status: string;
  via: string;
  error: string;
  variant: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  contact_email: string;
  business_name: string;
  category: string;
  instagram: string;
  linkedin: string;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateCount, setTemplateCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setCampaign(data.campaign);
    setEmails(data.emails);
    setTemplateCount(data.templateCount ?? 0);
  }, [id]);

  function openEdit() {
    if (!campaign) return;
    setEdit({
      name: campaign.name,
      description: campaign.description,
      tone: campaign.tone,
      throttle_per_hour: String(campaign.throttle_per_hour),
      followup_count: String(campaign.followup_count),
      followup_interval_days: String(campaign.followup_interval_days),
    });
    setEditMsg(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    setEditSaving(true);
    setEditMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          fields: {
            name: edit.name,
            description: edit.description,
            tone: edit.tone,
            throttle_per_hour: Number(edit.throttle_per_hour),
            followup_count: Number(edit.followup_count),
            followup_interval_days: Number(edit.followup_interval_days),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setEditOpen(false);
      await load();
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setEditSaving(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: string) {
    setError(null);
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Action failed");
    }
    await load();
  }

  async function remove() {
    if (!confirm("Delete this campaign and its email log?")) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/campaigns");
    else {
      const data = await res.json();
      setError(data.error || "Delete failed");
    }
  }

  if (!campaign) {
    return <div className="text-zinc-400 text-sm py-20 text-center">Loading…</div>;
  }

  const counts = {
    sent: emails.filter((e) => e.status === "sent").length,
    ready: emails.filter((e) => e.status === "ready").length,
    failed: emails.filter((e) => e.status === "failed").length,
    skipped: emails.filter((e) => e.status === "skipped").length,
    pending: emails.filter((e) => e.status === "pending").length,
    opened: emails.filter((e) => e.opened_at).length,
    clicked: emails.filter((e) => e.clicked_at).length,
    replied: emails.filter((e) => e.replied_at).length,
  };
  const done = counts.sent + counts.ready + counts.failed + counts.skipped;
  const pct = emails.length ? Math.round((done / emails.length) * 100) : 0;
  const rate = (n: number) => (counts.sent > 0 ? Math.round((n / counts.sent) * 100) : 0);
  const isEmail = campaign.channel === "email";

  const abArm = (v: string) => {
    const arm = emails.filter((e) => e.variant === v && e.status === "sent");
    return {
      sent: arm.length,
      opened: arm.filter((e) => e.opened_at).length,
      example: arm.find((e) => e.subject)?.subject ?? "",
    };
  };
  const abStats = { a: abArm("A"), b: abArm("B") };

  const canPause = ["running", "scheduled"].includes(campaign.status);
  const canResume = campaign.status === "paused";
  const canStartNow = ["scheduled", "paused"].includes(campaign.status);
  const canCancel = ["running", "scheduled", "paused"].includes(campaign.status);

  return (
    <div>
      <div className="mb-4">
        <Link href="/campaigns" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Campaigns
        </Link>
      </div>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.category_filter ? `Audience: ${campaign.category_filter}` : "All contacts"} · ${
          campaign.tone
        } tone · ${campaign.throttle_per_hour}/hr · scheduled ${fmtDate(campaign.scheduled_at)}${
          campaign.followup_count > 0
            ? ` · ${campaign.followup_count} follow-up${campaign.followup_count > 1 ? "s" : ""} every ${campaign.followup_interval_days}d`
            : ""
        }${
          campaign.send_window_start != null
            ? ` · sends ${String(campaign.send_window_start).padStart(2, "0")}:00–${String(campaign.send_window_end).padStart(2, "0")}:00`
            : ""
        }`}
        action={
          <div className="flex items-center gap-2">
            <ChannelBadge channel={campaign.channel} />
            <StatusBadge status={campaign.status} />
          </div>
        }
      />

      {campaign.status === "paused" && campaign.test_batch > 0 && campaign.test_done === 1 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-sm text-blue-800">
          <b>Test batch complete</b> — the first {campaign.test_batch} message
          {campaign.test_batch > 1 ? "s" : ""} went out and the campaign paused itself, as you asked.
          Review the results below (opens, replies, how the AI wrote), make any edits, then hit{" "}
          <b>▶ Resume</b> to send the rest.
        </div>
      )}

      {templateCount > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800">
          <b>{templateCount} message{templateCount > 1 ? "s were" : " was"} written by the built-in
          template engine</b> instead of the AI (usually the daily included-AI limit, or a brief
          provider hiccup). Templates personalize per business but don&apos;t follow custom
          instructions from your brief. AI writing resumes automatically — or add your own API key
          in Settings for unlimited AI.
        </div>
      )}

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-zinc-500">
            <span className="text-emerald-600 font-medium">{counts.sent} sent</span>
            {counts.ready > 0 && (
              <span className="text-purple-600">
                {" "}· {counts.ready}{" "}
                <Link href="/messages" className="underline">drafts to send</Link>
              </span>
            )}
            {counts.failed > 0 && <span className="text-red-500"> · {counts.failed} failed</span>}
            {counts.skipped > 0 && <span> · {counts.skipped} skipped</span>}
            <span> · {counts.pending} queued</span>
          </div>
          <div className="text-sm tabular-nums text-zinc-500">{pct}%</div>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-zinc-900 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {isEmail && counts.sent > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Metric label="Open rate" value={`${rate(counts.opened)}%`} sub={`${counts.opened} opened`} />
            <Metric label="Click rate" value={`${rate(counts.clicked)}%`} sub={`${counts.clicked} clicked`} />
            <Metric label="Reply rate" value={`${rate(counts.replied)}%`} sub={`${counts.replied} replied`} accent />
          </div>
        )}
        {Boolean(campaign.ab_test) && (abStats.a.sent > 0 || abStats.b.sent > 0) && (
          <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
              Subject line A/B test
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(["a", "b"] as const).map((k) => {
                const s = abStats[k];
                const openPct = s.sent ? Math.round((s.opened / s.sent) * 100) : 0;
                const winner =
                  abStats.a.sent > 0 &&
                  abStats.b.sent > 0 &&
                  s.opened / s.sent > abStats[k === "a" ? "b" : "a"].opened / abStats[k === "a" ? "b" : "a"].sent;
                return (
                  <div key={k}>
                    <div className="font-medium">
                      {k === "a" ? "A — benefit statement" : "B — curiosity question"}
                      {winner && <span className="ml-1.5 text-emerald-600 text-xs">leading</span>}
                    </div>
                    <div className="text-zinc-500 text-xs mt-0.5">
                      {openPct}% open rate · {s.opened}/{s.sent} opened
                      {s.example && (
                        <div className="mt-1 italic truncate" title={s.example}>“{s.example}”</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {canStartNow && (
            <button className={btnSecondary} onClick={() => act("start_now")}>
              ▶ Start now
            </button>
          )}
          {canPause && (
            <button className={btnSecondary} onClick={() => act("pause")}>
              ⏸ Pause
            </button>
          )}
          {canResume && (
            <button className={btnSecondary} onClick={() => act("resume")}>
              ▶ Resume
            </button>
          )}
          {canCancel && (
            <button className={btnSecondary} onClick={() => act("cancel")}>
              ✕ Cancel
            </button>
          )}
          {["scheduled", "paused", "running"].includes(campaign.status) && (
            <button className={btnSecondary} onClick={() => (editOpen ? setEditOpen(false) : openEdit())}>
              ✎ Edit
            </button>
          )}
          <button
            className={`${btnSecondary} text-red-500 border-red-200 hover:bg-red-50`}
            onClick={remove}
          >
            Delete
          </button>
        </div>
        {error && <div className="text-sm text-red-500 mt-3">{error}</div>}

        {editOpen && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-700">
              Edit campaign
              <span className="ml-2 text-xs font-normal text-zinc-400">
                — changes apply to every message that hasn&apos;t been sent yet (the audience stays fixed)
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs font-medium text-zinc-500">Name</div>
                <input className={inputCls} value={edit.name ?? ""} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-medium text-zinc-500">Tone</div>
                <select className={inputCls} value={edit.tone ?? "professional"} onChange={(e) => setEdit((s) => ({ ...s, tone: e.target.value }))}>
                  {TONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <div className="mb-1 text-xs font-medium text-zinc-500">
                  Campaign brief <span className="font-normal text-zinc-400">— the AI writes every remaining message from this; specific instructions here are followed exactly</span>
                </div>
                <textarea rows={4} className={inputCls} value={edit.description ?? ""} onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))} />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-medium text-zinc-500">Speed (messages/hour)</div>
                <input type="number" min={1} max={600} className={inputCls} value={edit.throttle_per_hour ?? ""} onChange={(e) => setEdit((s) => ({ ...s, throttle_per_hour: e.target.value }))} />
              </label>
              {campaign.channel === "email" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-zinc-500">Follow-ups</div>
                    <select className={inputCls} value={edit.followup_count ?? "0"} onChange={(e) => setEdit((s) => ({ ...s, followup_count: e.target.value }))}>
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-zinc-500">Days apart</div>
                    <input type="number" min={1} max={30} className={inputCls} value={edit.followup_interval_days ?? ""} onChange={(e) => setEdit((s) => ({ ...s, followup_interval_days: e.target.value }))} />
                  </label>
                </div>
              )}
            </div>
            {editMsg && <div className="mt-2 text-sm text-red-500">{editMsg}</div>}
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                onClick={saveEdit}
                disabled={editSaving}
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
              <button className={btnSecondary} onClick={() => setEditOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-medium mb-2">Campaign brief</h2>
        <p className="text-sm text-zinc-600 whitespace-pre-wrap">{campaign.description}</p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 font-medium">
          Email log ({emails.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-400 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Subject</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {emails.map((e) => (
                <Fragment key={e.id}>
                  <tr
                    className="hover:bg-zinc-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">
                        {e.business_name || e.contact_email}
                        {e.step > 1 && (
                          <span className="ml-2 rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 text-xs">
                            follow-up {e.step - 1}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {campaign.channel === "instagram" && e.instagram
                          ? `@${e.instagram}`
                          : campaign.channel === "linkedin" && e.linkedin
                            ? `linkedin.com/${e.linkedin}`
                            : e.contact_email}
                        {e.status === "pending" && e.scheduled_for && (
                          <span> · due {fmtDate(e.scheduled_for)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-72 truncate">
                      {campaign.channel !== "email"
                        ? e.body
                          ? e.body.slice(0, 60) + (e.body.length > 60 ? "…" : "")
                          : <span className="text-zinc-300">not drafted yet</span>
                        : e.subject || <span className="text-zinc-300">not generated yet</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={e.status} />
                        {e.replied_at ? (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">replied</span>
                        ) : e.clicked_at ? (
                          <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-medium">clicked</span>
                        ) : e.opened_at ? (
                          <span className="rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-medium">opened</span>
                        ) : null}
                        {e.via.includes("simulated") && (
                          <span className="text-xs text-zinc-400">simulated</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">
                      {fmtDate(e.sent_at)}
                    </td>
                  </tr>
                  {expanded === e.id && (e.body || e.error) && (
                    <tr className="bg-zinc-50">
                      <td colSpan={4} className="px-6 py-4">
                        {e.error && (
                          <div className="text-xs text-red-500 mb-2">Error: {e.error}</div>
                        )}
                        {e.body && (
                          <div className="text-sm text-zinc-600 whitespace-pre-wrap max-w-2xl">
                            {e.body}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-emerald-600" : ""}`}>
        {value}
      </div>
      <div className="text-xs text-zinc-400">{sub}</div>
    </div>
  );
}
