"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, StatusBadge, fmtDate } from "../components/ui";
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
  setup: { aiConfigured: boolean; smtpConfigured: boolean; hasContacts: boolean };
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

  const { stats, setup } = data;
  const setupSteps = [
    { done: setup.aiConfigured, label: "Add an AI API key (Groq or Anthropic)", href: "/settings", detail: "Powers AI-personalized messages" },
    { done: setup.smtpConfigured, label: "Configure SMTP delivery", href: "/settings", detail: "Until then, sends are simulated (logged, not delivered)" },
    { done: setup.hasContacts, label: "Import contacts from CSV", href: "/contacts", detail: "Email + business name + category" },
  ];
  const incomplete = setupSteps.filter((s) => !s.done);

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

      {incomplete.length > 0 && (
        <Card className="mb-6 p-5 border-amber-200 bg-amber-50">
          <div className="font-medium text-amber-900 mb-2">Finish setting up</div>
          <ul className="space-y-1.5">
            {incomplete.map((s) => (
              <li key={s.label} className="text-sm text-amber-800">
                <Link href={s.href} className="underline font-medium hover:text-amber-950">
                  {s.label}
                </Link>{" "}
                <span className="text-amber-700/70">— {s.detail}</span>
              </li>
            ))}
          </ul>
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
