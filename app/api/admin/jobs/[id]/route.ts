import { NextRequest,NextResponse } from "next/server";
import { getAdminId } from "@/lib/admin-auth";
import { retainedJobDetail } from "@/lib/admin-data";
export const runtime="nodejs";
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  if(await getAdminId()==null)return NextResponse.json({error:"Administrator sign-in required"},{status:401});
  const id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:"Invalid search id"},{status:400});
  const result=await retainedJobDetail(id);
  return result?NextResponse.json(result,{headers:{"Cache-Control":"no-store"}}):NextResponse.json({error:"Result expired or unavailable"},{status:404});
}
