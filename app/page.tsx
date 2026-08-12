import Image from "next/image";
import Link from "next/link";
import { LogoTile } from "./components/Logo";
import ToolsDropdown from "./components/ToolsDropdown";
import HeroFilm from "./components/HeroFilm";
import PublicFooter from "./components/PublicFooter";

/**
 * Public marketing landing page. Signed-in visitors never see this —
 * the proxy sends them straight to /dashboard.
 */

const PRODUCT_STORIES = [
  {
    kicker: "Find qualified leads",
    title: "Start with a niche — not a spreadsheet.",
    body: "Tell Outreach Studio who you want to reach and where. It returns real businesses with contact details already attached, so you can move from an idea to a usable lead list without hours of research.",
    points: [
      "Business emails, websites, Instagram, and LinkedIn in one result",
      "Owner and decision-maker enrichment when available",
      "Import the leads you want directly into your contact pipeline",
    ],
    image: "/product-lead-finder.jpg",
    alt: "Outreach Studio Lead Finder showing dental businesses in Austin with verified contact emails and owner information",
  },
  {
    kicker: "Personalize at scale",
    title: "Every prospect gets a message written for them.",
    body: "The AI uses the business, industry, location, and company notes to write a short message in your voice. It is real context, not a mail-merge template with a first name dropped in.",
    points: [
      "A different subject and message for every contact",
      "Your offer, tone, sender identity, and sign-off stay consistent",
      "Spam-filter checks run before the campaign is scheduled",
    ],
    image: "/product-ai-writing.jpg",
    alt: "A personalized outreach email written by Outreach Studio for a dental business with contextual details highlighted",
  },
  {
    kicker: "Send and respond",
    title: "Follow up automatically. Stop the moment they reply.",
    body: "Campaigns send inside your chosen business hours at a controlled pace. Outreach Studio watches for replies, stops that contact's sequence, classifies the response, and prepares a useful next message.",
    points: [
      "Daily caps, send windows, and human-paced throttling built in",
      "Follow-ups and bounces stop automatically when they should",
      "Interested replies are surfaced with an AI-suggested response",
    ],
    image: "/product-reply-triage.jpg",
    alt: "An Outreach Studio campaign sending at a controlled pace with a stopped follow-up, interested reply, and suggested response",
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
    a: "AI writing is included free — no API key needed (up to 50 generations a day on the free plan, more on paid plans). Prefer your own model? Add a Groq or Anthropic Claude key in Settings for unlimited use with no per-message markup.",
  },
  {
    q: "Is the Instagram and LinkedIn outreach safe for my accounts?",
    a: "Yes, by design. Those platforms ban automated cold DMs, so Outreach Studio never sends them for you. It drafts a personalized message per contact and gives you copy → open profile → mark sent. Your account behaves like a human, because it is one.",
  },
  {
    q: "Who's accountable for what the AI writes?",
    a: "You are — and the product is built so you actually can be. Preview any message before a campaign exists, send a 5–10 email test batch that auto-pauses for your review, edit the brief mid-campaign, and see a full log of every message. Instagram/LinkedIn messages are never auto-sent. The AI drafts; the human decides.",
  },
  {
    q: "Is this compliant with anti-spam laws?",
    a: "The product provides compliance safeguards: every real campaign email includes the sender's postal address, a visible opt-out, and RFC 8058 one-click unsubscribe headers; opt-outs are permanent and bounced or clearly invalid addresses are excluded. You remain responsible for having a lawful basis and following the laws that apply to your recipients (CAN-SPAM, GDPR, PECR…).",
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
            <Link
              href="/demo"
              className="rounded-xl border border-zinc-200 bg-white px-7 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              ▶ See it in action
            </Link>
          </div>
          <p className="rise rise-3 mt-5 text-xs text-zinc-400">
            No credit card · Bring your own AI key · Self-hostable with one command
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
            <HeroFilm />
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 text-sm">
              <span className="text-zinc-500">
                22 seconds · no narration · the actual product
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
          See how a lead becomes a real conversation
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-500">
          Three connected stages, shown with the real product — from finding the right
          business to knowing exactly which reply needs you.
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
                  <Image
                    src={story.image}
                    alt={story.alt}
                    width={1620}
                    height={760}
                    sizes="(max-width: 1023px) 100vw, 54vw"
                    className="relative h-auto w-full rounded-[20px] border border-zinc-100"
                  />
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
                "50 Lead Finder results / month",
                "25 emails / day, your own SMTP",
                "50 AI generations / day included",
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
                "+100 bonus leads in your first week",
                "40 emails / day",
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
                "+100 bonus leads in your first week",
                "50 emails / day",
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

      <PublicFooter />
    </div>
  );
}
