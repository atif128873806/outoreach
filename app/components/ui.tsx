"use client";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    // campaign statuses
    scheduled: "bg-info text-accent",
    running: "bg-warning-surface text-warning",
    paused: "bg-raised text-muted",
    completed: "bg-success-surface text-success",
    cancelled: "bg-danger-surface text-danger",
    // message statuses
    pending: "bg-raised text-muted",
    ready: "bg-info text-accent",
    sent: "bg-success-surface text-success",
    failed: "bg-danger-surface text-danger",
    skipped: "bg-raised text-muted",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-raised text-muted"
      }`}
    >
      {status}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const styles: Record<string, { cls: string; label: string }> = {
    instagram: { cls: "bg-info text-channel", label: "Instagram DM" },
    linkedin: { cls: "bg-info text-accent", label: "LinkedIn" },
    email: { cls: "bg-info text-accent", label: "Email" },
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
      className={`workspace-card border border-line ${className}`}
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
    <div className="workspace-heading flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const inputCls = "ui-input";
export const btnPrimary = "ui-primary disabled:cursor-not-allowed";
export const btnSecondary = "ui-secondary disabled:cursor-not-allowed";

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
