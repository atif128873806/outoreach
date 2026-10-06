import { NextRequest, NextResponse } from "next/server";
import { q1 } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, issueAdminSession, revokeAdminSession, validAdminOrigin } from "@/lib/admin-session";
import { ADMIN_COOKIE_OPTIONS } from "@/lib/admin-auth";
import { clientIp, rateLimitDb } from "@/lib/ratelimit";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!validAdminOrigin(req.url,req.headers)) return NextResponse.json({error:"Invalid origin"},{status:403});
  const body = await req.json().catch(()=>null);
  if (typeof body?.email !== "string" || typeof body?.password !== "string" || !body.email.trim() || !body.password || body.email.length>254 || body.password.length>1024)
    return NextResponse.json({error:"Enter your administrator email and password"},{status:400});
  const allowed = await rateLimitDb(`admin-login:${clientIp(req)}`,5,15*60_000);
  const accountAllowed = await rateLimitDb(`admin-account:${body.email.trim().toLowerCase()}`,10,15*60_000);
  if (!allowed || !accountAllowed) return NextResponse.json({error:"Too many attempts. Try again in 15 minutes."},{status:429});
  const user = await q1<{id:number}>("SELECT id FROM users WHERE email=$1",[body.email.trim().toLowerCase()]);
  const token = user == null ? null : await issueAdminSession(user.id,body.password);
  if (!token) return NextResponse.json({error:"Unable to sign in with those administrator credentials"},{status:401});
  await revokeAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  const res=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  res.cookies.set(ADMIN_COOKIE,token,{...ADMIN_COOKIE_OPTIONS,maxAge:ADMIN_SESSION_SECONDS});
  return res;
}
