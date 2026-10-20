import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "../components/PublicShell";
import ProductStory from "../components/ProductStory";
import Icon from "../components/Icon";
import { PILOT_AUDIENCES,type PilotAudience } from "@/lib/pilot";
export const metadata:Metadata={title:"London lead research features",description:"Search London businesses, review public details and dated website findings, and save or export your shortlist."};
export default function Features(){return <PublicShell title="The research behind your shortlist." subtitle="Business discovery, website evidence and a practical way to decide which businesses fit your work." wide>
  <div className="feature-overview"><div><h2 className="display-heading">Search. Inspect.<br />Make a decision.</h2><p className="marketing-copy mt-5">Go from a business type and area to a shortlist you can qualify. Available public details and dated website findings give your research context.</p><Link href="/demo" className="ui-primary mt-7">Try a real London sample<Icon name="arrow" className="h-4 w-4"/></Link></div><ProductStory initialStep={1}/></div>
  <div className="feature-capabilities">{[
    ["Search where your work takes you", "Choose a niche, a location and the available website filter. Use web discovery, OpenStreetMap or Companies House where your plan permits.","search"],
    ["See what an audit actually found", "Where a website can be checked, inspect dated findings and their evidence. A missing listing or unavailable audit does not establish that a business has no website or a broken one.","shield"],
    ["Keep working while a search runs", "A durable queue keeps progress visible. Queue within your account limit, then reopen a completed search during its seven-day retention.","clock"],
    ["Turn research into a working shortlist", "Select records, copy research notes, export CSV or save eligible contacts. A business result is something to qualify, not a verified email or a guaranteed customer.","leads"],
  ].map(([title,body,icon])=><section key={title}><Icon name={icon as "search"|"shield"|"clock"|"leads"} className="h-6 w-6 text-accent"/><div><h2>{title}</h2><p>{body}</p></div></section>)}</div>
  <section className="feature-access"><div><h2 className="display-heading">Choose the depth<br />your work needs.</h2><p className="marketing-copy mt-5">Current access is consistent across all three pilot audiences.</p><Link href="/pricing" className="text-link">Compare allowances & access<Icon name="arrow" className="h-4 w-4"/></Link></div><dl><div><dt>Free</dt><dd>Any business and Has a website</dd></div><div><dt>Starter</dt><dd>Adds Outdated or broken site</dd></div><div><dt>Pro</dt><dd>Adds No website and Companies House</dd></div></dl></section>
  <section className="mt-20"><h2 className="display-heading">Start with your workflow.</h2><div className="audience-list mt-8">{(Object.keys(PILOT_AUDIENCES) as PilotAudience[]).map(key=><Link key={key} href={`/demo?audience=${key}`} className="audience-row"><h3>{PILOT_AUDIENCES[key].label}</h3><p>{PILOT_AUDIENCES[key].title}</p><span>Explore a sample<Icon name="arrow" className="h-4 w-4"/></span></Link>)}</div></section>
</PublicShell>;}
