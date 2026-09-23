import type { Metadata } from "next";
import Link from "next/link";
import { isOutreachEnabled } from "@/lib/product";
import PublicShell from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Guides — finding local businesses and the emails behind them",
  description:
    "Practical, battle-tested guides: find local business email addresses for any niche and city, check what is wrong with a business's website, and reach the right person.",
};

/** Outreach-only: the title and blurb are static, so the whole entry is gated. */
const OUTREACH_GUIDE = "cold-email-deliverability";

const GUIDES = [
  {
    href: "/guides/cold-email-deliverability",
    tag: "Deliverability",
    title: "Cold email deliverability in 2026: the complete setup",
    blurb:
      "SPF, DKIM, DMARC, warm-up ramps, and volume rules — everything that decides inbox vs. spam, from someone who debugged it the hard way.",
    time: "12 min read",
  },
  {
    href: "/guides/find-local-business-emails",
    tag: "Lead finding",
    title: "How to find local business email addresses (any niche, any city)",
    blurb:
      "The manual methods that work, what they cost you in time, and the 30-second version — with real niche + city examples.",
    time: "9 min read",
  },
];

export default function GuidesIndex() {
  const outreach = isOutreachEnabled();
  const guides = GUIDES.filter((g) => outreach || !g.href.includes(OUTREACH_GUIDE));

  return (
    <PublicShell
      title="Guides"
      subtitle="No fluff, no recycled listicles — practical playbooks for finding real businesses and reaching the people behind them."
    >
      <div className="space-y-5">
        {guides.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="block rounded-2xl border border-zinc-200 p-6 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-900/5"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">
                {g.tag}
              </span>
              <span className="text-zinc-400">{g.time}</span>
            </div>
            <h2 className="mt-2.5 text-xl font-semibold tracking-tight">{g.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{g.blurb}</p>
            <span className="mt-3 inline-block text-sm font-medium text-blue-600">
              Read the guide →
            </span>
          </Link>
        ))}
      </div>

      {/* Both tools test the email you are about to send, so they belong to the
          outreach half and go with it. */}
      {outreach && (
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6">
          <div className="text-sm font-semibold text-zinc-700">Free tools that pair with these guides</div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/tools/dns-checker" className="text-blue-600 underline hover:text-blue-700">
              SPF / DKIM / DMARC checker
            </Link>
            <Link href="/tools/spam-checker" className="text-blue-600 underline hover:text-blue-700">
              Email spam checker
            </Link>
          </div>
        </div>
      )}
    </PublicShell>
  );
}
