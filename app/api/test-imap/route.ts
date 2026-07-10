import { NextResponse } from "next/server";
import { checkInbox } from "@/lib/inbox";
import { getImapConfig, getSettings, getKv } from "@/lib/settings";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Connects to the IMAP inbox and runs one reply/bounce check. */
export async function POST() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSettings(userId);
  const cfg = getImapConfig(settings);
  if (!cfg) {
    return NextResponse.json(
      { error: "IMAP not configured — fill in SMTP (or the IMAP overrides) first" },
      { status: 400 }
    );
  }

  const result = await checkInbox(userId, settings, cfg);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "IMAP check failed" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    checked: result.checked,
    replies: result.replies,
    bounces: result.bounces,
    lastCheck: await getKv(userId, "imap_last_check"),
  });
}
