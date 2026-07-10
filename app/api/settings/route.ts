import { NextRequest, NextResponse } from "next/server";
import {
  getSettings,
  saveSettings,
  isSmtpConfigured,
  getAiConfig,
  isAuthEnabled,
  setAppPassword,
  removeAppPassword,
  SECRET_SETTING_KEYS,
  SECRET_MASK,
  type Settings,
} from "@/lib/settings";

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
    authEnabled: isAuthEnabled(),
  });
}

export async function GET() {
  return respond(getSettings());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Settings> & {
    app_password?: string;
    app_password_remove?: boolean;
  };

  const { app_password, app_password_remove, ...values } = body;
  saveSettings(values); // masked secret values are ignored by saveSettings

  if (app_password_remove) {
    removeAppPassword();
  } else if (app_password?.trim()) {
    if (app_password.trim().length < 6) {
      return NextResponse.json(
        { error: "App password must be at least 6 characters" },
        { status: 400 }
      );
    }
    setAppPassword(app_password.trim());
  }

  return respond(getSettings());
}
