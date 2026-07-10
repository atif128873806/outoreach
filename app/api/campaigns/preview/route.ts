import { NextRequest, NextResponse } from "next/server";
import { getDb, type Campaign, type Contact } from "@/lib/db";
import { generateMessage } from "@/lib/ai";
import { getAiConfig } from "@/lib/settings";
import { checkSpam } from "@/lib/spamcheck";

export const runtime = "nodejs";

/**
 * Generates one sample message before a campaign is created,
 * so the user can see what will be written.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    description?: string;
    tone?: string;
    channel?: string;
    category_filter?: string;
  };

  if (!body.description?.trim()) {
    return NextResponse.json(
      { error: "Write the campaign description first" },
      { status: 400 }
    );
  }

  const channel =
    body.channel === "instagram" || body.channel === "linkedin"
      ? body.channel
      : "email";
  const db = getDb();
  const category = body.category_filter?.trim() ?? "";
  const igClause =
    channel === "instagram"
      ? " AND instagram != ''"
      : channel === "linkedin"
        ? " AND linkedin != ''"
        : "";

  const contact = (
    category
      ? db
          .prepare(
            `SELECT * FROM contacts WHERE unsubscribed = 0 AND category = ?${igClause} ORDER BY RANDOM() LIMIT 1`
          )
          .get(category)
      : db
          .prepare(
            `SELECT * FROM contacts WHERE unsubscribed = 0${igClause} ORDER BY RANDOM() LIMIT 1`
          )
          .get()
  ) as Contact | undefined;

  if (!contact) {
    return NextResponse.json(
      {
        error:
          channel === "instagram"
            ? "Add at least one contact with an Instagram handle to preview a DM"
            : channel === "linkedin"
              ? "Add at least one contact with a LinkedIn profile to preview a message"
              : "Import at least one contact to preview an email",
      },
      { status: 400 }
    );
  }

  const fakeCampaign = {
    id: 0,
    name: "preview",
    description: body.description.trim(),
    tone: body.tone?.trim() || "professional",
    channel,
    category_filter: category,
    scheduled_at: null,
    throttle_per_hour: 60,
    followup_count: 0,
    followup_interval_days: 3,
    send_window_start: null,
    send_window_end: null,
    status: "scheduled",
    created_at: "",
  } as Campaign;

  try {
    const msg = await generateMessage(contact, fakeCampaign);
    const spam = channel === "email" ? checkSpam(msg.subject, msg.body) : null;
    return NextResponse.json({
      contact: {
        email: contact.email,
        business_name: contact.business_name,
        category: contact.category,
        instagram: contact.instagram,
        linkedin: contact.linkedin,
      },
      subject: msg.subject,
      body: msg.body,
      ai: msg.ai,
      provider: msg.provider,
      spamWarnings: spam?.warnings ?? [],
      note: getAiConfig()
        ? `Written by ${msg.provider === "groq" ? "Groq" : "Claude"} AI`
        : "No AI API key configured — using the built-in template engine. Add a Groq or Anthropic key in Settings for fully AI-personalized messages.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 }
    );
  }
}
