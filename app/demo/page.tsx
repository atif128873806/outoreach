import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "../components/PublicShell";

export const metadata: Metadata = {
  title: "London business shortlist preview",
  description: "Explore example London shortlists for web agencies, accountants and local sales teams, then run your own search.",
};

// Public examples only. No private job payload, contacts or provider requests
// are used here. Keep fixtures explicit until a live preview policy is agreed.
const EXAMPLES = {
  agencies: {
    label: "Web agencies & freelancers", query: "Dentists in Croydon",
    title: "Find a specific website problem to discuss",
    business: "Example Dental Practice", place: "Croydon, London",
    category: "Dental practice", evidence: "Illustrative finding: the contact-page link returns a missing-page error.",
    next: "Check the finding on the business website, then decide whether it is worth adding to your shortlist.",
    caveat: "A website issue is a reason to investigate. It does not establish that the business wants a redesign.",
  },
  accountants: {
    label: "Accountants", query: "Design-service companies in London",
    title: "Qualify a company using its public register details",
    business: "Example Design Services Ltd", place: "Hackney, London",
    category: "Design services", evidence: "Illustrative register details: active limited company with a London registered address.",
    next: "Confirm the register record and trading location, then assess whether the company fits your services.",
    caveat: "A registered address does not prove a trading location or an accounting need. Current registry searches require Pro and the No website filter; this preview is not a new-company feed.",
  },
  sales: {
    label: "Local-business sales teams", query: "Electricians in Southwark",
    title: "Build a local shortlist for your sales research",
    business: "Example Electrical Services", place: "Southwark, London",
    category: "Electrical services", evidence: "Illustrative directory details: business category and locality match the search.",
    next: "Review the location and any available public contact details, then export or save the businesses that fit.",
    caveat: "A category match is a research starting point. It does not establish buying intent or guarantee a contact method.",
  },
} as const;
type Audience = keyof typeof EXAMPLES;

export default async function DemoPage({ searchParams }: {
  searchParams: Promise<{ audience?: string | string[] }>;
}) {
  const params = await searchParams;
  const audience: Audience = typeof params.audience === "string" && Object.hasOwn(EXAMPLES, params.audience)
    ? params.audience as Audience : "agencies";
  const example = EXAMPLES[audience];
  return (
    <PublicShell title="See what a London shortlist looks like"
      subtitle="Choose your workflow, review the evidence, then search for businesses that fit your services." wide>
      <div className="mx-auto max-w-4xl">
        <nav aria-label="Preview audience" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-4">
          {(Object.keys(EXAMPLES) as Audience[]).map((key) => (
            <Link key={key} href={`/demo?audience=${key}`} aria-current={key === audience ? "page" : undefined}
              className={`rounded-md px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${key === audience ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
              {EXAMPLES[key].label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 border-l-2 border-amber-500 pl-3 text-sm text-zinc-600">
          <strong className="font-semibold text-zinc-900">Illustrative example.</strong> All businesses and findings on this page are fictional. This is a product preview, not a live search or a customer result.
        </p>
        <section aria-labelledby="example-title" className="py-8">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Example search · {example.query}</p>
          <h2 id="example-title" className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">{example.title}</h2>
          <dl className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
            {([ ["Business", example.business], ["Location", example.place], ["Category", example.category],
              ["Evidence", example.evidence], ["Next step", example.next] ] as const).map(([label, value]) => (
              <div key={label} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-5">
                <dt className="font-medium text-zinc-500">{label}</dt><dd className="text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-6 text-zinc-500">{example.caveat}</p>
        </section>
        <section className="border-t border-zinc-200 pt-6 pb-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div><h2 className="font-semibold text-zinc-950">Run your own London search</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Create an account to choose a niche and location. Review your results, then export or save your shortlist. Available sources and filters depend on your plan.</p></div>
          <Link href="/signup" className="mt-4 inline-flex shrink-0 rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 sm:mt-0">Start free</Link>
        </section>
        <Link href="/features" className="text-sm text-zinc-600 underline underline-offset-4">Explore the search and audit features</Link>
      </div>
    </PublicShell>
  );
}
