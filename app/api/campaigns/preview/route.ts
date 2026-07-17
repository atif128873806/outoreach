import { NextRequest, NextResponse } from "next/server";
import { q1, type Campaign, type Contact } from "@/lib/db";
import { generateMessage } from "@/lib/ai";
import { getAiConfig, getSettings } from "@/lib/settings";
import { getUserId } from "@/lib/auth";
import { checkSpam } from "@/lib/spamcheck";
import { friendlyProviderError } from "@/lib/friendly-error";

export const runtime = "nodejs";

/**
 * Generates one sample message before a campaign is created,
 * so the user can see what will be written.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const category = body.category_filter?.trim() ?? "";
  const igClause =
    channel === "instagram"
      ? " AND instagram != ''"
      : channel === "linkedin"
        ? " AND linkedin != ''"
        : "";

  const contact = category
    ? await q1<Contact>(
        `SELECT * FROM contacts WHERE user_id = $1 AND unsubscribed = 0 AND category = $2${igClause} ORDER BY RANDOM() LIMIT 1`,
        [userId, category]
      )
    : await q1<Contact>(
        `SELECT * FROM contacts WHERE user_id = $1 AND unsubscribed = 0${igClause} ORDER BY RANDOM() LIMIT 1`,
        [userId]
      );

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
    user_id: userId,
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
    ab_test: 0,
    status: "scheduled",
    created_at: "",
  } as Campaign;

  try {
    const settings = await getSettings(userId);
    const msg = await generateMessage(contact, fakeCampaign, { settings });
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
      note: getAiConfig(settings)
        ? `Written by ${msg.provider === "groq" ? "Groq" : "Claude"} AI`
        : "No AI API key configured — using the built-in template engine. Add a Groq or Anthropic key in Settings for fully AI-personalized messages.",
    });
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err, "ai") }, { status: 500 });
  }
}
