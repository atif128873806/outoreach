"use client";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    // campaign statuses
    scheduled: "bg-blue-100 text-blue-700",
    running: "bg-amber-100 text-amber-700",
    paused: "bg-zinc-200 text-zinc-600",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-600",
    // message statuses
    pending: "bg-zinc-200 text-zinc-600",
    ready: "bg-purple-100 text-purple-700",
    sent: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-600",
    skipped: "bg-zinc-100 text-zinc-500",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {status}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const styles: Record<string, { cls: string; label: string }> = {
    instagram: { cls: "bg-pink-100 text-pink-700", label: "Instagram DM" },
    linkedin: { cls: "bg-blue-100 text-blue-800", label: "LinkedIn" },
    email: { cls: "bg-sky-100 text-sky-700", label: "Email" },
  };
  const s = styles[channel] ?? styles.email;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

export const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const btnSecondary =
  "inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
