import type { Metadata } from "next";
import Link from "next/link";
import { LogoTile } from "../components/Logo";
import PublicFooter from "../components/PublicFooter";
import ToolsDropdown from "../components/ToolsDropdown";

export const metadata: Metadata = {
  title: "Features — Outreach Studio",
  description:
    "A guided tour of the whole product: search a niche and a city, get live businesses with contact details, and see exactly what is wrong with each website — scored, evidenced, and exportable.",
};

/* ---------------------------------------------------------------- helpers */

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function Tick() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Browser-window chrome around each product vignette. */
function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/[0.07]">
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="ml-3 truncate rounded-md bg-white px-2.5 py-0.5 text-[11px] text-zinc-400 ring-1 ring-zinc-100">
          {url}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** Left column of a stage: ghost number, kicker, headline, copy, checklist. */
function StageCopy({
  n,
  kicker,
  title,
  children,
  points,
}: {
  n: string;
  kicker: string;
  title: React.ReactNode;
  children: React.ReactNode;
  points: string[];
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute -top-14 -left-3 hidden select-none text-[150px] font-bold leading-none tracking-tighter text-zinc-100 sm:block"
        aria-hidden
      >
        {n}
      </span>
      <div className="relative">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
          {kicker}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-4 leading-relaxed text-zinc-500">{children}</p>
        <ul className="mt-6 space-y-2.5 text-sm text-zinc-600">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5">
              <Tick />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const STEPS = [
  { label: "Search", d: "M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" },
  { label: "Enrich", d: "M4 4h16v16H4zM8 10v6M8 7v.01M12 16v-4a2 2 0 014 0v4" },
  { label: "Audit", d: "M9 12l2 2 4-4M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { label: "Rank", d: "M3 3v18h18M7 15l4-4 3 3 5-6" },
  { label: "Export", d: "M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" },
];

const FILTERS = [
  {
    name: "Any business",
    who: "The honest default",
    tone: "bg-zinc-100 text-zinc-600",
    body: "Everything the sources find for that niche and place, ranked by how strong a prospect they are — with the audit attached either way.",
    d: "M4 6h16M4 12h16M4 18h10",
  },
  {
    name: "Has a website",
    who: "Plan: Free and up",
    tone: "bg-blue-100 text-blue-700",
    body: "Only businesses with a reachable site, each one audited and scored. Use it when you need to see them online before deciding anything.",
    d: "M4 4h16v16H4zM4 7l8 6 8-6",
  },
  {
    name: "Outdated or broken site",
    who: "Plan: Starter and up",
    tone: "bg-violet-100 text-violet-700",
    body: "Only sites with a real, checkable defect — a certificate browsers refuse, a nav full of dead links, no mobile layout. Worst sites first, because those are the easiest conversations.",
    d: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  },
  {
    name: "No website",
    who: "Plan: Pro",
    tone: "bg-amber-100 text-amber-700",
    body: "Businesses on the map with no site at all. Each one gets its own web lookup for a phone, Instagram or email, because offline businesses still have a social page.",
    d: "M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zM12 9v.01",
  },
];

/* ------------------------------------------------------------------ page */

export default function FeaturesPage() {
  return (
    <div className="bg-white text-zinc-900 antialiased">
      {/* Nav — same chrome as the landing page */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoTile className="h-7 w-7" />
            Outreach<span className="text-zinc-400">Studio</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-zinc-500 md:flex">
            <span className="font-medium text-zinc-900">Features</span>
            <a href="#tour" className="hover:text-zinc-900">How it works</a>
            <ToolsDropdown />
            <Link href="/pricing" className="hover:text-zinc-900">Pricing</Link>
            <Link href="/#faq" className="hover:text-zinc-900">FAQ</Link>
            <Link href="/contact" className="hover:text-zinc-900">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:bg-zinc-700 hover:shadow-md sm:px-4"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(24,24,27,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,24,27,0.035) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(75% 60% at 50% 0%, black 55%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(75% 60% at 50% 0%, black 55%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-[380px] w-[680px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(42,120,214,0.13) 0%, rgba(255,255,255,0) 100%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-14 text-center">
          <p className="rise rise-1 mx-auto mb-5 inline-block rounded-full border border-zinc-200 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
            The product tour
          </p>
          <h1 className="rise rise-2 mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.1]">
            One search turns a niche into a list of businesses{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">
              with a problem you can fix
            </span>
          </h1>
          <p className="rise rise-3 mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-zinc-500">
            Five steps, and every one of them is measured. This page walks the whole
            machine end to end — exactly what you see after you sign up.
          </p>

          {/* Animated pipeline diagram */}
          <div className="rise rise-4 relative mx-auto mt-12 max-w-3xl">
            <svg
              className="pointer-events-none absolute top-7 right-[10%] left-[10%] hidden h-2 w-[80%] sm:block"
              viewBox="0 0 100 2"
              preserveAspectRatio="none"
              aria-hidden
            >
              <line
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="#c7d5f0"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                className="flow-line"
              />
            </svg>
            <ol className="relative flex flex-wrap items-start justify-center gap-x-4 gap-y-6 sm:justify-between sm:gap-0">
              {STEPS.map((s, i) => (
                <li key={s.label} className="flex w-24 flex-col items-center gap-2.5 sm:w-auto sm:flex-1">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-md shadow-zinc-900/5">
                    <Icon d={s.d} className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium text-zinc-700">
                    <span className="mr-1 text-xs text-zinc-400">{i + 1}.</span>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Honest fact strip — product facts, not vanity metrics */}
          <div className="rise rise-4 mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["3", "live sources, no database"],
              // Guarded by tests/siteaudit.test.ts: the number here has to match
              // the checks lib/siteaudit.ts can actually apply, so adding a check
              // fails the suite instead of quietly making this line a promise the
              // engine doesn't keep.
              ["23", "checks per website"],
              ["4", "filters, 4 kinds of customer"],
              ["$0", "to find your first leads"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-zinc-200 bg-white/80 px-4 py-3">
                <div className="text-xl font-semibold tracking-tight">{v}</div>
                <div className="mt-0.5 text-xs text-zinc-400">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== STAGE 1 — SEARCH ============================== */}
      <section id="tour" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <StageCopy
            n="1"
            kicker="Search"
            title="Type a niche and a city. Get businesses that exist right now."
            points={[
              "Three keyless sources: AI web search, OpenStreetMap, and the official UK register",
              "The city is a constraint, not a hint — every business's own address is checked against it",
              "Four filters, each aimed at a different kind of customer",
              "Ask for 10 or for 40: you get what the sources genuinely find, and the count is never padded",
            ]}
          >
            There is no pre-built list under the hood, and nothing is resold as
            &quot;fresh&quot;. Every result is fetched at the moment you search —
            which is why a quiet niche returns fewer businesses and says so
            instead of filling the page with lookalikes.
          </StageCopy>

          <BrowserFrame url="outreach.sakodev.com/leads">
            {/* search bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
                <Icon d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" className="h-4 w-4 shrink-0 text-zinc-400" />
                dentists · Austin, USA
              </span>
              <span className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white">
                Find 10 leads
              </span>
            </div>
            {/* filters */}
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              {["Any business", "Has a website", "Outdated or broken", "No website 🔒"].map((f, i) => (
                <span
                  key={f}
                  className={`rounded-full border px-2.5 py-1 ${
                    i === 2
                      ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                      : "border-zinc-200 text-zinc-500"
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
            {/* results */}
            <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-100">
              {[
                ["Circle C Dental", "Austin, United States", "42", "poor", "the https address serves a certificate issued for a different website"],
                ["Breeze Dental Studio", "Austin, United States", "71", "fair", "3 broken links on the homepage — all of them point at /services"],
                ["North Austin Dentistry", "Austin, United States", "88", "good", "the homepage carries a lot of markup (about 466 KB)"],
              ].map(([name, addr, score, grade, issue]) => (
                <div key={name} className="flex items-start gap-3 px-3.5 py-3">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                      grade === "poor"
                        ? "bg-red-50 text-red-700"
                        : grade === "fair"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs text-zinc-400">{addr}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-500">{issue}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">
                2 results weren&apos;t in Austin, USA and were left out
              </span>
              <span>3 leads · 2 with email · 3 sites audited · 2 need work</span>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* ============================== STAGE 2 — ENRICH ============================== */}
      <section className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="lg:order-2">
              <StageCopy
                n="2"
                kicker="Enrich"
                title="Every way to reach the business, read from the business itself."
                points={[
                  "Website, email, phone, Instagram and LinkedIn, pulled from the pages they publish",
                  "De-obfuscation is handled: info [at] company [dot] com is still an email",
                  "One click finds the owner or founder behind a business and attaches the name to the lead",
                  "Plausibility gates: copyright ranges and server IPs are rejected, never shown as phone numbers",
                  "Nothing is invented — a field we can't confirm stays empty",
                ]}
              >
                This is the step that decides whether a lead is worth having. A
                business without a website is still contactable: the offline hunt
                looks for a phone, a social handle or an address on the web,
                because that is where those businesses actually live.
              </StageCopy>
            </div>

            <div className="lg:order-1">
              <BrowserFrame url="outreach.sakodev.com/leads — contact detail">
                <div className="rounded-xl border border-zinc-100 p-3.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">Sayco Heating &amp; Air Conditioning</span>
                    <span className="text-[11px] text-zinc-400">Tucson, United States</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                      ✉ sales@sayco.com
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                      ☎ +1 520 887 2926
                    </span>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                      @saycoheating
                    </span>
                    <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-zinc-500">
                      ★ owner found — Ana Reyes, Operations
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 rounded-xl border border-dashed border-zinc-200 px-3.5 py-2.5 text-[11px] text-zinc-400">
                  No phone found on this business&apos;s pages — the field stays empty
                  rather than guessing at a number you would dial.
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== STAGE 3 — AUDIT ============================== */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <StageCopy
            n="3"
            kicker="Audit"
            title="Twenty-one checks, each one a sentence you can say out loud."
            points={[
              "Transport: does it answer at all, is the certificate valid, does it load on a phone, does it answer fast",
              "Content: dead links, free-builder pages, insecure resources on a secure page, 2000s-era markup",
              "Weight: how much markup a phone has to download before it sees anything",
              "Every finding carries its evidence — the number, the URL, the domain on the certificate",
              "One honest grade for sites we could not judge: unknown, with the reason",
            ]}
          >
            The score is 100 minus the weight of what actually failed, so it sorts
            a market by how much work a business needs. The findings are what
            lands in the lead&apos;s notes and travels into your CSV — ready
            to open a conversation with something specific and checkable.
          </StageCopy>

          <BrowserFrame url="outreach.sakodev.com/leads — website audit">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">tucsonairconditioningaz.com</span>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                55/100 · poor
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                <div className="font-medium text-red-800">
                  the https address serves a certificate issued for a different website (mindseyesports.com)
                </div>
                <div className="mt-1 text-zinc-500">
                  browsers refuse to open it — the certificate was issued for
                  mindseyesports.com, and the site itself only loads over plain
                  http://, which browsers label &apos;Not secure&apos;
                </div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                <div className="font-medium text-amber-800">
                  at least 13 broken links on the homepage
                </div>
                <div className="mt-1 text-zinc-500">
                  all of them point at sayco.com/products, which doesn&apos;t exist
                </div>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
                <div className="font-medium text-zinc-600">
                  the site refused our automated check
                </div>
                <div className="mt-1 text-zinc-500">
                  graded unknown — a bot wall is not a defect, so nothing is
                  claimed about this one
                </div>
              </div>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* ============================== STAGE 4 — PROVE ============================== */}
      <section className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="lg:order-2">
              <StageCopy
                n="4"
                kicker="Prove"
                title="What the audit refuses to claim."
                points={[
                  "A site that blocks our check is unknown, never broken",
                  "A timeout is recorded and never used as a reason to make contact",
                  "Soft gaps — a missing meta description, no analytics — can never flag a business",
                  "Link checks ignore head metadata and vendor links no visitor can click",
                  "Speed is quoted from the server's own response, twice-checked, rounded down",
                  "A page too big to read fully silences the checks that depend on its footer",
                ]}
              >
                A tool like this fails in exactly one way: it accuses a healthy
                business of being broken, and the person using it loses the deal
                on the first line. So every uncertain signal becomes silence or a
                downgrade — we would rather hand you one fewer lead than point
                you at a business that is doing nothing wrong.
              </StageCopy>
            </div>

            <div className="lg:order-1">
              <BrowserFrame url="outreach.sakodev.com/leads — why this lead is ranked here">
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ["Sites audited", "8"],
                    ["Need work", "2"],
                    ["Left out of area", "2"],
                    ["Unknown (not judged)", "1"],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl border border-zinc-100 bg-white px-3 py-3">
                      <div className="text-[11px] text-zinc-400">{l}</div>
                      <div className="mt-0.5 text-xl font-semibold tracking-tight">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 text-[11px]">
                  {[
                    ["the security certificate has expired", "critical · browsers warn until it's renewed"],
                    ["no HTTPS", "high · the address bar reads 'Not secure'"],
                    ["the site refused our automated check", "unknown · nothing claimed"],
                    ["no analytics or ad tags detected", "low · recorded, never a flag"],
                  ].map(([t, s]) => (
                    <div
                      key={t}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2"
                    >
                      <span className="text-zinc-600">{t}</span>
                      <span className="shrink-0 text-zinc-400">{s}</span>
                    </div>
                  ))}
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== STAGE 5 — RANK & EXPORT ============================== */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <StageCopy
            n="5"
            kicker="Rank & export"
            title="Ordered for the way you actually work the list."
            points={[
              "Best prospects balances everything we know; Easiest to reach lifts businesses with a contact detail",
              "Worst site first is pure audit score — the redesign seller's order",
              "Pitch copies one lead's block: the business, every contact path, the score, the problems",
              "CSV exports who → where → how to reach → why → the evidence behind it",
              "A business you already saved is hidden on the next search and never counted twice",
            ]}
          >
            The point of a lead list is the first thirty seconds of a phone call.
            The export therefore leads with the reason to make contact, and keeps
            the audit summary beside it so nothing in the pitch depends on
            memory.
          </StageCopy>

          <BrowserFrame url="outreach.sakodev.com/leads — export">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 font-mono text-[10.5px] leading-relaxed text-zinc-600">
              business_name,category,address,website,email,phone,instagram,linkedin,
              <br />
              why_reach_out,site_score,site_grade,site_verdict,site_problems,notes
            </div>
            <div className="mt-3 space-y-1.5 text-[11px]">
              {[
                ["Circle C Dental", "42 · poor", "certificate issued for another website"],
                ["Breeze Dental Studio", "71 · fair", "13 broken links → /services"],
                ["North Austin Dentistry", "88 · good", "heavy homepage — 466 KB of markup"],
              ].map(([n, s, w]) => (
                <div
                  key={n}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2"
                >
                  <span className="text-zinc-600">{n}</span>
                  <span className="shrink-0 text-zinc-400">{s}</span>
                  <span className="hidden truncate text-zinc-400 sm:block">{w}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
              <span>leads-austin-dentists-outdated.csv</span>
              <span className="font-medium text-blue-600">Copy pitch · Export CSV</span>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* ============================== THE FOUR FILTERS ============================== */}
      <section className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Four filters
          </p>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            One tool, four different customers
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-500">
            The filters are the product. Each one is a different problem to sell
            against — websites for the ones without, redesigns for the ones with
            something broken, growth for everyone else.
          </p>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
            {FILTERS.map((f) => (
              <div
                key={f.name}
                className="rounded-2xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-zinc-900/5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    <Icon d={f.d} />
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${f.tone}`}>
                    {f.who}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{f.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== LIVE, NOT A DATABASE (dark) ============================== */}
      <section className="relative overflow-hidden bg-zinc-950">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 80% at 50% 0%, rgba(42,120,214,0.16) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
            Under the hood
          </p>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Live data, your keys, no lock-in
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
            Built for the person doing the finding themselves — a freelancer, a
            solo founder, an agency owner — not for a sales floor buying a
            database by the seat.
          </p>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Live per search, never stale", "Results come from the web and open map data at the moment you ask. Nothing is resold, nothing goes out of date in a warehouse."],
              ["Enforced locality", "Every business's own address is compared with the city you typed, and anything that places itself elsewhere is left out — with the count shown."],
              ["Evidence on every finding", "A claim you can repeat: the URL that 404s, the domain on the certificate, the size of the page."],
              ["Free to start", "No card, no trial clock. Two filters unlock on the free plan; the other two come with a paid tier."],
              ["No API keys, ever", "Every source works the moment you sign up — nothing to create in a cloud console, nothing to paste in, nothing that can expire."],
              ["Export and leave", "Every list comes out as CSV with stable headers. Hosted workspaces are isolated in Postgres."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="flex items-center gap-2 font-medium text-white">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                    <Icon d="M20 6L9 17l-5-5" className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{b}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-blue-500/20 bg-blue-500/[0.07] p-5 text-center">
            <p className="text-sm text-zinc-300">
              <span className="font-semibold text-white">Honest limits:</span> a
              search returns what the sources truly find, so a quiet niche in a
              small town can come back short. The app tells you which case it
              is — ran out of matches, or left businesses out because they were
              in another city.
            </p>
          </div>
        </div>
      </section>

      {/* ============================== CTA ============================== */}
      <section className="relative overflow-hidden bg-zinc-950">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 90% at 50% 100%, rgba(42,120,214,0.18) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Watch it run on your own town
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Free plan, no credit card. Type a niche and a city, read the audits,
            and judge the claims for yourself — open one of the websites in a
            browser and check.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-zinc-100 hover:shadow-xl"
            >
              Start free
            </Link>
            <Link
              href="/pricing"
              className="inline-block rounded-xl border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-200 transition-all hover:-translate-y-0.5 hover:border-zinc-500"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
