import { NextRequest, NextResponse } from "next/server";
import { resolveMx } from "dns/promises";
import { getUserId } from "@/lib/auth";
import { classifyMx, PROVIDER_PRESETS, resolvePreset } from "@/lib/email-providers";
import { findRealMailHost } from "@/lib/mail-host";

export const runtime = "nodejs";

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * SMTP wizard: given the user's email address, look up the domain's MX
 * records and return ready-to-use SMTP/IMAP settings for their provider.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = (await req.json()) as { email?: string };
  const clean = (email ?? "").trim().toLowerCase();
  if (!VALID_EMAIL.test(clean)) {
    return NextResponse.json({ error: "Enter the email address you'll send from" }, { status: 400 });
  }

  const domain = clean.split("@")[1];
  let mx: string[] = [];
  try {
    mx = (await resolveMx(domain)).sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
  } catch {
    // No MX at all — fall through to the generic guess.
  }

  const id = mx.length ? classifyMx(mx) : "generic";
  const preset = resolvePreset(PROVIDER_PRESETS[id], clean);

  // Shared/cPanel hosting: mail.customer-domain usually presents the SERVER's
  // certificate (*.host.com), which fails strict TLS. The server's real name
  // lives in reverse-DNS — prefer it so the user never sees a cert error.
  if (id === "cpanel" || id === "generic") {
    const real = await findRealMailHost(preset.smtp.host);
    if (real) {
      preset.smtp = { ...preset.smtp, host: real };
      preset.imap = { ...preset.imap, host: real };
      preset.guide = [
        `We resolved your host's real mail server (${real}) — it matches the server's security certificate, so TLS works out of the box.`,
        ...preset.guide,
      ];
    }
  }

  return NextResponse.json({
    provider: preset,
    email: clean,
    mxFound: mx.length > 0,
  });
}
