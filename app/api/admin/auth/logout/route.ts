import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, revokeAdminSession, validAdminOrigin } from "@/lib/admin-session";
import { ADMIN_COOKIE_OPTIONS } from "@/lib/admin-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest) {
  if (!validAdminOrigin(req.url,req.headers)) return NextResponse.json({error:"Invalid origin"},{status:403});
  await revokeAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  const res=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  res.cookies.set(ADMIN_COOKIE,"",{...ADMIN_COOKIE_OPTIONS,maxAge:0});
  return res;
}
