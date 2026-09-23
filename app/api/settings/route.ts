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
import { isOutreachEnabled } from "@/lib/product";
import { offeredSources } from "@/lib/sources";
import { hasExaKey } from "@/lib/exa";

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
    // Which lead sources this deployment can run (server-owned). The Settings
    // page shows the status of the one that runs on the deployment's key rather
    // than the user's, because that is otherwise invisible from inside the app.
    leadSources: offeredSources().map((s) => s.id),
    // Whether web search runs on the deployment's own key rather than the shared
    // free daily allowance — the one thing that decides whether search keeps
    // working late in the day.
    exaConfigured: hasExaKey(),
    // The Settings page hides the outreach-only sections when this is false.
    outreachEnabled: isOutreachEnabled(),
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
