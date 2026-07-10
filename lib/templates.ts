import type { Campaign, Contact } from "./db";
import type { Settings } from "./settings";

/**
 * Keyless mode: rotating, tone-aware message templates used when no
 * Anthropic API key is configured. Variants rotate per contact so a
 * batch of emails doesn't read as identical copy-paste.
 */

interface Rendered {
  subject: string;
  body: string;
}

function greeting(tone: string, business: string): string {
  const casual = ["casual", "friendly", "enthusiastic"].includes(tone);
  if (!business) return casual ? "Hey there," : "Hello,";
  return casual ? `Hey ${business} team,` : `Hello ${business} team,`;
}

function signoff(tone: string, s: Settings): string {
  const sig =
    s.signature ||
    [s.sender_name, s.company_name].filter(Boolean).join(" · ") ||
    "";
  const casual = ["casual", "friendly", "enthusiastic"].includes(tone);
  const close = casual ? "Cheers," : tone === "formal" ? "Kind regards," : "Best regards,";
  return sig ? `${close}\n${sig}` : close;
}

function pick<T>(variants: T[], seed: number): T {
  return variants[Math.abs(seed) % variants.length];
}

/** "restaurant" → "restaurants", "bakery" → "bakeries", "fitness" → "fitness businesses" */
function pluralCategory(raw: string): string {
  const c = raw.trim().toLowerCase();
  if (!c) return "businesses";
  if (c.endsWith("s")) return `${c} businesses`;
  if (/[^aeiou]y$/.test(c)) return c.slice(0, -1) + "ies";
  if (/(sh|ch|x|z)$/.test(c)) return c + "es";
  return c + "s";
}

export function templateEmail(
  contact: Contact,
  campaign: Campaign,
  s: Settings,
  step = 1,
  subjectVariant?: "A" | "B"
): Rendered {
  const business = contact.business_name || "your business";
  const cats = pluralCategory(contact.category);
  const seed = contact.id + step * 7;
  const hi = greeting(campaign.tone, contact.business_name);
  const bye = signoff(campaign.tone, s);
  const who = s.company_name
    ? `I'm ${s.sender_name || "reaching out"} from ${s.company_name}.`
    : s.sender_name
      ? `My name is ${s.sender_name}.`
      : "";

  if (step === 1) {
    const openers = [
      `I came across ${business} and wanted to reach out — we work with a lot of ${cats} and I think there's a real fit here.`,
      `Quick note from someone who works with ${cats} like ${business} every week.`,
      `I'll keep this short — I help ${cats} with exactly the kind of thing below, and ${business} came to mind.`,
    ];
    const ctas = [
      `Would you be open to a quick 15-minute chat this week?`,
      `If that sounds useful, just reply and I'll send over the details.`,
      `Worth a quick conversation? Happy to work around your schedule.`,
    ];
    // A = statement subjects, B = question subjects (A/B test arms)
    const subjects =
      subjectVariant === "A"
        ? [`Idea for ${business}`, `A thought on ${business}`]
        : subjectVariant === "B"
          ? [`Quick question for ${business}`, `${business} — worth a quick chat?`]
          : [
              `Quick question for ${business}`,
              `Idea for ${business}`,
              `${business} — worth a quick chat?`,
            ];
    return {
      subject: pick(subjects, seed),
      body: [hi, "", pick(openers, seed), who, "", campaign.description, "", pick(ctas, seed + 1), "", bye]
        .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
        .join("\n"),
    };
  }

  // Follow-ups
  const bumps = [
    `Just floating this back to the top of your inbox — I know things get busy.`,
    `Wanted to follow up in case my last note got buried.`,
    `Circling back once more — no pressure at all if the timing isn't right.`,
  ];
  const closers = [
    `If it's not a fit, a quick "no thanks" is totally fine and I won't follow up again.`,
    `Even a one-line reply would be great — happy to share more or leave you be.`,
    `If now's not the time, I can check back in a few months instead.`,
  ];
  return {
    subject: `Re: ${pick([`Quick question for ${business}`, `Idea for ${business}`, `${business} — worth a quick chat?`], contact.id + 7)}`,
    body: [hi, "", pick(bumps, seed), "", `In short: ${campaign.description}`, "", pick(closers, seed + 1), "", bye].join("\n"),
  };
}

export function templateLinkedin(
  contact: Contact,
  campaign: Campaign,
  s: Settings
): Rendered {
  const business = contact.business_name || "your business";
  const cats = pluralCategory(contact.category);
  const seed = contact.id;
  const who = s.sender_name
    ? `I'm ${s.sender_name}${s.company_name ? ` from ${s.company_name}` : ""}${s.sender_role ? ` (${s.sender_role})` : ""}.`
    : "";

  const openers = [
    `Hi — came across ${business} and wanted to reach out.`,
    `Hello! I work with ${cats} like ${business} and thought it was worth connecting.`,
    `Hi there — quick note about ${business}.`,
  ];
  const ctas = [
    `Open to a short conversation about it?`,
    `Happy to share details if it's relevant — just reply here.`,
    `Would a quick 15-minute call be worth it for you?`,
  ];

  const shortPitch =
    campaign.description.length > 260
      ? campaign.description.slice(0, 257).trimEnd() + "…"
      : campaign.description;

  return {
    subject: "",
    body: [pick(openers, seed), who, "", shortPitch, "", pick(ctas, seed + 1)]
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n")
      .trim(),
  };
}

export function templateDm(
  contact: Contact,
  campaign: Campaign,
  s: Settings
): Rendered {
  const business = contact.business_name || "you";
  const cats = pluralCategory(contact.category);
  const seed = contact.id;
  const name = s.sender_name ? ` — I'm ${s.sender_name}${s.company_name ? ` from ${s.company_name}` : ""}` : "";

  const openers = [
    `Hey! Love what ${business} is doing 👋${name}.`,
    `Hi${name}! Came across ${business} and had to reach out.`,
    `Hey ${business}!${name ? name + "." : ""} Quick one:`,
  ];
  const ctas = [
    `Open to a quick chat about it?`,
    `Mind if I send over a few details?`,
    `Worth 2 minutes of your time?`,
  ];

  const shortPitch =
    campaign.description.length > 220
      ? campaign.description.slice(0, 217).trimEnd() + "…"
      : campaign.description;

  return {
    subject: "",
    body: `${pick(openers, seed)} We help ${cats} with this: ${shortPitch} ${pick(ctas, seed + 1)}`,
  };
}
