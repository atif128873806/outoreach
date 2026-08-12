export type MailboxHealthStatus =
  | "not_configured"
  | "checking"
  | "healthy"
  | "stale"
  | "error";

export interface MailboxHealthInput {
  configured: boolean;
  lastCheck: string;
  lastError: string;
  now?: Date;
  staleAfterMs?: number;
}

const DEFAULT_STALE_AFTER_MS = 10 * 60_000;

/** Classifies reply-detection health from the scheduler's durable check state. */
export function getMailboxHealthStatus(input: MailboxHealthInput): MailboxHealthStatus {
  if (!input.configured) return "not_configured";
  if (input.lastError.trim()) return "error";
  if (!input.lastCheck) return "checking";

  const checkedAt = new Date(input.lastCheck).getTime();
  if (!Number.isFinite(checkedAt)) return "stale";
  const age = (input.now ?? new Date()).getTime() - checkedAt;
  if (age > (input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS)) return "stale";
  return "healthy";
}
