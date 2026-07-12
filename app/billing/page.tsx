"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader } from "../components/ui";

interface PlanInfo {
  id: string;
  name: string;
  priceMonthlyUsd: number;
  tagline: string;
}

interface PlanRow {
  id: string;
  name: string;
  priceMonthlyUsd: number;
  leadsPerMonth: number | null;
  emailsPerDay: number | null;
  aiPerDay: number | null;
}

interface Billing {
  plan: PlanInfo;
  plans: PlanRow[];
  leads: { used: number; limit: number | null };
  emails: { used: number; limit: number | null };
  ai: { used: number; limit: number | null; ownKey: boolean };
  supportEmail: string;
}

/** Usage meter: number labels always visible; bar turns amber near the limit, red at it. */
function Meter({
  label,
  hint,
  used,
  limit,
  unlimitedNote,
}: {
  label: string;
  hint: string;
  used: number;
  limit: number | null;
  unlimitedNote?: string;
}) {
  const pct = limit == null ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone =
    limit == null
      ? "bg-blue-600"
      : pct >= 100
        ? "bg-red-500"
        : pct >= 80
          ? "bg-amber-500"
          : "bg-blue-600";
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-zinc-700">{label}</div>
        <div className="text-sm tabular-nums text-zinc-500">
          {limit == null ? (
            <span className="font-medium text-emerald-600">{unlimitedNote ?? "Unlimited"}</span>
          ) : (
            <>
              <span className="font-semibold text-zinc-900">{used}</span> / {limit}
            </>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${tone}`}
          style={{ width: limit == null ? "100%" : `${pct}%`, opacity: limit == null ? 0.25 : 1 }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
        <span>{hint}</span>
        {limit != null && pct >= 100 && (
          <span className="font-medium text-red-500">Limit reached</span>
        )}
        {limit != null && pct >= 80 && pct < 100 && (
          <span className="font-medium text-amber-600">{limit - used} left</span>
        )}
      </div>
    </Card>
  );
}

export default function BillingPage() {
  const [data, setData] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load");
        setData(await r.json());
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <div className="py-20 text-center text-sm text-red-500">{error}</div>;
  if (!data) return <div className="py-20 text-center text-sm text-zinc-400">Loading…</div>;

  const { plan, plans, leads, emails, ai, supportEmail } = data;
  const planRank = { free: 0, starter: 1, pro: 2 } as Record<string, number>;
  const upgradeMail = (target: string) =>
    `mailto:${supportEmail}?subject=${encodeURIComponent(`Upgrade to ${target} — Outreach Studio`)}&body=${encodeURIComponent(
      "Hi! I'd like to upgrade my Outreach Studio account to " + target + ". My account email is: "
    )}`;

  return (
    <div>
      <PageHeader
        title="Plan & Usage"
        subtitle="What your plan includes and how much of it you've used."
      />

      {/* current plan */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-semibold">{plan.name} plan</span>
            <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
              current
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">
            ${plan.priceMonthlyUsd}
            <span className="text-sm font-normal text-zinc-400"> / month</span>
          </div>
          {plan.id !== "pro" && (
            <a
              href={upgradeMail(plan.id === "free" ? "Starter or Pro" : "Pro")}
              className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Upgrade →
            </a>
          )}
        </div>
      </Card>

      {/* usage meters */}
      <div className="grid gap-4 md:grid-cols-3">
        <Meter
          label="Lead Finder"
          hint="Results this calendar month — resets on the 1st"
          used={leads.used}
          limit={leads.limit}
        />
        <Meter
          label="Emails sent"
          hint="Real sends today — resets at midnight (your daily cap also applies)"
          used={emails.used}
          limit={emails.limit}
        />
        <Meter
          label="Included AI writing"
          hint={
            ai.ownKey
              ? "You're using your own API key"
              : "Generations today with the included AI — resets at midnight"
          }
          used={ai.used}
          limit={ai.ownKey ? null : ai.limit}
          unlimitedNote={ai.ownKey ? "Unlimited — own key" : "Unlimited"}
        />
      </div>

      {/* plans comparison */}
      <div className="mt-10">
        <div className="mb-4 text-sm font-medium text-zinc-600">All plans</div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === plan.id;
            const isUpgrade = planRank[p.id] > planRank[plan.id];
            return (
              <Card
                key={p.id}
                className={`p-5 ${isCurrent ? "ring-2 ring-zinc-900" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-lg font-semibold">
                    ${p.priceMonthlyUsd}
                    <span className="text-xs font-normal text-zinc-400">/mo</span>
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-zinc-500">
                  <li>
                    {p.leadsPerMonth == null
                      ? "Unlimited leads"
                      : `${p.leadsPerMonth.toLocaleString("en-US")} leads / month`}
                  </li>
                  <li>
                    {p.emailsPerDay == null
                      ? "Unlimited emails"
                      : `${p.emailsPerDay} emails / day`}
                  </li>
                  <li>
                    {p.aiPerDay == null ? "Unlimited AI writing" : `${p.aiPerDay} AI writes / day`}
                  </li>
                </ul>
                {isCurrent ? (
                  <div className="mt-4 rounded-lg bg-zinc-100 py-2 text-center text-xs font-medium text-zinc-500">
                    Your current plan
                  </div>
                ) : isUpgrade ? (
                  <a
                    href={upgradeMail(p.name)}
                    className="mt-4 block rounded-lg bg-zinc-900 py-2 text-center text-xs font-semibold text-white hover:bg-zinc-700"
                  >
                    Upgrade to {p.name}
                  </a>
                ) : (
                  <div className="mt-4 py-2 text-center text-xs text-zinc-300">—</div>
                )}
              </Card>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          Self-serve checkout is rolling out. Until then, upgrades are activated by
          email — usually within a few hours. Hitting a limit never breaks anything:
          sends resume tomorrow, AI falls back to templates, and Lead Finder resumes
          next month.
        </p>
      </div>
    </div>
  );
}
