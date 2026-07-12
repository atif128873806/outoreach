import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getUserId } from "@/lib/auth";
import { checkDomainDns } from "@/lib/dnscheck";

export const runtime = "nodejs";

/** In-app check: SPF / DKIM / DMARC for the signed-in user's From domain. */
export async function POST() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = await getSettings(userId);
  const domain = s.from_email.split("@")[1]?.trim();
  if (!domain) {
    return NextResponse.json(
      { error: "Set a From email in the SMTP section first" },
      { status: 400 }
    );
  }

  return NextResponse.json(await checkDomainDns(domain));
}
