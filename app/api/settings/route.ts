import { NextRequest, NextResponse } from "next/server";
import {
  getSettings,
  saveSettings,
  isSmtpConfigured,
  getAiConfig,
  SECRET_SETTING_KEYS,
  SECRET_MASK,
  type Settings,
} from "@/lib/settings";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";

/** Secrets never leave the server — stored values are replaced with a mask. */
function publicSettings(settings: Settings): Settings {
  const out = { ...settings };
  for (const key of SECRET_SETTING_KEYS) {
    if (out[key]) out[key] = SECRET_MASK;
  }
  return out;
}

function respond(settings: Settings) {
  return NextResponse.json({
    settings: publicSettings(settings),
    smtpConfigured: isSmtpConfigured(settings),
    aiConfigured: Boolean(getAiConfig(settings)),
    aiProvider: getAiConfig(settings)?.provider ?? null,
  });
}

export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return respond(await getSettings(userId));
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Partial<Settings>;
  await saveSettings(userId, body); // masked secret values are ignored by saveSettings
  return respond(await getSettings(userId));
}
