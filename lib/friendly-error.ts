import { SearchAllowanceSpentError, utcClock } from "./search-budget";

/**
 * Turns raw provider errors ("Groq API error 401: …", "Exa API error 429",
 * fetch timeouts) into messages a user can act on. The technical detail is
 * kept in parentheses so support/debugging still works.
 */
export function friendlyProviderError(err: unknown, context: "search" | "ai"): string {
  const raw = err instanceof Error ? err.message : String(err);
  const detail = raw.slice(0, 90);
  const who = context === "search" ? "The lead-search provider" : "The AI provider";

  // A spent *allowance* is not a busy moment, and telling a user to wait a
  // minute when the answer is "tomorrow" is the kind of message that loses
  // trust. This one names the time it returns and what an operator can do.
  if (err instanceof SearchAllowanceSpentError && context === "search") {
    return (
      `Web search is out of its free daily allowance — it comes back at ${utcClock(err.resumesAt)}. ` +
      `A deployment with its own EXA_API_KEY has no such limit. (${detail})`
    );
  }

  // A rejected *deployment* key is nobody's Settings problem, and calling it
  // "usually temporary" sends the one person who can fix it looking elsewhere.
  if (/EXA_API_KEY was rejected/i.test(raw)) {
    return `Web search is not configured correctly on this deployment — an administrator needs to replace EXA_API_KEY. Other lead sources still work. (${detail})`;
  }
  if (/\b401\b|\b403\b|unauthoriz|invalid[ _]?api[ _]?key|incorrect api key|authentication/i.test(raw)) {
    return context === "ai"
      ? `${who} rejected the API key. If you added your own key in Settings → AI provider, please re-check it — otherwise this is temporary on our side, try again in a few minutes. (${detail})`
      : `${who} refused the request — this is usually temporary. Try again in a few minutes or switch to another source above. (${detail})`;
  }
  if (/\b429\b|rate.?limit|too many|quota|overloaded/i.test(raw)) {
    return `${who} is busy right now — wait a minute and try again. (${detail})`;
  }
  if (/timeout|timed out|abort|econn|enotfound|network|fetch failed|socket/i.test(raw)) {
    return context === "search"
      ? `The source didn't respond in time — try again, or switch to another source above. (${detail})`
      : `${who} didn't respond in time — try again in a moment. (${detail})`;
  }
  if (/\b5\d\d\b|internal server/i.test(raw)) {
    return `${who} had a hiccup on their side — try again shortly. (${detail})`;
  }
  return raw;
}
