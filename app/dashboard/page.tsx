"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, StatusBadge, btnPrimary, fmtDate } from "../components/ui";
import ActivityChart, { type DayPoint } from "../components/ActivityChart";

interface DashboardData {
  stats: {
    contacts: number;
    unsubscribed: number;
    campaigns: number;
    activeCampaigns: number;
    sent: number;
    failed: number;
    pending: number;
    readyDrafts: number;
    opened: number;
    clicked: number;
    replies: number;
    bounced: number;
  };
  recentEmails: {
    id: number;
    subject: string;
    status: string;
    via: string;
    sent_at: string | null;
    campaign_id: number;
    contact_email: string;
    business_name: string;
    campaign_name: string;
  }[];
  upcoming: { id: number; name: string; scheduled_at: string; status: string }[];
  daily: DayPoint[];
  onboarding: {
    steps: {
      id: string;
      label: string;
      detail: string;
      href: string;
      action: string;
      done: boolean;
    }[];
    completedCount: number;
    totalSteps: number;
    progressPercent: number;
    next: {
      id: string;
      label: string;
      detail: string;
      href: string;
      action: string;
      done: boolean;
    } | null;
    complete: boolean;
  };
  mailbox: {
    configured: boolean;
    status: "not_configured" | "checking" | "healthy" | "stale" | "error";
    lastCheck: string | null;
    error: string | null;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return <div className="text-zinc-400 text-sm py-20 text-center">Loading…</div>;
  }

  const { stats, onboarding, mailbox } = data;
  const mailboxProblem = mailbox.status === "error" || mailbox.status === "stale";
  const mailboxLabel = {
    not_configured: "Not configured",
    checking: "Waiting for first check",
    healthy: "Healthy",
    stale: "Check overdue",
    error: "Connection error",
  }[mailbox.status];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your outreach activity"
      />

      {stats.readyDrafts > 0 && (
        <Card className="mb-6 p-4 border-purple-200 bg-purple-50 flex items-center justify-between">
          <div className="text-sm text-purple-900">
            <span className="font-medium">{stats.readyDrafts} Instagram DM draft{stats.readyDrafts === 1 ? "" : "s"}</span>{" "}
            waiting for you to send.
          </div>
          <Link
            href="/messages"
            className="text-sm font-medium text-purple-700 underline hover:text-purple-900 shrink-0"
          >
            Open Message Center →
          </Link>
        </Card>
      )}

      {!onboarding.complete && onboarding.next && (
        <Card className="mb-6 overflow-hidden border-blue-200">
          <div className="border-b border-blue-100 bg-blue-50/60 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-zinc-900">Launch your first safe pilot</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  One step at a time. Preview your campaign before connecting a mailbox.
                </div>
              </div>
              <div className="shrink-0 text-xs font-medium tabular-nums text-blue-700">
                {onboarding.completedCount}/{onboarding.totalSteps} complete
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${onboarding.progressPercent}%` }}
              />
            </div>
          </div>
          <div className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
              Your next step
            </div>
            <div className="mt-1 text-base font-semibold text-zinc-900">
              {onboarding.next.label}
            </div>
            <div className="mt-1 text-sm text-zinc-500">{onboarding.next.detail}</div>
            <Link href={onboarding.next.href} className={`${btnPrimary} mt-4`}>
              {onboarding.next.action} →
            </Link>

            <details className="mt-5 border-t border-zinc-100 pt-4">
              <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-700">
                View all onboarding steps
              </summary>
              <ol className="mt-3 space-y-2">
                {onboarding.steps.map((step, index) => (
                  <li key={step.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        step.done
                          ? "bg-emerald-100 text-emerald-700"
                          : step.id === onboarding.next?.id
                            ? "bg-blue-100 text-blue-700"
                            : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {step.done ? "✓" : index + 1}
                    </span>
                    <div>
                      <div className={step.done ? "text-zinc-400 line-through" : "text-zinc-700"}>
                        {step.label}
                      </div>
                      {!step.done && <div className="text-xs text-zinc-400">{step.detail}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </Card>
      )}

      {mailbox.configured && (
        <Card
          className={`mb-6 p-4 ${
            mailboxProblem ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50/50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                Reply detection
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    mailboxProblem
                      ? "bg-red-100 text-red-700"
                      : mailbox.status === "healthy"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {mailboxLabel}
                </span>
              </div>
              <div className={`mt-1 text-xs ${mailboxProblem ? "text-red-700" : "text-zinc-500"}`}>
                {mailbox.status === "error"
                  ? mailbox.error || "The inbox connection failed."
                  : mailbox.status === "stale"
                    ? "No successful inbox check in the last 10 minutes. Replies may not be detected."
                    : mailbox.status === "healthy"
                      ? `Replies and bounces are being checked automatically. Last check ${fmtDate(mailbox.lastCheck)}.`
                      : "The first automatic inbox check is pending."}
              </div>
            </div>
            <Link
              href="/settings#reply-detection"
              className="text-xs font-medium text-zinc-700 underline hover:text-zinc-950"
            >
              {mailboxProblem ? "Fix connection" : "Mailbox settings"} →
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat label="Contacts" value={stats.contacts} sub={`${stats.unsubscribed} unsubscribed`} />
        <Stat label="Active campaigns" value={stats.activeCampaigns} sub={`${stats.campaigns} total`} />
        <Stat label="Emails sent" value={stats.sent} sub={`${stats.pending} queued`} />
        <Stat label="Failed" value={stats.failed} sub={stats.failed > 0 ? "check campaign logs" : "all good"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat
          label="Open rate"
          value={`${pct(stats.opened, stats.sent)}%`}
          sub={`${stats.opened} opened`}
        />
        <Stat
          label="Click rate"
          value={`${pct(stats.clicked, stats.sent)}%`}
          sub={`${stats.clicked} clicked`}
        />
        <Stat
          label="Replies"
          value={stats.replies}
          sub={stats.replies > 0 ? "follow-ups auto-stopped" : "waiting"}
          accent="emerald"
        />
        <Stat
          label="Bounced"
          value={stats.bounced}
          sub={stats.bounced > 0 ? "auto-excluded" : "none"}
          accent={stats.bounced > 0 ? "red" : undefined}
        />
      </div>

      <Card className="p-5 mb-6">
        <h2 className="font-medium mb-3">Last 14 days</h2>
        <ActivityChart data={data.daily ?? []} />
      </Card>

      <div className="grid md:grid-cols-5 gap-6">
        <Card className="md:col-span-3 p-5">
          <h2 className="font-medium mb-4">Recent activity</h2>
          {data.recentEmails.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              No emails processed yet. Create a campaign to get started.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.recentEmails.map((e) => (
                <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      <span className="font-medium">{e.business_name || e.contact_email}</span>
                      <span className="text-zinc-400"> · {e.subject || "(no subject)"}</span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      <Link href={`/campaigns/${e.campaign_id}`} className="hover:underline">
                        {e.campaign_name}
                      </Link>{" "}
                      · {fmtDate(e.sent_at)}
                      {e.via.includes("simulated") && " · simulated"}
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="md:col-span-2 p-5">
          <h2 className="font-medium mb-4">Upcoming & active</h2>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              Nothing scheduled.{" "}
              <Link href="/campaigns" className="underline">
                Create a campaign
              </Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {data.upcoming.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-sm font-medium hover:underline truncate block"
                    >
                      {c.name}
                    </Link>
                    <div className="text-xs text-zinc-400">{fmtDate(c.scheduled_at)}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "emerald" | "red";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "red"
        ? "text-red-500"
        : "";
  return (
    <Card className="p-5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
    </Card>
  );
}
