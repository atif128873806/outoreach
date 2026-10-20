import type { Metadata } from "next";
import PublicShell from "../components/PublicShell";
import LondonPreview from "../components/LondonPreview";
import { pilotAudience } from "@/lib/pilot";
export const metadata:Metadata={title:"London live business sample",description:"Explore a limited public London business sample, then create an account to run your own shortlist search."};
export default async function DemoPage({searchParams}:{searchParams:Promise<{audience?:string}>}){
  return <PublicShell title="Try your London workflow" subtitle="A small public sample before you create an account." wide><div className="mx-auto max-w-4xl"><LondonPreview initialAudience={pilotAudience((await searchParams).audience)}/></div></PublicShell>;
}
