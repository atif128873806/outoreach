import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validAdminOrigin } from "@/lib/admin-policy";
import { isPilotAudience } from "@/lib/pilot";
import { loadPilotPreview, PreviewUnavailable, reservePilotWindow } from "@/lib/pilot-preview";
import { getDb } from "@/lib/db";
import { readPilotBody } from "@/lib/pilot-request";
import { clientIp } from "@/lib/ratelimit";
import { getUserId } from "@/lib/auth";
import { PILOT_COOKIE, recordPilotPreview, bestEffortPilot } from "@/lib/pilot-journey";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function POST(req: NextRequest) {
  if (!validAdminOrigin(req.url,req.headers)) return NextResponse.json({error:"Invalid origin"},{status:403,headers});
  const body=await readPilotBody(req);
  if (!body || Array.isArray(body) || !isPilotAudience(body.audience) || Object.keys(body).some(k=>k!=="audience")) {
    return NextResponse.json({error:"Choose a London sample"},{status:400,headers});
  }
  const id=req.cookies.get(PILOT_COOKIE)?.value;
  try {
    const ip=createHash("sha256").update(clientIp(req)).digest("hex");
    if (!await reservePilotWindow(await getDb(),`pilot-preview-ip:${ip}`,12,60_000)) {
      return NextResponse.json({error:"Too many sample requests. Try again in a minute."},{status:429,headers:{...headers,"Retry-After":"60"}});
    }
    const preview=await loadPilotPreview(body.audience);
    await bestEffortPilot(async()=>recordPilotPreview(id,await getUserId(),true));
    return NextResponse.json(preview,{headers});
  } catch (error) {
    await bestEffortPilot(async()=>recordPilotPreview(id,await getUserId(),false));
    const retry=error instanceof PreviewUnavailable?error.retryAfter:60;
    return NextResponse.json({error:"The live sample is temporarily unavailable. Try again shortly or create an account to search."},
      {status:503,headers:{...headers,"Retry-After":String(retry)}});
  }
}
