import { NextRequest, NextResponse } from "next/server";
import { createUser, userCount, startEmailVerification, isVerificationEnforced } from "@/lib/auth";
import { importLegacySqlite } from "@/lib/legacy-import";
import { appUrl, sendWelcomeEmail, sendVerificationEmail } from "@/lib/system-mailer";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/crypto";
import { rateLimitDb, clientIp } from "@/lib/ratelimit";
import { pilotAudience,pilotSearchPath } from "@/lib/pilot";
import { PILOT_COOKIE,linkPilotSignup,recordPilotSignupError,bestEffortPilot } from "@/lib/pilot-journey";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Per-IP cap. Kept generous because many legitimate users share one public IP
  // (mobile/CGNAT networks); email verification is the real abuse control.
  if (!(await rateLimitDb(`signup:${clientIp(req)}`, 20, 60 * 60 * 1000))) {
    await bestEffortPilot(()=>recordPilotSignupError(req.cookies.get(PILOT_COOKIE)?.value));
    return NextResponse.json(
      { error: "Too many signups from this address — try again later" },
      { status: 429 }
    );
  }

  // Self-hosters can close registration once their accounts exist.
  if (process.env.SIGNUPS_DISABLED === "true") {
    await bestEffortPilot(()=>recordPilotSignupError(req.cookies.get(PILOT_COOKIE)?.value));
    return NextResponse.json(
      { error: "Sign-ups are currently disabled on this instance" },
      { status: 403 }
    );
  }

  const parsed=await req.json().catch(()=>null);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||typeof parsed.email!=='string'||typeof parsed.password!=='string'||
    (parsed.name!=null&&typeof parsed.name!=='string')||parsed.email.length>254||parsed.password.length>1024||(parsed.name?.length??0)>160){
    await bestEffortPilot(()=>recordPilotSignupError(req.cookies.get(PILOT_COOKIE)?.value));
    return NextResponse.json({error:"Enter a valid name, email and password"},{status:400});
  }
  const { email, name, password, audience } = parsed as {
    email?: string;
    name?: string;
    password?: string;
    audience?: string;
  };
  if (!email?.trim() || !password) {
    await bestEffortPilot(()=>recordPilotSignupError(req.cookies.get(PILOT_COOKIE)?.value));
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const wasEmpty = (await userCount()) === 0;
  const result = await createUser(email, name ?? "", password);
  if ("error" in result) {
    await bestEffortPilot(()=>recordPilotSignupError(req.cookies.get(PILOT_COOKIE)?.value));
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // First account on a machine that ran the single-user version: adopt its data.
  let imported: string | null = null;
  if (wasEmpty) {
    imported = await importLegacySqlite(result.id);
  }

  // When verification is enforced, signup sends ONLY the short verification
  // email (a first-contact marketing email is more likely to hit spam and can
  // bury the link the user actually needs). The welcome email goes out after
  // they verify. Unverified instances just get the welcome email directly.
  const cleanEmail = email.trim().toLowerCase();
  if (isVerificationEnforced() && appUrl()) {
    const token = await startEmailVerification(result.id);
    void sendVerificationEmail(
      cleanEmail,
      name ?? "",
      `${appUrl()}/api/auth/verify-email?token=${token}`
    );
  } else {
    void sendWelcomeEmail(cleanEmail, name ?? "");
  }

  const session = createSessionToken(result.id);
  const selected=pilotAudience(audience);
  await bestEffortPilot(()=>linkPilotSignup(req.cookies.get(PILOT_COOKIE)?.value,result.id,selected));
  const res = NextResponse.json({ ok: true, imported, next: pilotSearchPath(selected) });
  res.cookies.set(SESSION_COOKIE, session.value, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
  return res;
}
