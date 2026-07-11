/**
 * Send-window time math. Pure functions — also exercised by the test suite.
 */

/** Current hour (0–23) in an IANA time zone; falls back to server-local time when empty or invalid. */
export function hourInTimeZone(timeZone: string, at: Date = new Date()): number {
  if (timeZone) {
    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(at);
      const hour = parseInt(formatted, 10);
      if (Number.isFinite(hour)) return hour;
    } catch {
      // unknown zone string — fall through to server time
    }
  }
  return at.getHours();
}

/** Whether `hour` falls inside [start, end). The window may wrap midnight, e.g. 20 → 6. */
export function isHourInWindow(hour: number, start: number, end: number): boolean {
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}
