import Image from "next/image";
import Link from "next/link";
import { LogoTile } from "./components/Logo";
import ToolsDropdown from "./components/ToolsDropdown";
import HeroFilm from "./components/HeroFilm";
import PublicFooter from "./components/PublicFooter";
import { isOutreachEnabled } from "@/lib/product";

/**
 * Public marketing landing page. Signed-in visitors never see this —
 * the proxy sends them straight into the app.
 *
 * The product on sale here is lead intelligence: search, audit, filter. The
 * outreach half exists behind a flag, so the one place this page acknowledges
 * it is the hero film, which is shown only when that half is switched on.
 */

interface ProductStory {
  kicker: string;
  title: string;
  body: string;
  points: string[];
  /** Real product screenshot, when we have one that matches the story. */
  image?: string;
  alt?: string;
  /** Otherwise an in-page mock, so no story is illustrated with the wrong UI. */
  panel?: "audit" | "filters";
}

const PRODUCT_STORIES: ProductStory[] = [
  {
    kicker: "Search",
    title: "Type a niche and a city. That is the whole brief.",
    body: "Outreach Studio searches the live web and open map data for real businesses matching what you typed. Nothing is resold from a stale list, so a business that opened last month can still show up this afternoon.",
    points: [
      "Real businesses pulled live, not bought from a data vendor",
      "Website, email, phone and socials where they actually exist",
      "Decision-maker lookup when you want a name to write to",
    ],
    image: "/product-lead-finder.jpg",
    alt: "Outreach Studio Lead Finder showing dental practices in Austin, each with an audit score and the specific problem found on its website",
  },
  {
    kicker: "Audit",
    title: "Every site it finds gets checked, scored and explained.",
    body: "This is the part that makes a lead worth contacting. Each website is loaded and examined — does it load at all, is the certificate valid, does it work on a phone, are its links alive — and the results are written out as plain findings you could say to the owner.",
    points: [
      "Facts, not opinions: status codes, certificate state, timings",
      "Broken links, mixed content, dead pages — each with evidence",
      "A healthy site is never reported as broken, on purpose",
    ],
    panel: "audit",
  },
  {
    kicker: "Filter",
    title: "Then narrow to the businesses that need you.",
    body: "Four filters, each one a different problem you can solve. Show businesses with no website at all, only the sites with a real defect ranked worst first, everyone, or just the ones with a site to improve.",
    points: [
      "No website — the strongest pitch there is",
      "Outdated or broken — redesign prospects, evidence attached",
      "Export the shortlist, or save it and work through it",
    ],
    panel: "filters",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Search a niche and a place",
    body: "\"Dentists in Austin.\" Choose who you want — any business, only those with a site, only the broken ones, or the ones with none at all.",
  },
  {
    n: "2",
    title: "Read the audit",
    body: "Every result arrives with a score out of 100 and the specific things wrong with its website, so you already know your opening line before you decide to contact anyone.",
  },
  {
    n: "3",
    title: "Take the shortlist",
    body: "Sort by worst site or easiest to reach, export to CSV with the audit attached, or save the leads and look up the owner behind each one.",
  },
];

const FAQS = [
  {
    q: "Where do the leads actually come from?",
    a: "Live sources, not a database we bought. Depending on the filter, a search reads open map data (OpenStreetMap), the official UK company register, and the open web. That is why a brand-new business can appear, and why the count for a given area varies a little from day to day.",
  },
  {
    q: "What does the audit check, exactly?",
    a: "Two layers. Transport facts measured over the network — does the page load, is the TLS certificate valid, how slow, how heavy. And content read from the real markup — no mobile layout, mixed insecure content, free-builder hosting, broken homepage links, stale copyright, placeholder text, a missing contact route. Each finding is a measured fact, not a guess.",
  },
  {
    q: "What if your audit is wrong about a healthy site?",
    a: "That failure mode is designed against, because accusing a working business of being broken costs you the deal. Sites that refuse automated checks, time out, or render client-side are marked unverified rather than broken, and soft gaps like a missing meta description are recorded but never used to call a site a prospect.",
  },
  {
    q: "Why are two of the filters paid?",
    a: "Because they cost real work per lead. \"Outdated or broken site\" re-checks each site's links to prove a defect, and \"No website\" spends a separate web lookup on every business to find a phone, Instagram or an email. The free tier runs the cheap searches; the paid tiers pay for the expensive ones.",
  },
  {
    q: "How do I keep finding new businesses without searching every week?",
    a: "Save the search. \"New businesses\" watches a niche and a place and asks the official UK company register what has been incorporated since you last looked — so the list fills itself with businesses that registered days ago, with their directors named. It shows up in the app, and one weekly email per account when this deployment has email turned on. Starter and up, UK-only, because the register is the only source that publishes a date you can rely on.",
  },
  {
    q: "Do I need any technical setup?",
    a: "None. Create an account, type a niche and a city, and you have audited businesses. There is no API key to create and nothing to connect — every source works out of the box.",
  },
  {
    q: "Where does my data live?",
    a: "Hosted accounts are isolated in our Postgres database and protected by encrypted credentials and nightly backups. If you choose the self-hosted edition, the same product can run on infrastructure and a Postgres database you control.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
      {children}
    </p>
  );
}

/** Browser-framed shot of the real screen, for a lead-only deployment. */
function LeadFinderShot() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10">
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" aria-hidden />
        <span className="ml-3 truncate text-xs text-zinc-400">
          Find leads — dentist · Austin, USA · outdated or broken site
        </span>
      </div>
      <Image
        src="/product-lead-finder.jpg"
        alt="Outreach Studio Lead Finder showing Austin dental practices with an audit score and the specific website problem behind each lead"
        width={1620}
        height={760}
        sizes="(max-width: 1023px) 100vw, 900px"
        priority
        className="h-auto w-full"
      />
    </div>
  );
}

/**
 * An in-page mock of the audit report. The numbers and wording are the real
 * ones this engine produces, so the illustration cannot drift from the product.
 */
function AuditPanel() {
  const findings = [
    ["the security certificate is invalid", "browsers warn 'your connection is not private'"],
    ["3 broken links on the homepage", "/prices, /book-online, /team-old"],
    ["not mobile-friendly", "no responsive viewport tag, so phones show a shrunken desktop"],
  ];
  return (
    <div className="rounded-[20px] border border-zinc-100 bg-white p-5 text-left">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Tarrytown Dental</div>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
          55/100 · poor
        </span>
      </div>
      <div className="mt-1 text-xs text-zinc-400">tarrytowndental.com · Austin, United States</div>
      <ul className="mt-4 space-y-2.5">
        {findings.map(([label, detail]) => (
          <li key={label} className="text-xs leading-5">
            <span className="font-medium text-orange-700">• {label}</span>
            <div className="text-zinc-400">{detail}</div>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
        HTTP 200 · 1.4s · 240 KB — measured, not inferred
      </div>
    </div>
  );
}

/** The four filters, with the tier each one belongs to. */
function FilterPanel() {
  const filters = [
    ["No website", "Sell them their first site", "Pro"],
    ["Outdated or broken site", "Redesign prospects, evidence attached", "Starter"],
    ["Has a website", "Website owners — the audit shows the gaps", "Free"],
    ["Any business", "Everything found, each one audited", "Free"],
  ];
  return (
    <div className="grid gap-2.5 text-left">
      {filters.map(([title, desc, plan]) => (
        <div
          key={title}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{title}</span>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
              {plan}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">{desc}</div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const outreachEnabled = isOutreachEnabled();
  return (
    <div className="bg-white text-zinc-900 antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoTile className="h-7 w-7" />
            Outreach<span className="text-zinc-400">Studio</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-zinc-500 md:flex">
            <Link href="/features" className="hover:text-zinc-900">Features</Link>
            <a href="#how" className="hover:text-zinc-900">How it works</a>
            <ToolsDropdown />
            <a href="#pricing" className="hover:text-zinc-900">Pricing</a>
            <a href="#faq" className="hover:text-zinc-900">FAQ</a>
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
        {/* layered background: soft grid + two glows */}
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
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(42,120,214,0.14) 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute top-24 right-[8%] h-[300px] w-[300px]"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(124,58,237,0.10) 0%, rgba(255,255,255,0) 100%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <p className="rise rise-1 mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Find a business · see what&apos;s wrong · know your opening line
          </p>
          <h1 className="rise rise-2 mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.08]">
            Find the businesses that{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">
              need you
            </span>
            , with the proof
          </h1>
          <p className="rise rise-3 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-500">
            Type a niche and a city. Outreach Studio pulls real businesses live from the
            web and audits every website it finds — a score, precisely what is wrong, and
            the words to open with — so you never have to guess who to approach or why.
          </p>
          <div className="rise rise-3 mt-9 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-zinc-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition-all hover:-translate-y-0.5 hover:bg-zinc-700 hover:shadow-xl"
            >
              Start free — no card needed
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border border-zinc-200 bg-white px-7 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              ▶ See it in action
            </Link>
          </div>
          <p className="rise rise-3 mt-5 text-xs text-zinc-400">
            No credit card · Live sources, no data vendor · Self-hostable with one command
          </p>

          {/* Launch film — the real product, 22s, silent-legible */}
          <div className="rise rise-4 relative mx-auto mt-16 max-w-5xl">
            {/* gradient halo behind the film */}
            <div
              className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-60"
              style={{
                background:
                  "linear-gradient(120deg, rgba(42,120,214,0.16), rgba(124,58,237,0.12), rgba(27,175,122,0.14))",
                filter: "blur(28px)",
              }}
            />
            {/* The film demonstrates the outreach half, so it only appears on
                deployments that have that half switched on. */}
            {outreachEnabled ? <HeroFilm /> : <LeadFinderShot />}
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 text-sm">
              <span className="text-zinc-500">
                {outreachEnabled
                  ? "22 seconds · no narration · the actual product"
                  : "The real screen — a live search, every site audited"}
              </span>
              <span className="hidden h-4 w-px bg-zinc-200 sm:block" />
              <Link
                href="/features"
                className="font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                Explore the guided product tour →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            From “who should I even approach?” to a shortlist you can prove
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-500">
            Three steps. The first search takes about a minute.
          </p>
          <div className="relative mt-12 grid gap-6 md:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-10 hidden border-t-2 border-dashed border-zinc-200 md:block" />
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-zinc-900/5"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 text-sm font-semibold text-white ring-4 ring-zinc-50">
                  {s.n}
                </div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>Features</Eyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Search, audit, filter — and a reason to reach out
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-500">
          The list is the easy part. What you get here is the evidence: what is actually
          wrong with each website, written the way you would say it out loud.
        </p>
        <div className="mt-16 space-y-20 lg:space-y-28">
          {PRODUCT_STORIES.map((story, index) => (
            <article
              key={story.title}
              className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16"
            >
              <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
                <div className="relative overflow-hidden rounded-[26px] border border-zinc-200 bg-zinc-50 p-2 shadow-2xl shadow-zinc-900/10">
                  <div
                    className="pointer-events-none absolute inset-x-12 -bottom-10 h-28 rounded-full bg-blue-500/10 blur-3xl"
                    aria-hidden
                  />
                  {story.image ? (
                    <Image
                      src={story.image}
                      alt={story.alt ?? ""}
                      width={1620}
                      height={760}
                      sizes="(max-width: 1023px) 100vw, 54vw"
                      className="relative h-auto w-full rounded-[20px] border border-zinc-100"
                    />
                  ) : story.panel === "audit" ? (
                    <AuditPanel />
                  ) : (
                    <FilterPanel />
                  )}
                </div>
              </div>

              <div className={index % 2 === 1 ? "lg:order-1" : undefined}>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                    {story.kicker}
                  </p>
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {story.title}
                </h3>
                <p className="mt-4 leading-relaxed text-zinc-500">{story.body}</p>
                <ul className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-600">
                  {story.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span
                        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700"
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
          >
            Take the full product tour
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Channels */}
      <section id="channels" className="relative border-t border-zinc-100 bg-zinc-950 text-zinc-300">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{
            background:
              "radial-gradient(55% 100% at 50% 0%, rgba(42,120,214,0.12) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
            The filters
          </p>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Four filters, four different problems to solve
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
            This is the choice that matters: not who exists, but whose business you can
            genuinely help. Two are free — the other two are what the paid tiers pay for.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 transition-colors hover:border-emerald-500/40">
              <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                No website
              </span>
              <h3 className="mt-4 font-medium text-white">The strongest pitch there is</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Businesses with nothing online at all, found in open map data, then
                researched individually for a phone number, Instagram or email so the
                lead is actually reachable.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 transition-colors hover:border-orange-500/40">
              <span className="inline-block rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-medium text-orange-400">
                Outdated or broken
              </span>
              <h3 className="mt-4 font-medium text-white">Evidence, ranked worst first</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Only sites with at least one real, checkable defect — an invalid
                certificate, broken links, no mobile layout — so you open with a specific
                observation instead of a generic compliment.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 transition-colors hover:border-sky-500/40">
              <span className="inline-block rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-400">
                Has a website
              </span>
              <h3 className="mt-4 font-medium text-white">Improvements, not rebuilds</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Healthy businesses whose sites still have gaps — the audit shows what is
                missing, and lets you say plainly when a site needs nothing at all.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Priced on audited leads
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-zinc-500">
          One meter: leads. The paid tiers buy volume and the two filters that cost real
          work to run.{" "}
          <Link href="/pricing" className="text-blue-600 underline hover:text-blue-700">
            Full pricing details →
          </Link>
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            {
              name: "Free",
              price: "$0",
              period: "forever",
              badge: null,
              points: [
                "50 audited leads / month",
                "Any business · has a website",
                "Score and findings on every lead",
                "CSV export & decision-maker lookup",
              ],
              cta: "Create your account",
              href: "/signup",
              primary: false,
            },
            {
              name: "Starter",
              price: "$9",
              period: "/ month",
              badge: null,
              points: [
                "400 audited leads / month",
                "+100 bonus leads in your first week",
                "Unlocks “outdated or broken site”",
                "Email support",
              ],
              cta: "Get Starter",
              href: "/pricing",
              primary: false,
            },
            {
              name: "Pro",
              price: "$29",
              period: "/ month",
              badge: "Best value",
              points: [
                "2,500 audited leads / month",
                "+100 bonus leads in your first week",
                "Unlocks the “no website” hunt",
                "Priority support & early access",
              ],
              cta: "Get Pro",
              href: "/pricing",
              primary: true,
            },
          ].map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl bg-white p-8 ${
                p.primary
                  ? "border-2 border-zinc-900 shadow-xl shadow-zinc-900/10"
                  : "border border-zinc-200"
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-6 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
                  {p.badge}
                </span>
              )}
              <h3 className="font-semibold">{p.name}</h3>
              <div className="mt-4 text-4xl font-semibold">
                {p.price}
                <span className="text-base font-normal text-zinc-400"> {p.period}</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-zinc-600">
                {p.points.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-emerald-600">✓</span> {x}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all ${
                  p.primary
                    ? "bg-zinc-900 text-white shadow-md hover:-translate-y-0.5 hover:bg-zinc-700 hover:shadow-lg"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-zinc-200 bg-white p-5 transition-shadow open:shadow-md open:shadow-zinc-900/5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <span className="ml-4 text-zinc-400 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
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
            Your next client hasn&apos;t heard from you yet
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Type a niche and a city, and you are reading audits in about a minute. No data
            to buy, nothing to configure, and the first fifty leads are free.
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-block rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-zinc-100 hover:shadow-xl"
          >
            Get started free
          </Link>
          <p className="mt-4 text-xs text-zinc-500">No credit card required</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
