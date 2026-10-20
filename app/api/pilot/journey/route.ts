import { NextRequest,NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { validAdminOrigin } from "@/lib/admin-policy";
import { isPilotAudience,isPilotBrowserEvent,pilotAudience } from "@/lib/pilot";
import { PILOT_COOKIE,PILOT_CHOICE_COOKIE,PILOT_COOKIE_OPTIONS,pilotSession,startPilotSession,
  withdrawPilotSession,recordPilotBrowserEvent } from "@/lib/pilot-journey";
import { reservePilotWindow } from "@/lib/pilot-preview";
import { getDb } from "@/lib/db";
import { readPilotBody } from "@/lib/pilot-request";
import { clientIp } from "@/lib/ratelimit";
import { createHash } from "node:crypto";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(req:NextRequest){
  const uid=await getUserId();const session=await pilotSession(req.cookies.get(PILOT_COOKIE)?.value,uid);
  return NextResponse.json({consented:Boolean(session),choice:session?'allowed':req.cookies.get(PILOT_CHOICE_COOKIE)?.value==='declined'?'declined':null},{headers});
}
export async function POST(req:NextRequest){
  if(!validAdminOrigin(req.url,req.headers))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
  const body=await readPilotBody(req);
  if(!body)return NextResponse.json({error:"Invalid analytics request"},{status:400,headers});
  const id=req.cookies.get(PILOT_COOKIE)?.value;
  const uid=await getUserId();
  try {
    // Withdrawal is always available and never limited behind analytics ingestion.
    if(body.action==='consent'&&body.allow===false){
      await withdrawPilotSession(id);
      const res=NextResponse.json({ok:true,consented:false},{headers});
      res.cookies.set(PILOT_COOKIE,'',{...PILOT_COOKIE_OPTIONS,maxAge:0});
      res.cookies.set(PILOT_CHOICE_COOKIE,'declined',{...PILOT_COOKIE_OPTIONS,maxAge:90*86400});return res;
    }
    const ip=createHash('sha256').update(clientIp(req)).digest('hex');
    if(!await reservePilotWindow(await getDb(),`pilot-journey-ip:${ip}`,60,60_000))return NextResponse.json({error:"Please retry shortly"},{status:429,headers});
    if(body.action==='consent'&&body.allow===true&&isPilotAudience(body.audience)){
      const token=await startPilotSession(body.audience,uid,id);
      const res=NextResponse.json({ok:true,consented:true},{headers});
      res.cookies.set(PILOT_COOKIE,token,PILOT_COOKIE_OPTIONS);
      res.cookies.set(PILOT_CHOICE_COOKIE,'allowed',{...PILOT_COOKIE_OPTIONS,maxAge:90*86400});return res;
    }
    if(body.action==='event'&&isPilotBrowserEvent(body.event)&&isPilotAudience(body.audience)){
      if((body.event==='upgrade_interest'&&!uid)||!await pilotSession(id,uid))return NextResponse.json({ok:true,recorded:false},{headers});
      await recordPilotBrowserEvent(id,body.event,pilotAudience(body.audience),uid);
      return NextResponse.json({ok:true,recorded:true},{headers});
    }
    return NextResponse.json({error:"Invalid analytics request"},{status:400,headers});
  }catch{return NextResponse.json({error:"Analytics preferences are temporarily unavailable. Your searches still work."},{status:503,headers});}
}
