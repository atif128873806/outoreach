import type { Metadata } from "next";
import Link from "next/link";
import { LogoTile } from "../components/Logo";
import PublicFooter from "../components/PublicFooter";
import ToolsDropdown from "../components/ToolsDropdown";

export const metadata: Metadata = {
  title: "Features — Outreach Studio",
  description:
    "A guided tour of the whole pipeline: find leads with emails included, let AI write every message, send at a human pace, triage replies, and learn from real numbers.",
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

const PIPELINE = [
  { label: "Find", d: "M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" },
  { label: "Write", d: "M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" },
  { label: "Send", d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" },
  { label: "Listen", d: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v7H2v-7l3.5-7z" },
  { label: "Learn", d: "M3 3v18h18M7 15l4-4 3 3 5-6" },
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

      {/* Hero: the pipeline */}
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
            One pipeline that turns a niche into{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">
              booked replies
            </span>
          </h1>
          <p className="rise rise-3 mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-zinc-500">
            Five stages, each one automated until the moment a human should take
            over. This page walks the machine end to end — exactly what you see
            after you sign up.
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
              {PIPELINE.map((s, i) => (
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
              ["3", "lead sources"],
              ["50/day", "free AI writing"],
              ["3", "channels, one pipeline"],
              ["$0", "per-message markup"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-zinc-200 bg-white/80 px-4 py-3">
                <div className="text-xl font-semibold tracking-tight">{v}</div>
                <div className="mt-0.5 text-xs text-zinc-400">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== STAGE 1 — FIND ============================== */}
      <section id="tour" className="mx-auto max-w-6xl px-6 py-20 scroll-mt-20">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <StageCopy
            n="1"
            kicker="Find"
            title="Type a niche. Get businesses with the email already attached."
            points={[
              "Three sources: AI web search, OpenStreetMap (free), Google Places",
              "Websites visited automatically to extract emails, Instagram, LinkedIn",
              "Company intel (what they do, size) saved into notes for the AI to use",
              "One click finds the owner or founder behind each business",
              "Or import your own CSV — headers are detected automatically",
            ]}
          >
            No scraping tools, no browser extensions, no copy-pasting from Maps.
            Search &quot;dentists in Austin&quot; and the Lead Finder returns real
            businesses with contact details already extracted — then digs up the
            decision-maker behind each one.
          </StageCopy>

          <BrowserFrame url="outreach.sakodev.com/leads">
            {/* search bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
                <Icon d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" className="h-4 w-4 shrink-0 text-zinc-400" />
                dentists · Austin, TX
              </span>
              <span className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white">
                Find leads
              </span>
            </div>
            {/* results */}
            <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-100">
              {[
                ["Bright Smile Dental", "info@brightsmile.com", "@brightsmileatx", true],
                ["Lakeway Family Dentistry", "hello@lakewaydds.com", "@lakewaydds", false],
                ["Austin Ortho Group", "contact@atxortho.com", null, true],
              ].map(([name, email, ig, owner]) => (
                <div key={name as string} className="flex items-start gap-3 px-3.5 py-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-500">
                    {(name as string).slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs text-zinc-400">Dentist · Austin</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        ✉ {email}
                      </span>
                      {ig ? (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          {ig}
                        </span>
                      ) : null}
                      {owner ? (
                        <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500">
                          ★ owner found
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
              <span>18 found · 14 with email · 11 with Instagram</span>
              <span className="font-medium text-blue-600">Import all → Contacts</span>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* ============================== STAGE 2 — WRITE ============================== */}
      <section className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="lg:order-2">
              <StageCopy
                n="2"
                kicker="Write"
                title="AI writes a different message for every single contact."
                points={[
                  "Personalized from business name, industry, notes, and company intel",
                  "Your voice: sender identity, tone, and sign-off from Settings",
                  "A/B subject-line testing — two strategies, tracked per arm",
                  "Spam-filter lint on every preview before anything sends",
                  "No AI key? A rotating template engine takes over — no two emails alike",
                ]}
              >
                This is not mail-merge. There are no <code className="rounded bg-zinc-100 px-1 text-[13px]">{"{{first_name}}"}</code>{" "}
                brackets to fill. The AI reads what each business actually does and
                writes a short, honest email in your voice — under 150 words, one
                clear ask.
              </StageCopy>
            </div>

            <div className="lg:order-1">
              <BrowserFrame url="outreach.sakodev.com/campaigns/new — preview">
                {/* A/B subject chips */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-zinc-400">Subject</span>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                    A · Fewer no-shows for Bright Smile
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                    B · Is your front desk drowning in reminders?
                  </span>
                </div>
                {/* email body with highlighted personalization */}
                <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4 text-sm leading-relaxed text-zinc-600">
                  <p>Hi Bright Smile team,</p>
                  <p className="mt-3">
                    Most{" "}
                    <span className="rounded bg-blue-100/70 px-1 text-blue-900">
                      dental practices in Austin
                    </span>{" "}
                    we talk to lose 4–6 appointments a week to no-shows.{" "}
                    <span className="rounded bg-blue-100/70 px-1 text-blue-900">
                      Since you handle family and cosmetic work
                    </span>
                    , every empty chair is expensive.
                  </p>
                  <p className="mt-3">
                    We build automated reminder flows that fill those gaps. Worth a
                    15-minute look this week?
                    <span className="caret-blink ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-blue-600" aria-hidden />
                  </p>
                  <p className="mt-3 text-zinc-500">— Atif, SakoDev</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                    ✓ 0 spam-filter flags
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-500">
                    Written by AI · 96 words
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-500">
                    Tone: professional
                  </span>
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== STAGE 3 — SEND ============================== */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <StageCopy
            n="3"
            kicker="Send"
            title="Delivered at a human pace, inside business hours."
            points={[
              "Throttled sending — you set messages per hour, it never bursts",
              "Send windows respect the recipient's working day (your timezone)",
              "Warm-up ramp for new domains: 10 → 25 → 40 → full cap over weeks",
              "Up to 3 follow-ups, days apart — written with the earlier email in context",
              "A reply stops that contact's sequence instantly. A bounce stops everything.",
            ]}
          >
            Blasting 500 emails at 9:00 sharp is how domains die. Outreach Studio
            drips messages out like a person would, pauses outside your send
            window, and ramps volume slowly while your domain builds reputation.
          </StageCopy>

          <BrowserFrame url="outreach.sakodev.com/campaigns/12">
            {/* campaign progress */}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Austin dentists — March push</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                ● running
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full w-[62%] rounded-full bg-blue-600" />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
              <span>112 of 180 sent</span>
              <span>12 / hour</span>
            </div>

            {/* send window */}
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-500">Send window</span>
                <span>09:00 – 17:00 · America/Chicago</span>
              </div>
              <div className="relative h-6 overflow-hidden rounded-lg bg-zinc-100">
                <div className="absolute inset-y-0 left-[37.5%] w-[33.3%] rounded-md bg-blue-200/70" />
                <div className="absolute inset-y-0 left-[52%] w-[2px] bg-blue-600" />
                {["0h", "6h", "12h", "18h", "24h"].map((t, i) => (
                  <span
                    key={t}
                    className="absolute top-1 text-[9px] text-zinc-400"
                    style={{ left: `${i * 24 + 1}%` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* warm-up ramp: single-hue magnitude bars, direct-labeled */}
            <div className="mt-5">
              <div className="mb-1.5 text-[11px] font-medium text-zinc-500">
                Warm-up ramp <span className="font-normal text-zinc-400">— daily cap by week</span>
              </div>
              <div className="flex items-end gap-2">
                {[
                  ["W1", 10, 20],
                  ["W2", 25, 44],
                  ["W3", 40, 66],
                  ["W4+", 50, 80],
                ].map(([w, cap, h]) => (
                  <div key={w as string} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-medium text-zinc-500">{cap}</span>
                    <div
                      className="w-full rounded-t bg-blue-600/80"
                      style={{ height: `${h}px` }}
                    />
                    <span className="text-[10px] text-zinc-400">{w}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* follow-up queue */}
            <div className="mt-5 space-y-1.5 text-xs">
              {[
                ["Follow-up 1 · Lakeway Family Dentistry", "due in 3 days", false],
                ["Follow-up 2 · Austin Ortho Group", "stopped — replied ✓", true],
              ].map(([t, s, stopped]) => (
                <div
                  key={t as string}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2"
                >
                  <span className="text-zinc-600">{t}</span>
                  <span className={stopped ? "font-medium text-emerald-600" : "text-zinc-400"}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* ============================== STAGE 4 — LISTEN ============================== */}
      <section className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="lg:order-2">
              <StageCopy
                n="4"
                kicker="Listen"
                title="Your inbox is watched, classified, and pre-answered."
                points={[
                  "IMAP polling every 2 minutes — works with any mailbox",
                  "Every reply classified: interested, question, not interested, out of office",
                  "AI drafts a response in your voice, ready to copy or open in your mail app",
                  "Bounces auto-mark the contact and protect your sender reputation",
                  "A “no” is respected: not-interested contacts never get a follow-up",
                ]}
              >
                The half of outreach most tools ignore. When answers land, Outreach
                Studio reads them, sorts the yes from the no, and drafts your reply
                — so the hot lead gets an answer in minutes, not Monday.
              </StageCopy>
            </div>

            <div className="lg:order-1">
              <BrowserFrame url="outreach.sakodev.com/messages — replies">
                <div className="space-y-2.5">
                  {/* interested reply, expanded with suggested answer */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> interested
                      </span>
                      <span className="font-medium text-zinc-700">Bright Smile Dental</span>
                      <span className="text-zinc-400">· 4 min ago</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      &quot;This is actually something we&apos;ve been meaning to fix.
                      Do you have time Thursday?&quot;
                    </p>
                    <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-zinc-500">✨ Suggested reply</span>
                        <span className="rounded bg-zinc-900 px-2 py-0.5 font-medium text-white">Copy</span>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-500">
                        Thursday works great — does 10:30 suit you? I&apos;ll bring a
                        two-minute walkthrough of the reminder flow we&apos;d set up
                        for Bright Smile…
                      </p>
                    </div>
                  </div>
                  {/* question */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> question
                    </span>
                    <span className="font-medium text-zinc-700">Lakeway Family Dentistry</span>
                    <span className="truncate text-zinc-400">&quot;What does this cost roughly?&quot;</span>
                  </div>
                  {/* out of office */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> out of office
                    </span>
                    <span className="font-medium text-zinc-700">Austin Ortho Group</span>
                    <span className="text-zinc-400">follow-up paused automatically</span>
                  </div>
                  {/* bounce note */}
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-3.5 py-2.5 text-[11px] text-zinc-400">
                    <Icon d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" className="h-3.5 w-3.5 text-amber-500" />
                    1 bounce detected → contact excluded from all future sends
                  </div>
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== STAGE 5 — LEARN ============================== */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <StageCopy
            n="5"
            kicker="Learn"
            title="Numbers you can act on, not vanity dashboards."
            points={[
              "Open, click, and reply rates per campaign and per message",
              "A/B subject results by arm — see which strategy actually opens",
              "14-day activity chart on the dashboard: sent, opened, replied",
              "Full per-message log with every follow-up step and its status",
            ]}
          >
            Every email carries a tracking pixel and wrapped links, so the numbers
            are real behavior — not guesses. When arm B beats arm A, you know
            which subject style your market answers, and the next campaign starts
            smarter.
          </StageCopy>

          <BrowserFrame url="outreach.sakodev.com/campaigns/12 — results">
            {/* stat tiles */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                ["Sent", "412"],
                ["Opened", "51%"],
                ["Clicked", "9%"],
                ["Replied", "6.3%"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-zinc-100 bg-white px-3 py-3">
                  <div className="text-[11px] text-zinc-400">{l}</div>
                  <div className="mt-0.5 text-xl font-semibold tracking-tight">{v}</div>
                </div>
              ))}
            </div>

            {/* A/B arms — categorical pair (blue vs amber), direct-labeled */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-500">A/B subject test — open rate</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  Arm A leading
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="w-24 shrink-0 text-zinc-500">A · benefit</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full w-[58%] rounded-full bg-blue-600" />
                  </div>
                  <span className="w-9 text-right font-medium text-zinc-700">58%</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="w-24 shrink-0 text-zinc-500">B · question</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full w-[44%] rounded-full bg-amber-600" />
                  </div>
                  <span className="w-9 text-right font-medium text-zinc-700">44%</span>
                </div>
              </div>
            </div>

            {/* 14-day sparkline: single-hue line */}
            <div className="mt-5">
              <div className="mb-1.5 text-[11px] font-medium text-zinc-500">
                Last 14 days <span className="font-normal text-zinc-400">— replies</span>
              </div>
              <svg viewBox="0 0 280 56" className="h-14 w-full" aria-hidden>
                <defs>
                  <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,46 L20,44 L40,45 L60,38 L80,40 L100,30 L120,33 L140,24 L160,27 L180,18 L200,22 L220,13 L240,16 L260,8 L280,10 L280,56 L0,56 Z"
                  fill="url(#spark)"
                />
                <path
                  d="M0,46 L20,44 L40,45 L60,38 L80,40 L100,30 L120,33 L140,24 L160,27 L180,18 L200,22 L220,13 L240,16 L260,8 L280,10"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* ============================== CHANNELS ============================== */}
      <section className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Three channels
          </p>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Automated where it&apos;s safe. Drafted where it isn&apos;t.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-500">
            Instagram and LinkedIn ban automated cold DMs — tools that fake it get
            accounts banned. Outreach Studio drafts every DM and gives you
            copy → open profile → mark sent. Your account behaves like a human,
            because it is one.
          </p>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {[
              {
                name: "Email",
                mode: "Fully automated",
                tone: "bg-emerald-100 text-emerald-700",
                body: "Sent on schedule via your own SMTP. Follow-ups, tracking, unsubscribe handling — all hands-off.",
                d: "M4 4h16v16H4zM4 7l8 6 8-6",
              },
              {
                name: "Instagram DM",
                mode: "Drafted · ban-safe",
                tone: "bg-violet-100 text-violet-700",
                body: "AI writes a short, casual DM per contact (≤60 words). One-click copy, open profile, mark sent.",
                d: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM16 11.4a4 4 0 11-4.4-4.4M17.5 6.5h.01",
              },
              {
                name: "LinkedIn",
                mode: "Drafted · ban-safe",
                tone: "bg-blue-100 text-blue-700",
                body: "Professional register, ≤90 words. Profiles found automatically by the Lead Finder and owner search.",
                d: "M4 4h16v16H4zM8 10v6M8 7v.01M12 16v-4a2 2 0 014 0v4",
              },
            ].map((c) => (
              <div
                key={c.name}
                className="rounded-2xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-zinc-900/5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    <Icon d={c.d} />
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.tone}`}>
                    {c.mode}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{c.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== HUMAN IN CONTROL ============================== */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
          Accountability
        </p>
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          The AI writes. You stay in control.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-500">
          &quot;Who&apos;s responsible for AI-written outreach?&quot; — you are. That&apos;s why
          every send path has a human checkpoint built in, not bolted on.
        </p>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Preview before anything sends", "Generate a real sample for a real contact, spam-checked, before a campaign exists."],
            ["Test batches", "Send just the first 5–10, auto-pause, review the results — then release the rest."],
            ["Edit mid-campaign", "Messages are written at send time, so brief and tone edits apply to everything not yet sent."],
            ["DMs are never auto-sent", "Instagram and LinkedIn messages are drafts you send by hand — the platforms ban bots, so we never fake one."],
            ["Full transparency", "Every message is logged; if the template engine ever writes instead of the AI, the campaign says so."],
            ["Opt-outs are forever", "One-click unsubscribe on every email, enforced permanently and automatically."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <Icon d="M9 12l2 2 4-4M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" className="h-3.5 w-3.5" />
                </span>
                {t}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================== DELIVERABILITY (dark) ============================== */}
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
            Deliverability
          </p>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Engineered to land in the inbox
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
            A perfect email that lands in spam is worth nothing. Half of this
            product exists to protect your sender reputation.
          </p>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["SPF / DKIM / DMARC checker", "One click verifies the three DNS records that decide inbox vs. spam — with fix-it advice."],
              ["Warm-up ramp", "New domains start at 10/day and climb over four weeks, the way mailbox providers expect."],
              ["Caps & send windows", "A hard daily cap and business-hours windows keep volume looking human."],
              ["Spam-filter lint", "Every preview is checked for trigger phrases, ALL CAPS, punctuation abuse, and link count."],
              ["Opt-outs enforced forever", "Every email carries one-click unsubscribe + List-Unsubscribe header. A no is permanent."],
              ["Bounce auto-suppression", "Hard bounces mark the contact instantly so you never burn the same bad address twice."],
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
              <span className="font-semibold text-white">Simulation mode:</span>{" "}
              until you connect SMTP, the entire pipeline runs with sends only
              logged — so you can test campaigns end to end before a single real
              email leaves your mailbox.
            </p>
          </div>
        </div>
      </section>

      {/* ============================== UNDER THE HOOD ============================== */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
          Under the hood
        </p>
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Your accounts. Your data. Your keys.
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-x-10 gap-y-6 sm:grid-cols-2">
          {[
            ["Sends from your own mailbox", "Any SMTP works — Google Workspace, Zoho, cPanel. Replies land in your real inbox."],
            ["Credentials encrypted at rest", "SMTP passwords and API keys are AES-256-GCM encrypted and never sent back to the browser."],
            ["AI included, or bring your own", "Free AI writing is built in. Add your own Groq or Anthropic key any time for unlimited use — no per-message markup."],
            ["No lock-in", "Export leads as CSV. Hosted workspaces are isolated in Postgres; the self-hosted edition can run on infrastructure you control."],
          ].map(([t, b]) => (
            <div key={t} className="flex gap-3">
              <Tick />
              <div>
                <div className="text-sm font-semibold">{t}</div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">{b}</p>
              </div>
            </div>
          ))}
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
            Watch it run on your own leads
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Free plan, no credit card. Find 10 leads, preview the AI&apos;s first
            email, and judge for yourself — in simulation mode nothing sends until
            you say so.
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
