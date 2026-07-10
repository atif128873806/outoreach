/**
 * Deliverability lint: flags patterns spam filters weigh against cold email.
 * Heuristic by design — fast, offline, and advisory, not a verdict.
 */

const TRIGGER_WORDS = [
  "100% free", "act now", "amazing deal", "best price", "buy now", "cash bonus",
  "click here", "congratulations", "double your", "earn money", "exclusive deal",
  "free gift", "free money", "free trial", "get paid", "guarantee", "guaranteed",
  "limited time", "make money", "miracle", "no obligation", "no risk", "once in a lifetime",
  "order now", "risk-free", "special promotion", "urgent", "winner", "you have been selected",
];

export interface SpamCheck {
  /** 0 (clean) … 10+ (spammy) */
  score: number;
  warnings: string[];
}

export function checkSpam(subject: string, body: string): SpamCheck {
  const warnings: string[] = [];
  let score = 0;
  const all = `${subject}\n${body}`.toLowerCase();

  const hits = TRIGGER_WORDS.filter((w) => all.includes(w));
  if (hits.length > 0) {
    score += hits.length * 2;
    warnings.push(`Spam-trigger phrase${hits.length > 1 ? "s" : ""}: ${hits.slice(0, 4).map((h) => `"${h}"`).join(", ")}`);
  }

  const exclamations = (all.match(/!/g) ?? []).length;
  if (exclamations >= 3) {
    score += 2;
    warnings.push(`${exclamations} exclamation marks — enthusiasm reads as spam to filters`);
  }

  if (/!{2,}|\?{2,}/.test(subject + body)) {
    score += 2;
    warnings.push("Repeated punctuation (!! / ??)");
  }

  const capsWords = (subject + " " + body).match(/\b[A-Z]{4,}\b/g) ?? [];
  if (capsWords.length >= 2) {
    score += 2;
    warnings.push(`ALL-CAPS words: ${capsWords.slice(0, 3).join(", ")}`);
  }

  const links = (body.match(/https?:\/\//g) ?? []).length;
  if (links >= 3) {
    score += 2;
    warnings.push(`${links} links — cold emails deliver best with at most one`);
  }

  if (subject.length > 65) {
    score += 1;
    warnings.push("Subject longer than 65 characters — it will be cut off and looks promotional");
  }

  if (/[$€£]\s?\d/.test(subject)) {
    score += 2;
    warnings.push("Money amounts in the subject line");
  }

  if (body.length > 0 && body.length < 120) {
    score += 1;
    warnings.push("Very short body — a couple of concrete sentences deliver better");
  }

  return { score, warnings };
}
