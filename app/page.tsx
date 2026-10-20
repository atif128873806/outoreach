import Link from "next/link";
import PublicHeader from "./components/PublicHeader";
import PublicFooter from "./components/PublicFooter";
import ToolsDropdown from "./components/ToolsDropdown";
import PilotSignupLink from "./components/PilotSignupLink";
import LondonPreview from "./components/LondonPreview";
import HomeResearchStage from "./components/HomeResearchStage";
import ResearchCoverage from "./components/ResearchCoverage";
import Icon from "./components/Icon";
import { PILOT_AUDIENCES, pilotAudience, type PilotAudience } from "@/lib/pilot";
import { PLANS, FILTER_LABELS } from "@/lib/plans";
import "./home.css";

export default async function Home({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const audience = pilotAudience((await searchParams).audience);
  return <div className="marketing-site homepage-studio"><PublicHeader tools={<ToolsDropdown />} /><main id="main-content">
    <section className="home-hero page-width">
      <div className="hero-opening">
        <h1>London businesses.<br /><span>A clearer <span className="hero-focus">shortlist.</span></span></h1>
        <div className="hero-copy"><p>Find businesses by niche and area. Review public details and website evidence, then decide who deserves a closer look.</p>
          <div className="hero-actions"><PilotSignupLink className="ui-primary">Build your shortlist<Icon name="arrow" className="h-4 w-4" /></PilotSignupLink><a href="#preview" className="ui-secondary">Try a real sample</a></div>
          <p className="hero-allowance">{PLANS.free.leadsPerMonth} returned leads / month on Free. No card required.</p>
        </div>
      </div>
      <HomeResearchStage />
    </section>
    <div className="source-strip page-width" aria-label="Research sources"><span>Research, grounded in public sources</span><strong>OpenStreetMap</strong><strong>Web discovery</strong><strong>Companies House<span className="ml-2 text-xs font-normal text-muted">Pro</span></strong></div>
    <section className="workflow-section page-width" id="how"><div className="section-opening"><h2 className="display-heading">From a search<br />to a better conversation.</h2><p className="marketing-copy">Research gives you a starting point. The details and dated findings help you decide what to do with it.</p></div>
      <nav className="home-workflow-navigation" aria-label="Search to shortlist"><a href="#search"><Icon name="search" />Search by niche & area<Icon name="arrow" className="h-4 w-4" /></a><a href="#audit"><Icon name="shield" />Inspect the evidence<Icon name="arrow" className="h-4 w-4" /></a><a href="#filter"><Icon name="check" />Keep what fits<Icon name="arrow" className="h-4 w-4" /></a></nav>
      <div className="workflow-editorial">
        <div id="search" className="workflow-text"><Icon name="search" className="h-6 w-6 text-accent" /><h3>Start where<br />you want to work.</h3><p>Choose a business type and a London area. Adjust the available website filter and source to match the work you do.</p><Link href="/features" className="text-link">Explore business discovery<Icon name="arrow" className="h-4 w-4" /></Link></div>
        <div className="query-specimen" aria-label="Illustrative search criteria"><div className="query-specimen-top"><Icon name="search" className="h-5 w-5" /><span>Illustrative search criteria</span></div><div className="query-specimen-line"><span>Business type</span><strong>Dentists</strong></div><div className="query-specimen-line"><span>Location</span><strong>Croydon, London, UK</strong></div><div className="query-specimen-line"><span>Website filter</span><strong>Has a website</strong></div><div className="query-specimen-route"><Icon name="map" className="h-4 w-4" /><span>Croydon</span><span className="query-route-line" aria-hidden="true" /><span>London, UK</span></div><p>Example criteria. Your search starts only when you choose Search inside your account.</p></div>
      </div>
      <div className="workflow-editorial audit-editorial"><div className="evidence-specimen" aria-label="Illustrative website evidence"><div className="evidence-status"><Icon name="shield" className="h-5 w-5" /><span>Illustrative finding · fictional business</span></div><div className="evidence-response" aria-hidden="true"><span>Appointment link</span><span className="evidence-response-line" /><strong>404</strong></div><h3>A broken appointment link.</h3><p className="evidence-url">marlow.example.test / appointments</p><dl><div><dt>Observed response</dt><dd>HTTP 404 in this example</dd></div><div><dt>What to do next</dt><dd>Check the current page before quoting the finding.</dd></div></dl><p className="evidence-footnote">A finding is useful context. It is not proof of buying intent.</p></div>
        <div id="audit" className="workflow-text"><Icon name="shield" className="h-6 w-6 text-accent" /><h3>Read the evidence.<br />Not just a score.</h3><p>Open available website findings, see what could be checked and when, and understand the limits. Missing information stays missing.</p><Link href="/docs#accuracy" className="text-link">How to interpret an audit<Icon name="arrow" className="h-4 w-4" /></Link></div></div>
      <div id="filter" className="shortlist-section"><div><h3>Keep the businesses<br />that fit your work.</h3><p className="marketing-copy">Select the useful records. Export your shortlist or save contacts with eligible contact details. Return to a completed search for seven days.</p><Link href="/features" className="text-link">See the whole workflow<Icon name="arrow" className="h-4 w-4" /></Link></div><div className="shortlist-handoff"><div className="shortlist-document" aria-label="Illustrative CSV export"><div><Icon name="leads" className="h-4 w-4" /><span>shortlist.csv</span><span>Illustration</span></div><p><span>business</span><span>area</span></p><p><strong>Marlow Dental</strong><span>Croydon</span></p><small>Fictional record · no file is downloaded</small></div><div className="shortlist-actions" aria-label="Available account actions"><span><Icon name="check" />Select records</span><span><Icon name="leads" />Save eligible contacts</span><span><Icon name="arrow" />Export CSV</span></div></div></div>
    </section>
    <section id="preview" className="sample-section marketing-block"><div className="page-width"><div className="section-opening"><h2 className="display-heading">A real sample.<br />Before you sign up.</h2><p className="marketing-copy">Choose a workflow and explore up to three public London records. Names, areas, categories and listed websites. Contact details and audits stay outside this preview.</p></div><LondonPreview initialAudience={audience} compact /></div></section>
    <section className="audience-section page-width" aria-labelledby="audiences-title"><div className="section-opening"><h2 id="audiences-title" className="display-heading">Your work.<br />Your way to use it.</h2><p className="marketing-copy">A research tool for three London workflows. The same sources, with a different question to answer.</p></div><div className="audience-list">{(Object.keys(PILOT_AUDIENCES) as PilotAudience[]).map(key => <Link key={key} href={`/demo?audience=${key}`} className="audience-row"><h3>{PILOT_AUDIENCES[key].label}</h3><p>{PILOT_AUDIENCES[key].description}</p><span>Explore the workflow<Icon name="arrow" className="h-4 w-4" /></span></Link>)}</div></section>
    <ResearchCoverage />
    <section id="plans" className="home-plans page-width" aria-labelledby="home-plans-title">
      <div className="section-opening"><h2 id="home-plans-title" className="display-heading">Start with a shortlist.<br />Choose your research depth.</h2><div><p className="marketing-copy">Current plans differ in returned-lead allowance and website filter access.</p><Link href="/pricing" className="text-link">Compare the plans<Icon name="arrow" className="h-4 w-4" /></Link></div></div>
      <div className="home-plan-comparison">{Object.values(PLANS).map(plan => <article key={plan.id} className={`home-plan home-plan-${plan.id}`} aria-labelledby={`home-plan-${plan.id}-title`}>
        <div className="home-plan-heading"><h3 id={`home-plan-${plan.id}-title`}>{plan.name}</h3>{plan.id === "pro" && <span>Full filter access</span>}</div>
        <p className="home-plan-price"><strong>${plan.priceMonthlyUsd}</strong><span>USD / month</span></p>
        <p className="home-plan-allowance"><strong>{plan.leadsPerMonth?.toLocaleString("en-GB")}</strong> returned leads / month</p>
        <div className="home-plan-access"><p>Website filter access</p><ul>{plan.filters.map(filter => <li key={filter}><Icon name="check" className="h-4 w-4" />{FILTER_LABELS[filter]}</li>)}</ul>{plan.id === "pro" && <p className="home-plan-registry">Companies House with the No website filter.</p>}</div>
        {plan.id === "free" ? <PilotSignupLink className="ui-primary home-plan-action">Start free<Icon name="arrow" className="h-4 w-4" /></PilotSignupLink> : <Link href="/pricing" className="ui-secondary home-plan-action">View {plan.name} details<Icon name="arrow" className="h-4 w-4" /></Link>}
      </article>)}</div>
      <p className="home-plan-terms"><Icon name="help" className="h-4 w-4" /><span>Paid plans are activated by our team. Payment and renewal terms are confirmed before you pay.</span></p>
    </section>
    <section id="faq" className="faq-section page-width"><h2 className="display-heading">A few things<br />worth knowing.</h2><div>{[
      ["Can I try it before signup?", "Yes. Load up to three public map records for a fixed London workflow. Names, sample areas, categories and websites are included where listed. Contact details and audits are outside this preview."],
      ["Will every business have contact details?", "No. Public-source coverage varies. Review what is available and confirm the details before approaching a business."],
      ["How does cached data affect my allowance?", "A new search uses the returned-lead allowance even when it reuses fresh source data. Reopening a completed search during its seven-day retention does not run another search or use more allowance."],
      ["Do you check every website?", "Website findings are provided where a website exists and can be checked. An unavailable audit or missing website listing is not proof of a broken business or no website."],
    ].map(([q, a]) => <details key={q}><summary>{q}<Icon name="plus" className="h-4 w-4 shrink-0 text-muted" /></summary><p>{a}</p></details>)}</div></section>
    <section className="final-invitation"><div className="page-width"><h2>Start with your next<br />London shortlist.</h2><div><p>Choose a niche. Choose an area.<br />Find the businesses worth a closer look.</p><PilotSignupLink className="ui-primary">Start researching free<Icon name="arrow" className="h-4 w-4" /></PilotSignupLink></div></div></section>
  </main><PublicFooter /></div>;
}
