import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "../components/PublicShell";
import { SITE } from "@/lib/site";
import { PLANS, UPGRADE_BONUS_LEADS } from "@/lib/plans";

export const metadata: Metadata = {
  title: `Pricing — ${SITE.name}`,
  description: `Simple pricing for ${SITE.name}: start free, upgrade as your outreach grows.`,
};

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const { free, starter, pro } = PLANS;

const CARDS = [
  {
    plan: free,
    cta: "Create your free account",
    highlight: false,
    features: [
      `${free.leadsPerMonth} Lead Finder results / month`,
      `${free.emailsPerDay} emails / day through your own SMTP`,
      `${free.aiPerDay} included AI generations / day`,
      "Unlimited contacts & campaigns",
      "Follow-ups that stop on reply",
      "Open, click, reply & bounce tracking",
      "Simulation mode to test safely",
    ],
    footnote: "No credit card required",
  },
  {
    plan: starter,
    cta: "Get Starter",
    highlight: false,
    features: [
      `${starter.leadsPerMonth} Lead Finder results / month (≈100 a week)`,
      `+${UPGRADE_BONUS_LEADS} bonus leads in your first week`,
      `${starter.emailsPerDay} emails / day`,
      `${starter.aiPerDay} included AI generations / day`,
      "Everything in Free",
      "Email support",
    ],
    footnote: `or $${starter.priceYearlyUsd}/year — two months free`,
  },
  {
    plan: pro,
    cta: "Get Pro",
    highlight: true,
    features: [
      `${pro.leadsPerMonth!.toLocaleString("en-US")} Lead Finder results / month`,
      `+${UPGRADE_BONUS_LEADS} bonus leads in your first week`,
      `${pro.emailsPerDay} emails / day`,
      "Unlimited included AI writing",
      "Everything in Starter",
      "Priority support (same business day)",
      "Early access to new features",
    ],
    footnote: `or $${pro.priceYearlyUsd}/year — two months free`,
  },
];

const BILLING_FAQS = [
  {
    q: "How does billing work?",
    a: "Payments are processed by Paddle, our merchant of record. Paddle handles the checkout, invoices, and any applicable sales tax or VAT for your country. Cards and PayPal are supported.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel in one click and your plan stays active until the end of the period you've paid for. No cancellation fees, and your data stays intact on the free plan.",
  },
  {
    q: "Is there a refund policy?",
    a: "A 14-day money-back guarantee on your first payment — email support and it's refunded in full. See the refund policy for details.",
  },
  {
    q: "What happens when I hit a limit?",
    a: "Nothing breaks. At the daily email cap, remaining messages send tomorrow. At the AI limit, the built-in template engine takes over until the next day (or add your own Groq/Anthropic API key for unlimited AI on any plan). Lead Finder pauses until next month or an upgrade.",
  },
  {
    q: "How do I upgrade?",
    a: "Create a free account, then upgrade from the app. Your contacts, campaigns, and settings carry over untouched — a plan only changes your limits.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell
      title="Simple, honest pricing"
      subtitle="Start free with your own mailbox and included AI writing. Upgrade when your outreach scales."
      wide
    >
      <div className="grid gap-6 md:grid-cols-3">
        {CARDS.map(({ plan, cta, highlight, features, footnote }) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl p-8 ${
              highlight ? "border-2 border-zinc-900" : "border border-zinc-200"
            }`}
          >
            {highlight && (
              <span className="absolute -top-3 left-8 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                Best value
              </span>
            )}
            <h2 className="font-semibold">{plan.name}</h2>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold">${plan.priceMonthlyUsd}</span>
              <span className="text-sm text-zinc-400">
                {plan.priceMonthlyUsd === 0 ? "forever" : "/ month"}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-500">{plan.tagline}</p>
            <ul className="mt-6 space-y-2.5 text-sm text-zinc-600">
              {features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all ${
                highlight
                  ? "bg-zinc-900 text-white shadow-md hover:-translate-y-0.5 hover:bg-zinc-700 hover:shadow-lg"
                  : "border border-zinc-300 text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              {cta}
            </Link>
            <p className="mt-3 text-center text-xs text-zinc-400">{footnote}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-400">
        Paid checkout is rolling out now — create a free account and upgrade from the app.
        Early accounts lock in these prices.
      </p>

      {/* Billing FAQ */}
      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Billing questions
        </h2>
        <div className="mt-8 space-y-3">
          {BILLING_FAQS.map((f) => (
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
        <p className="mt-8 text-center text-sm text-zinc-400">
          The fine print, in plain language:{" "}
          <Link href="/terms" className="underline hover:text-zinc-600">Terms</Link> ·{" "}
          <Link href="/privacy" className="underline hover:text-zinc-600">Privacy</Link> ·{" "}
          <Link href="/refund-policy" className="underline hover:text-zinc-600">Refunds</Link>
        </p>
      </div>
    </PublicShell>
  );
}
