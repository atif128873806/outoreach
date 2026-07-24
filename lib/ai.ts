import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, Contact, ReplyClassification } from "./db";
import { getAiConfig, type AiConfig, type Settings } from "./settings";
import { consumeGlobalAi } from "./ai-usage";
import { templateEmail, templateDm, templateLinkedin } from "./templates";

export interface GeneratedMessage {
  subject: string;
  body: string;
  /** true when written by an AI, false when the template fallback was used */
  ai: boolean;
  /** which provider wrote it: "anthropic" | "groq" | "template" */
  provider: string;
}

export interface GenerateOptions {
  /** 1 = first touch, 2+ = follow-up */
  step?: number;
  /** the previously sent message, for follow-up context */
  prior?: { subject: string; body: string };
  /** A/B subject test arm — two distinct subject-line strategies */
  subjectVariant?: "A" | "B";
  settings: Settings;
}

const SUBJECT_STYLES: Record<"A" | "B", string> = {
  A: "Subject line style: a short, concrete statement of the benefit (no question).",
  B: "Subject line style: a short, natural question that sparks curiosity — still specific, never clickbait.",
};

const EMAIL_SCHEMA = {
  type: "object",
  properties: {
    subject: {
      type: "string",
      description:
        "A short, specific, non-spammy subject line. No clickbait, no ALL CAPS, no excessive punctuation.",
    },
    body: {
      type: "string",
      description:
        "The plain-text email body, ready to send. Includes greeting and sign-off. No placeholder brackets.",
    },
  },
  required: ["subject", "body"],
  additionalProperties: false,
} as const;

const DM_SCHEMA = {
  type: "object",
  properties: {
    body: {
      type: "string",
      description:
        "The complete Instagram DM, ready to paste. Short, conversational, no placeholder brackets.",
    },
  },
  required: ["body"],
  additionalProperties: false,
} as const;

function senderContext(s: Settings): string {
  return [
    s.sender_name && `Sender name: ${s.sender_name}`,
    s.sender_role && `Sender role: ${s.sender_role}`,
    s.company_name && `Company: ${s.company_name}`,
    s.company_description && `About the company: ${s.company_description}`,
    s.signature && `Preferred sign-off / signature:\n${s.signature}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function emailSystemPrompt(s: Settings): string {
  const sender = senderContext(s);
  return `You are an elite B2B outreach copywriter. Your emails read like a sharp, busy professional wrote them personally after 10 minutes of research — never like a template or a mass mailer.

THE BRIEF IS LAW: if the campaign brief contains specific instructions — things to mention (discounts, links, names, offers), a language to write in, a structure, a length, a sign-off, things to avoid — follow them EXACTLY, even when they conflict with the style rules below. The style rules are defaults; the user's explicit instructions always win.

STRUCTURE (in this order):
1. Open with something SPECIFIC to this recipient: their business by name, what they visibly do, or a detail from their notes/intel. The first sentence must be about THEM, not the sender.
2. Bridge to ONE concrete problem or opportunity relevant to their kind of business, and how the sender's offer addresses it. Concrete beats clever.
3. Close with one soft, low-friction question (a reply, not a demand for a meeting).
4. Professional sign-off using the sender's name/role/company when provided.

HARD BANS — never write any of these:
- "I hope this email finds you well" or any variant of hoping/trusting they are well
- "My name is …" openings, "I wanted to reach out", "I came across your website", "I'll keep this short"
- Generic flattery ("impressive work", "love what you're doing") without a specific detail behind it
- Buzzwords: synergy, leverage, solutions, cutting-edge, revolutionize, streamline
- Fake urgency, fake familiarity, invented statistics, or any claim not in the campaign brief

STYLE:
- Body under 130 words (follow-ups under 70). Short sentences. Confident, warm, direct.
- Plain text only: no markdown, no HTML, no emojis, no placeholder brackets like [Name].
- Subject line: 3–7 words, natural and specific to them — like a colleague's email, not a headline. No clickbait, no ALL CAPS.
- If notes or company intel are provided for the recipient, weave ONE specific detail from them into the email — that is what makes it feel personal.
- For follow-ups: brief and gracious, reference the earlier email lightly, make it easy to say no.
- Write in the requested tone.

${sender ? `Details about the sender to use in the email:\n${sender}` : "The sender has not provided identity details; sign off simply."}`;
}

function linkedinSystemPrompt(s: Settings): string {
  const sender = senderContext(s);
  return `You write short LinkedIn messages for B2B outreach. These are pasted manually by a human, one at a time — either as a connection note or a direct message.

If the campaign brief contains specific instructions (things to mention, language, length, sign-off), follow them exactly — they override the rules below.

Rules:
- Maximum 90 words. LinkedIn readers skim; get to the point.
- Professional but human — no corporate buzzwords, no "I hope this message finds you well".
- Personalize with the recipient's business name and what their kind of business does.
- One clear, soft call to action (a reply or a short call), never a hard sell.
- No emojis, no hashtags, no links unless the campaign brief explicitly includes one. No placeholder brackets.
- Honest: no fake familiarity, no pretending you've worked together.

${sender ? `Details about the sender:\n${sender}` : ""}`;
}

function dmSystemPrompt(s: Settings): string {
  const sender = senderContext(s);
  return `You write short Instagram DMs for business outreach. These are pasted manually by a human, one at a time.

If the campaign brief contains specific instructions (things to mention, language, length), follow them exactly — they override the rules below.

Rules:
- Maximum 60 words. DMs are read on phones — shorter is better.
- Conversational and warm, like a person typing on their phone, but still professional. At most one emoji.
- Personalize with the recipient's business name or what their kind of business does.
- One soft call to action (a reply, not a link click).
- No links unless the campaign brief explicitly includes one. No hashtags. No placeholder brackets.
- Honest: no fake familiarity, no pretending you're a customer.

${sender ? `Details about the sender:\n${sender}` : ""}`;
}

function buildUserPrompt(
  contact: Contact,
  campaign: Campaign,
  step: number,
  prior?: { subject: string; body: string },
  subjectVariant?: "A" | "B"
): string {
  const recipient = `Recipient:
- Business name: ${contact.business_name || "(unknown — address them as the team behind the account)"}
- Category / industry: ${contact.category || "(unknown)"}
${contact.website ? `- Website: ${contact.website}` : ""}
${contact.instagram ? `- Instagram: @${contact.instagram}` : ""}
${contact.linkedin ? `- LinkedIn: linkedin.com/${contact.linkedin}` : ""}
${contact.notes ? `- Company intel / notes (USE one specific detail from this): ${contact.notes}` : ""}`;

  const firstTouch =
    campaign.channel === "instagram"
      ? "Write one Instagram DM for cold outreach."
      : campaign.channel === "linkedin"
        ? "Write one LinkedIn outreach message."
        : "Write one cold outreach email.";

  const task =
    step === 1
      ? firstTouch
      : `Write follow-up #${step - 1} to the earlier email below. The recipient has not replied.

Earlier email:
Subject: ${prior?.subject ?? ""}
${prior?.body ?? ""}`;

  return `${task}

${recipient}

Campaign brief — what we offer, and any specific instructions to follow exactly:
${campaign.description}

Tone: ${campaign.tone}${
    subjectVariant && campaign.channel === "email" && step === 1
      ? `\n${SUBJECT_STYLES[subjectVariant]}`
      : ""
  }`;
}

async function callAnthropic(
  cfg: AiConfig,
  system: string,
  user: string,
  isDm: boolean
): Promise<{ subject: string; body: string }> {
  const client = new Anthropic({ apiKey: cfg.apiKey });

  const response = await client.messages.create({
    model: cfg.model,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: system,
        // Identical for every contact in a campaign run — cache it so
        // per-contact generation only pays for the small user turn.
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: isDm ? DM_SCHEMA : EMAIL_SCHEMA },
    },
    messages: [{ role: "user", content: user }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AI declined to write this message (safety refusal)");
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("AI returned no text content");
  const parsed = JSON.parse(text) as { subject?: string; body: string };
  return { subject: parsed.subject ?? "", body: parsed.body };
}

async function callGroq(
  cfg: AiConfig,
  system: string,
  user: string,
  isDm: boolean
): Promise<{ subject: string; body: string }> {
  // Groq's JSON mode requires the word "JSON" and the expected shape in the prompt.
  const jsonInstruction = isDm
    ? `\n\nRespond with a JSON object exactly like: {"body": "<the complete DM>"}`
    : `\n\nRespond with a JSON object exactly like: {"subject": "<subject line>", "body": "<the complete plain-text email>"}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.8,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system + jsonInstruction },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content");
  const parsed = JSON.parse(content) as { subject?: string; body?: string };
  if (!parsed.body) throw new Error("Groq response missing message body");
  return { subject: parsed.subject ?? "", body: parsed.body };
}

export async function generateMessage(
  contact: Contact,
  campaign: Campaign,
  opts: GenerateOptions
): Promise<GeneratedMessage> {
  const s = opts.settings;
  const step = opts.step ?? 1;
  let cfg = getAiConfig(s);
  // Non-email channels are body-only drafts (no subject line)
  const isDm = campaign.channel !== "email";

  // The instance's global key is quota'd per user; over quota (or unverified)
  // the template engine takes over so campaigns keep moving.
  if (cfg?.global) {
    const gate = await consumeGlobalAi(campaign.user_id);
    if (!gate.ok) {
      console.log(`[ai] global AI unavailable for user #${campaign.user_id}: ${gate.reason}`);
      cfg = null;
    }
  }

  if (!cfg) {
    const t =
      campaign.channel === "instagram"
        ? templateDm(contact, campaign, s)
        : campaign.channel === "linkedin"
          ? templateLinkedin(contact, campaign, s)
          : templateEmail(contact, campaign, s, step, opts.subjectVariant);
    return { ...t, ai: false, provider: "template" };
  }

  const system =
    campaign.channel === "instagram"
      ? dmSystemPrompt(s)
      : campaign.channel === "linkedin"
        ? linkedinSystemPrompt(s)
        : emailSystemPrompt(s);
  const user = buildUserPrompt(contact, campaign, step, opts.prior, opts.subjectVariant);

  const result =
    cfg.provider === "groq"
      ? await callGroq(cfg, system, user, isDm)
      : await callAnthropic(cfg, system, user, isDm);

  return { ...result, ai: true, provider: cfg.provider };
}

// ---------- reply intelligence ----------

export interface ReplyAnalysis {
  classification: ReplyClassification;
  suggested_reply: string;
  ai: boolean;
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["interested", "question", "not_interested", "out_of_office", "other"],
    },
    suggested_reply: {
      type: "string",
      description:
        "A short, ready-to-send response in the sender's voice. Empty string for out_of_office and for not_interested (they said no — respect it).",
    },
  },
  required: ["classification", "suggested_reply"],
  additionalProperties: false,
} as const;

/** Keyword fallback when no AI key is configured. */
function classifyHeuristically(text: string): ReplyClassification {
  const t = text.toLowerCase();
  if (/out of (the )?office|on vacation|annual leave|auto.?reply|automatic reply|currently away/.test(t)) {
    return "out_of_office";
  }
  if (/unsubscribe|not interested|no thanks|no thank you|stop (emailing|contacting)|remove me|leave me alone/.test(t)) {
    return "not_interested";
  }
  if (/interested|sounds (good|great|interesting)|tell me more|let'?s (talk|chat)|book|schedule|call me|send (me )?(more|the) (details|info)/.test(t)) {
    return "interested";
  }
  if (/\?/.test(t)) return "question";
  return "other";
}

/**
 * Classifies an inbound reply and, when an AI provider is configured, drafts a
 * response in the sender's voice. Falls back to keyword classification.
 */
export async function analyzeReply(
  replyText: string,
  contact: { business_name: string; email: string },
  settings: Settings
): Promise<ReplyAnalysis> {
  const s = settings;
  const cfg = getAiConfig(s);
  const trimmed = replyText.slice(0, 4000);

  if (!cfg) {
    return { classification: classifyHeuristically(trimmed), suggested_reply: "", ai: false };
  }

  const sender = senderContext(s);
  const system = `You triage replies to B2B outreach emails and draft responses.

Classify the reply as one of: interested, question, not_interested, out_of_office, other.
Then draft a short response (under 100 words) in the sender's voice: warm, direct, professional, plain text, no placeholders. For "interested" move toward the next step; for "question" answer helpfully from what you know and offer a quick call for the rest. For not_interested and out_of_office return an empty suggested_reply — a "no" is respected and auto-replies need none.

${sender ? `The sender:\n${sender}` : ""}`;

  const user = `Reply received from ${contact.business_name || contact.email}:

${trimmed}`;

  try {
    let content: string;
    if (cfg.provider === "groq") {
      const r = await callGroqRaw(
        cfg,
        system +
          `\n\nRespond with a JSON object exactly like: {"classification": "interested|question|not_interested|out_of_office|other", "suggested_reply": "<the response or empty string>"}`,
        user
      );
      content = r;
    } else {
      const client = new Anthropic({ apiKey: cfg.apiKey });
      const response = await client.messages.create({
        model: cfg.model,
        max_tokens: 1024,
        system,
        output_config: { format: { type: "json_schema", schema: REPLY_SCHEMA } },
        messages: [{ role: "user", content: user }],
      });
      content = response.content.find((b) => b.type === "text")?.text ?? "";
    }
    const parsed = JSON.parse(content) as {
      classification?: string;
      suggested_reply?: string;
    };
    const valid: ReplyClassification[] = ["interested", "question", "not_interested", "out_of_office", "other"];
    const classification = valid.includes(parsed.classification as ReplyClassification)
      ? (parsed.classification as ReplyClassification)
      : classifyHeuristically(trimmed);
    return { classification, suggested_reply: parsed.suggested_reply ?? "", ai: true };
  } catch (err) {
    console.error("[ai] reply analysis failed, using heuristic:", err);
    return { classification: classifyHeuristically(trimmed), suggested_reply: "", ai: false };
  }
}

/** Bare Groq JSON-mode call used by non-message features. */
async function callGroqRaw(cfg: AiConfig, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.4,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content");
  return content;
}

// ---------- campaign brief improver ----------

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "A short, clear campaign name (max 6 words)." },
    description: {
      type: "string",
      description:
        "The improved campaign brief: what is offered, the concrete benefit, and the goal/CTA. 2-4 sentences, no placeholder brackets.",
    },
  },
  required: ["name", "description"],
  additionalProperties: false,
} as const;

/** Turns a rough campaign idea into a crisp brief the message-writer works best from. */
export async function improveBrief(
  rough: string,
  tone: string,
  settings: Settings,
  userId: number
): Promise<{ name: string; description: string }> {
  const s = settings;
  const cfg = getAiConfig(s);
  if (!cfg) throw new Error("Add a Groq or Anthropic API key in Settings to use the AI assistant");
  if (cfg.global) {
    const gate = await consumeGlobalAi(userId);
    if (!gate.ok) throw new Error(gate.reason);
  }

  const sender = senderContext(s);
  const system = `You sharpen rough campaign ideas into crisp outreach briefs. The brief is what an AI copywriter uses to write every message in the campaign, so it must state: what is being offered, the concrete benefit, and the single goal (what the recipient should do). Use ONLY facts, numbers, and prices that appear in the user's idea or sender details — NEVER invent statistics, prices, timelines, or results; a brief without numbers is better than one with made-up numbers. Write in a ${tone} tone. No placeholder brackets.

${sender ? `About the sender (use for context):\n${sender}` : ""}`;

  const user = `Rough campaign idea:\n${rough.slice(0, 2000)}`;

  let content: string;
  if (cfg.provider === "groq") {
    content = await callGroqRaw(
      cfg,
      system + `\n\nRespond with a JSON object exactly like: {"name": "<campaign name>", "description": "<improved brief>"}`,
      user
    );
  } else {
    const client = new Anthropic({ apiKey: cfg.apiKey });
    const response = await client.messages.create({
      model: cfg.model,
      max_tokens: 1024,
      system,
      output_config: { format: { type: "json_schema", schema: BRIEF_SCHEMA } },
      messages: [{ role: "user", content: user }],
    });
    content = response.content.find((b) => b.type === "text")?.text ?? "";
  }
  const parsed = JSON.parse(content) as { name?: string; description?: string };
  if (!parsed.description) throw new Error("AI returned no description");
  return { name: parsed.name ?? "", description: parsed.description };
}
