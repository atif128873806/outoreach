import { NextRequest,NextResponse } from "next/server";
import { getAdminId } from "@/lib/admin-auth";
import { adminFilters,activityData,overviewData,errorsData,usersData,operationsData,metadataCsv } from "@/lib/admin-data";
export const runtime="nodejs";
export async function GET(req:NextRequest) {
  if(await getAdminId()==null)return NextResponse.json({error:"Administrator sign-in required"},{status:401});
  let input;try{input=adminFilters(req.nextUrl.searchParams);}catch{return NextResponse.json({error:"Invalid dashboard filters"},{status:400});}
  try {
    const {view,filters}=input;
    if(req.nextUrl.searchParams.get("format")==="csv"){
      const data=await activityData(filters,true);
      return new NextResponse(metadataCsv(data.rows),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=search-metadata.csv","Cache-Control":"no-store"}});
    }
    const data=await ({overview:overviewData,activity:activityData,errors:errorsData,users:usersData,operations:operationsData}[view])(filters);
    return NextResponse.json({view,filters,data,generatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  } catch {
    console.error("[admin] dashboard query failed");
    return NextResponse.json({error:"Dashboard data is temporarily unavailable. Please retry."},{status:500});
  }
}
