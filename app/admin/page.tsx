"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader, fmtDate } from "../components/ui";

interface Row {
  id: number;
  email: string;
  name: string;
  is_admin: number;
  plan: string;
  created_at: string;
  contacts: number;
  campaigns: number;
  sent: number;
}

interface Instance {
  signupsDisabled: boolean;
  systemMailer: boolean;
  globalAi: string | null;
}

interface Funnel {
  signed_up: number;
  verified: number;
  used_leads: number;
  has_contacts: number;
  created_campaign: number;
  generated: number;
  sent_real: number;
  got_reply: number;
  smtp_connected: number;
  imap_connected: number;
}

/** The activation path, in order — each stage a place users can get stuck. */
const FUNNEL_STAGES: { key: keyof Funnel; label: string; hint: string }[] = [
  { key: "signed_up", label: "Signed up", hint: "created an account" },
  { key: "verified", label: "Verified email", hint: "clicked the confirmation link" },
  { key: "has_contacts", label: "Added contacts", hint: "lead finder or CSV import" },
  { key: "created_campaign", label: "Created a campaign", hint: "wrote a brief" },
  { key: "generated", label: "Messages generated", hint: "campaign actually ran" },
  { key: "sent_real", label: "Sent real email", hint: "via their own SMTP — went live" },
  { key: "got_reply", label: "Got a reply", hint: "the value moment" },
];

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Row[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden">("loading");
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  async function changePlan(userId: number, plan: string) {
    const prev = users;
    setUsers((u) => u.map((row) => (row.id === userId ? { ...row, plan } : row)));
    setPlanMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
    } catch (err) {
      setUsers(prev); // roll back the optimistic change
      setPlanMsg(err instanceof Error ? err.message : "Update failed");
    }
  }

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (r) => {
        if (r.status === 403) {
          setState("forbidden");
          return;
        }
        const d = await r.json();
        setUsers(d.users);
        setFunnel(d.funnel ?? null);
        setInstance(d.instance);
        setState("ok");
      })
      .catch(() => setState("forbidden"));
  }, []);

  if (state === "loading") {
    return <div className="text-zinc-400 text-sm py-20 text-center">Loading…</div>;
  }
  if (state === "forbidden") {
    return (
      <Card className="p-12 text-center">
        <div className="text-sm text-zinc-500">
          This area is for the workspace owner only.
        </div>
        <button
          className="mt-4 text-sm text-zinc-600 underline"
          onClick={() => router.push("/dashboard")}
        >
          Back to dashboard
        </button>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Admin" subtitle="Accounts and instance status" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Accounts" value={users.length} />
        <Stat
          label="Free AI"
          value={instance?.globalAi ? instance.globalAi === "groq" ? "Groq" : "Claude" : "off"}
          ok={Boolean(instance?.globalAi)}
        />
        <Stat
          label="System email"
          value={instance?.systemMailer ? "on" : "off"}
          ok={instance?.systemMailer}
        />
        <Stat
          label="Sign-ups"
          value={instance?.signupsDisabled ? "closed" : "open"}
          ok={!instance?.signupsDisabled}
        />
      </div>

      {funnel && funnel.signed_up > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-semibold">Activation funnel</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Where users are on the path from signup to first reply — computed live from the database
              </div>
            </div>
            <div className="text-xs text-zinc-400">
              SMTP connected <b className="text-zinc-600">{funnel.smtp_connected}</b> · IMAP{" "}
              <b className="text-zinc-600">{funnel.imap_connected}</b> · used Lead Finder{" "}
              <b className="text-zinc-600">{funnel.used_leads}</b>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {FUNNEL_STAGES.map((stage, idx) => {
              const value = funnel[stage.key];
              const total = funnel.signed_up;
              const prev = idx === 0 ? total : funnel[FUNNEL_STAGES[idx - 1].key];
              const pct = Math.round((value / total) * 100);
              const dropped = prev - value;
              return (
                <div key={stage.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-zinc-700">
                      {stage.label}{" "}
                      <span className="font-normal text-xs text-zinc-400">— {stage.hint}</span>
                    </span>
                    <span className="tabular-nums text-zinc-600">
                      <b className="text-zinc-900">{value}</b>{" "}
                      <span className="text-xs text-zinc-400">({pct}%)</span>
                      {dropped > 0 && idx > 0 && (
                        <span className="ml-2 text-xs text-amber-600">−{dropped} stuck</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: value > 0 ? `${Math.max(pct, 2)}%` : "0%" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {planMsg && <div className="text-sm text-red-500 mb-3">{planMsg}</div>}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-400 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Contacts</th>
                <th className="px-4 py-2.5 font-medium">Campaigns</th>
                <th className="px-4 py-2.5 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium flex items-center gap-2">
                      {u.email}
                      {Boolean(u.is_admin) && (
                        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
                          owner
                        </span>
                      )}
                    </div>
                    {u.name && <div className="text-xs text-zinc-400">{u.name}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.plan || "free"}
                      onChange={(e) => changePlan(u.id, e.target.value)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400"
                    >
                      <option value="free">Free</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{u.contacts}</td>
                  <td className="px-4 py-2.5 tabular-nums">{u.campaigns}</td>
                  <td className="px-4 py-2.5 tabular-nums">{u.sent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string | number; ok?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${
          ok === undefined ? "" : ok ? "text-emerald-600" : "text-amber-600"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}
