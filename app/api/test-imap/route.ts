import { NextResponse } from "next/server";
import { checkInbox } from "@/lib/inbox";
import { getImapConfig, getKv } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Connects to the IMAP inbox and runs one reply/bounce check. */
export async function POST() {
  if (!getImapConfig()) {
    return NextResponse.json(
      { error: "IMAP not configured — fill in SMTP (or the IMAP overrides) first" },
      { status: 400 }
    );
  }

  const result = await checkInbox();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "IMAP check failed" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    checked: result.checked,
    replies: result.replies,
    bounces: result.bounces,
    lastCheck: getKv("imap_last_check"),
  });
}
