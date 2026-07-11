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

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Row[]>([]);
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
