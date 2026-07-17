import Link from "next/link";
import { LogoTile } from "./components/Logo";
import ToolsDropdown from "./components/ToolsDropdown";

/**
 * Public marketing landing page. Signed-in visitors never see this —
 * the proxy sends them straight to /dashboard.
 */

const TINTS = [
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-violet-50 text-violet-600",
  "bg-sky-50 text-sky-600",
  "bg-rose-50 text-rose-600",
];

const FEATURES = [
  {
    title: "Lead Finder with emails included",
    body: "Search any niche in any city. AI web search returns businesses with email addresses, phone numbers, Instagram and LinkedIn profiles already attached — plus OpenStreetMap and Google Places sources.",
    icon: "M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z",
  },
  {
    title: "AI writes every message",
    body: "No mail-merge templates. The AI writes a unique message per contact from their business name, industry, and company intel — in your voice and tone, grounded in what your company does.",
    icon: "M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
  },
  {
    title: "Follow-ups that stop on reply",
    body: "Up to three automatic follow-ups, days apart, written with the context of the earlier email. The moment someone replies, their sequence stops. Bounces stop everything.",
    icon: "M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.5-3M4 15a8 8 0 0014.5 3",
  },
  {
    title: "Reply triage with suggested answers",
    body: "Your inbox is watched for answers. Each reply is classified — interested, question, not interested, out of office — and the AI drafts a response in your voice, ready to send.",
    icon: "M8 12h8M8 8h8M8 16h4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Deliverability built in",
    body: "Daily send caps, a warm-up ramp for new domains, business-hours send windows, an SPF/DKIM/DMARC checker, and a spam-filter lint on every message before you schedule it.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  {
    title: "Numbers you can act on",
    body: "Open, click, and reply rates per campaign. A/B subject-line testing with per-arm results. A 14-day activity chart on your dashboard. Know what works, double down.",
    icon: "M3 3v18h18M7 15l4-4 3 3 5-6",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Find your leads",
    body: "Type a niche and a city — \"dentists in Austin\". Get a list with emails, socials, and company intel, or import your own CSV. One click finds the owner behind each business.",
  },
  {
    n: "2",
    title: "Describe your offer",
    body: "One paragraph about what you sell and what you want. The AI assistant sharpens it, writes a sample message, and checks it against spam filters before anything sends.",
  },
  {
    n: "3",
    title: "Send, track, reply",
    body: "Emails go out on schedule at a human pace. Instagram and LinkedIn drafts wait for one-click manual sending. Opens, clicks, and replies flow back to your dashboard.",
  },
];

const FAQS = [
  {
    q: "Do I need my own email server?",
    a: "You connect any mailbox over SMTP — Google Workspace, Zoho, cPanel mail, anything. Until you do, sends are simulated so you can test the whole pipeline safely. Reply detection works over IMAP with the same credentials.",
  },
  {
    q: "Which AI does the writing?",
    a: "AI writing is included free — no API key needed (up to 150 generations a day on the free plan). Prefer your own model? Add a Groq or Anthropic Claude key in Settings for unlimited use with no per-message markup.",
  },
  {
    q: "Is the Instagram and LinkedIn outreach safe for my accounts?",
    a: "Yes, by design. Those platforms ban automated cold DMs, so Outreach Studio never sends them for you. It drafts a personalized message per contact and gives you copy → open profile → mark sent. Your account behaves like a human, because it is one.",
  },
  {
    q: "Is this compliant with anti-spam laws?",
    a: "The tooling is built for it: every email carries a one-click unsubscribe link and List-Unsubscribe header, opt-outs are enforced forever, and bounced addresses are excluded automatically. You remain responsible for using it on appropriate business contacts under the laws that apply to you (CAN-SPAM, GDPR, PECR…).",
  },
  {
    q: "Where does my data live?",
    a: "In your own Postgres database, on infrastructure you choose — the product ships with a one-command Docker deploy including nightly backups. SMTP passwords and API keys are encrypted at rest.",
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
      {children}
    </p>
  );
}

export default function LandingPage() {
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
            Email · Instagram · LinkedIn — one pipeline
          </p>
          <h1 className="rise rise-2 mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.08]">
            Outreach that finds the leads,{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">
              writes the words
            </span>
            , and follows up
          </h1>
          <p className="rise rise-3 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-500">
            Outreach Studio discovers businesses with contact emails included, has AI
            write a genuinely personal message to each one, sends at a human pace,
            and watches your inbox for replies — so you only step in to close.
          </p>
          <div className="rise rise-3 mt-9 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-zinc-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition-all hover:-translate-y-0.5 hover:bg-zinc-700 hover:shadow-xl"
            >
              Start free — no card needed
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-zinc-200 bg-white px-7 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              See how it works
            </a>
          </div>
          <p className="rise rise-3 mt-5 text-xs text-zinc-400">
            No credit card · Bring your own AI key · Self-hostable with one command
          </p>

          {/* Product mock */}
          <div className="rise rise-4 relative mx-auto mt-16 max-w-4xl">
            {/* gradient halo behind the mock */}
            <div
              className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-60"
              style={{
                background:
                  "linear-gradient(120deg, rgba(42,120,214,0.16), rgba(124,58,237,0.12), rgba(27,175,122,0.14))",
                filter: "blur(28px)",
              }}
            />
            {/* floating badges */}
            <div className="float-soft absolute -top-5 -left-3 z-10 hidden items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium shadow-lg shadow-zinc-900/5 sm:flex">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">✓</span>
              Reply detected — <span className="text-emerald-600">interested</span>
            </div>
            <div
              className="float-soft absolute -right-4 top-24 z-10 hidden flex-col rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-left shadow-lg shadow-zinc-900/5 sm:flex"
              style={{ animationDelay: "1.4s" }}
            >
              <span className="text-[10px] uppercase tracking-wide text-zinc-400">open rate</span>
              <span className="text-lg font-semibold tabular-nums text-zinc-900">61%</span>
            </div>

            <div className="relative rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-2xl shadow-zinc-900/10">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 text-xs text-zinc-400">outreach dashboard</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Emails sent", value: "412", sub: "38 queued" },
                  { label: "Open rate", value: "61%", sub: "252 opened" },
                  { label: "Replies", value: "34", sub: "12 interested" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                    <div className="text-xs text-zinc-400">{s.label}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-5">
                <div className="rounded-xl border border-zinc-100 p-4 sm:col-span-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-500">Last 14 days</span>
                    <span className="flex items-center gap-3 text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#2a78d6]" />sent</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#1baf7a]" />opened</span>
                    </span>
                  </div>
                  <svg viewBox="0 0 300 80" className="w-full" aria-hidden>
                    <defs>
                      <linearGradient id="lgA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2a78d6" stopOpacity="0.14" />
                        <stop offset="100%" stopColor="#2a78d6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="70" x2="300" y2="70" stroke="#e4e4e7" />
                    <path
                      d="M0,62 L23,58 L46,60 L69,49 L92,52 L115,40 L138,44 L161,30 L184,34 L207,22 L230,27 L253,14 L276,18 L300,8 L300,70 L0,70 Z"
                      fill="url(#lgA)"
                    />
                    <path
                      d="M0,62 L23,58 L46,60 L69,49 L92,52 L115,40 L138,44 L161,30 L184,34 L207,22 L230,27 L253,14 L276,18 L300,8"
                      fill="none" stroke="#2a78d6" strokeWidth="2"
                    />
                    <path
                      d="M0,68 L23,66 L46,67 L69,60 L92,63 L115,54 L138,58 L161,47 L184,51 L207,41 L230,46 L253,34 L276,39 L300,28"
                      fill="none" stroke="#1baf7a" strokeWidth="2"
                    />
                    <circle cx="300" cy="8" r="3" fill="#2a78d6" stroke="#fff" strokeWidth="1.5" />
                  </svg>
                </div>
                <div className="rounded-xl border border-zinc-100 p-4 sm:col-span-2">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      interested
                    </span>
                    <span className="text-xs text-zinc-400">reply · Joe&apos;s Pizza</span>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-600">
                    “Sounds interesting — can you send pricing?”
                  </p>
                  <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50 p-2.5 text-xs leading-relaxed text-zinc-600">
                    <span className="font-medium text-violet-700">✨ Suggested reply drafted</span>
                    {" "}— happy to! The fastest way is a quick call…
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            From “who do I even contact?” to booked replies
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-500">
            Three steps. The first campaign takes about ten minutes.
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
          Everything between a niche and a signed client
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-zinc-500">
          Not another mail-merge tool — a full pipeline with intelligence at every step.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-900/5"
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${TINTS[i % TINTS.length]}`}
              >
                <Icon d={f.icon} />
              </div>
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
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
            Channels
          </p>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Three channels, one compliance-first pipeline
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
            Automate what platforms allow. Draft what they don&apos;t. Never risk your accounts.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 transition-colors hover:border-sky-500/40">
              <span className="inline-block rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-400">
                Email
              </span>
              <h3 className="mt-4 font-medium text-white">Fully automatic</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Sent on schedule through your own SMTP, throttled to a human pace, with
                open/click tracking, unsubscribe handling, and automatic follow-ups.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 transition-colors hover:border-pink-500/40">
              <span className="inline-block rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-medium text-pink-400">
                Instagram DM
              </span>
              <h3 className="mt-4 font-medium text-white">Drafted, sent by you</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Instagram bans automated cold DMs — accounts that try get banned. The AI
                drafts each DM; you copy, open the profile, paste, mark sent. Ban-safe.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 transition-colors hover:border-blue-500/40">
              <span className="inline-block rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                LinkedIn
              </span>
              <h3 className="mt-4 font-medium text-white">Drafted, sent by you</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Same protection for your professional identity. Profiles are found
                automatically — including the owner behind each business — and messages
                are written in a professional register.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple pricing
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-zinc-500">
          Start free with AI writing included. No per-message markup, ever.{" "}
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
                "150 Lead Finder results / month",
                "50 emails / day, your own SMTP",
                "150 AI generations / day included",
                "Unlimited contacts & campaigns",
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
                "400 Lead Finder results / month",
                "150 emails / day",
                "500 AI generations / day included",
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
                "2,500 Lead Finder results / month",
                "500 emails / day",
                "Unlimited AI writing included",
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
            Set up in ten minutes. Test everything in simulation mode before a single
            real email leaves your mailbox.
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

      {/* Footer */}
      <footer className="border-t border-zinc-100">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-400">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div>
              <span className="font-semibold text-zinc-600">Outreach Studio</span> · AI
              outreach automation
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <Link href="/features" className="hover:text-zinc-600">Features</Link>
              <Link href="/docs" className="hover:text-zinc-600">Docs</Link>
              <Link href="/pricing" className="hover:text-zinc-600">Pricing</Link>
              <Link href="/contact" className="hover:text-zinc-600">Contact</Link>
              <Link href="/login" className="hover:text-zinc-600">Sign in</Link>
            </div>
            <div className="max-w-xs text-center text-xs md:text-right">
              Built for legitimate business outreach. Honor opt-outs and the anti-spam
              laws that apply to you.
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-zinc-100 pt-6 text-xs md:flex-row">
            <div>© {new Date().getFullYear()} Outreach Studio</div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <Link href="/tools/spam-checker" className="hover:text-zinc-600">Free spam checker</Link>
              <Link href="/tools/dns-checker" className="hover:text-zinc-600">Free SPF/DKIM checker</Link>
              <Link href="/terms" className="hover:text-zinc-600">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-zinc-600">Privacy Policy</Link>
              <Link href="/refund-policy" className="hover:text-zinc-600">Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
