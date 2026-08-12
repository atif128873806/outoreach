/**
 * Conservative single-mailbox pacing.
 *
 * The scheduler wakes once a minute, so a safe campaign sends at most one
 * message per tick and waits long enough between successful sends to honor the
 * configured hourly rate. Higher-volume sending belongs behind mailbox
 * rotation; a single mailbox is deliberately capped at 60/hour.
 */

export const MAX_SINGLE_MAILBOX_PER_HOUR = 60;
export const DEFAULT_MESSAGES_PER_HOUR = 15;

export function normalizeHourlyRate(value: number | null | undefined): number {
  const parsed = Number.isFinite(value) ? Math.round(value as number) : DEFAULT_MESSAGES_PER_HOUR;
  return Math.min(MAX_SINGLE_MAILBOX_PER_HOUR, Math.max(1, parsed));
}

export function minimumSendIntervalMs(ratePerHour: number): number {
  return Math.ceil(3_600_000 / normalizeHourlyRate(ratePerHour));
}

export function isSendDue(
  lastSentAt: string | Date | null | undefined,
  ratePerHour: number,
  now: Date = new Date()
): boolean {
  if (!lastSentAt) return true;
  const last = new Date(lastSentAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= minimumSendIntervalMs(ratePerHour);
}
