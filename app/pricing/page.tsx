import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "../components/PublicShell";
import { SITE } from "@/lib/site";
import { PLANS, UPGRADE_BONUS_LEADS, FILTER_ORDER, FILTER_LABELS } from "@/lib/plans";

export const metadata: Metadata = {
  title: `Pricing — ${SITE.name}`,
  description: `Priced on audited leads per month. See which business filters each plan unlocks — start free, no card.`,
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

/**
 * The filter list is the pricing table: the same four filters on every card,
 * ticked where the plan unlocks them. That way the ladder is legible at a
 * glance instead of hidden inside feature bullets.
 */
const FILTER_ROWS = FILTER_ORDER.map((id) => ({ id, label: FILTER_LABELS[id] }));

const CARDS = [
  {
    plan: free,
    cta: "Create your free account",
    highlight: false,
    features: [
      `${free.leadsPerMonth} audited leads / month`,
      "Score, findings and the reason to reach out on every lead",
      "Decision-maker lookup included in your lead allowance",
      "Export to CSV, or save leads to work through",
    ],
    footnote: "No credit card required",
  },
  {
    plan: starter,
    cta: "Get Starter",
    highlight: false,
    features: [
      `${starter.leadsPerMonth} audited leads / month (≈100 a week)`,
      `+${UPGRADE_BONUS_LEADS} bonus leads in your first week`,
      "Everything in Free",
      "New businesses: watch a niche and a place, and see what registered since you last looked",
      "Practical for a full week of prospecting, not a taster",
      "Email support",
    ],
    footnote: `or $${starter.priceYearlyUsd}/year — two months free`,
  },
  {
    plan: pro,
    cta: "Get Pro",
    highlight: true,
    features: [
      `${pro.leadsPerMonth!.toLocaleString("en-US")} audited leads / month`,
      `+${UPGRADE_BONUS_LEADS} bonus leads in your first week`,
      "Everything in Starter",
      "The no-website hunt, which costs us a lookup per business",
      "Newly incorporated businesses with their directors named — the ones with no incumbent yet",
      "Priority support (same business day)",
      "Early access to new features",
    ],
    footnote: `or $${pro.priceYearlyUsd}/year — two months free`,
  },
];

const BILLING_FAQS = [
  {
    q: "How does billing work?",
    a: "Paid plans are currently activated personally by our team after payment. Email support from inside the app and we will confirm the available payment method, invoice, plan, and renewal terms before you pay. Self-serve checkout is not live yet.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Email support before your next paid period. Your plan stays active until the end of the period you've paid for, with no cancellation fee, and your data stays intact when the account returns to the free plan.",
  },
  {
    q: "Is there a refund policy?",
    a: "A 14-day money-back guarantee on your first payment — email support and it's refunded in full. See the refund policy for details.",
  },
  {
    q: "What happens when I hit my lead limit?",
    a: "Search stops and tells you plainly — nothing is deleted, and no lead you already saved is affected. The counter resets on the 1st, or upgrade for more right away.",
  },
  {
    q: "What counts as a lead?",
    a: "Every audited business the search hands you, plus each decision-maker lookup you run. Leads already in your list are hidden from later searches and don't count twice.",
  },
  {
    q: "What are \"new businesses\", and how new are they?",
    a: "Companies registered in the last few days. Save up to 10 searches and we ask the official UK company register what has been incorporated since your last check, so you see businesses before they have a website, a Google listing or anyone working with them. It is a list you open rather than a stream: nothing is emailed on a deployment without a mailer configured, and the register only covers the UK.",
  },
  {
    q: "Why are the filters split across plans?",
    a: "The two you get free are cheap to run. “Outdated or broken site” re-crawls each site's links to prove what's broken, and “No website” spends a separate web lookup on every business to find a phone, Instagram or email. That work is what the paid tiers pay for.",
  },
  {
    q: "How do I upgrade?",
    a: "Create a free account, then upgrade from inside the app. Your saved leads and settings carry over untouched — a plan only changes your allowance and which filters unlock.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell
      title="Priced on leads you can actually work"
      subtitle="Every plan includes the audit: a score, what's wrong with the site, and the words to open with. The paid tiers buy volume and sharper filters."
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

            {/* What you can search for — the part people actually choose on. */}
            <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Who you can search for
            </div>
            <ul className="mt-2.5 space-y-2 border-b border-zinc-100 pb-4 text-sm">
              {FILTER_ROWS.map((f) => {
                const on = plan.filters.includes(f.id);
                return (
                  <li
                    key={f.id}
                    className={`flex gap-2.5 ${on ? "text-zinc-700" : "text-zinc-400"}`}
                  >
                    {on ? (
                      <Check />
                    ) : (
                      <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-zinc-300" aria-hidden>
                        —
                      </span>
                    )}
                    {f.label}
                  </li>
                );
              })}
            </ul>

            <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
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
        Paid plans are activated personally while self-serve checkout is being prepared.
        Create a free account and request an upgrade from the app; every price and payment
        method is confirmed before you pay.
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
