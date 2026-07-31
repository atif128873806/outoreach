import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../../components/PublicShell";

export const metadata: Metadata = {
  title: "How to Find Local Business Email Addresses (Any Niche, Any City) — 2026 Guide",
  description:
    "Four working methods to find email addresses for local businesses — dentists, restaurants, real estate, salons — from free manual research to automated lead finding, with real niche + city examples.",
};

function Ex({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[13px]">{children}</span>
  );
}

export default function LocalEmailsGuide() {
  return (
    <PublicShell
      title="How to find local business email addresses — any niche, any city"
      subtitle="Every method that actually works in 2026, what each costs you in time, and how to stay on the right side of the law while you do it."
      updated="July 2026"
    >
      <Section heading="What you're actually looking for">
        <p>
          &quot;Leads&quot; for local outreach means four fields:{" "}
          <b>business name, email address, what they do, and a personalization hook</b> (their
          Instagram, their website&apos;s state, who owns them). The email alone isn&apos;t
          enough — an email with zero context produces the generic outreach everyone deletes.
        </p>
        <p>
          Typical goal: go from a query like <Ex>dentists in Austin</Ex>,{" "}
          <Ex>restaurants in Manchester</Ex>, or <Ex>real estate agents in Dubai</Ex> to a
          contactable list. Here are the four ways, cheapest-in-money first.
        </p>
      </Section>

      <Section heading="Method 1 — Google Maps + the business's website (free, slow)">
        <p>The classic manual loop:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Search the niche + city on Google Maps, open each listing</li>
          <li>Click through to the website; check the footer and the /contact page for an email</li>
          <li>
            No email visible? Try the common patterns: <Ex>info@domain.com</Ex>,{" "}
            <Ex>hello@domain.com</Ex>, <Ex>office@domain.com</Ex> — but treat guesses carefully:
            sending to nonexistent addresses bounces, and bounces hurt your sender reputation
          </li>
          <li>Log everything in a spreadsheet with a note about the business</li>
        </ul>
        <p>
          <b>Real cost:</b> 3–5 minutes per usable lead once you count dead sites and hidden
          emails — a 50-lead list is an afternoon. Fine for your first 20 prospects; brutal
          weekly.
        </p>
        <p className="text-sm text-zinc-500">
          Tip: many sites hide emails from scrapers as <Ex>info [at] company [dot] com</Ex> or
          images — that&apos;s why naive copy-paste misses them.
        </p>
      </Section>

      <Section heading="Method 2 — Instagram & Facebook for offline businesses (free, patchy)">
        <p>
          Many small local businesses — salons, barbers, food spots, tailors — have{" "}
          <b>no website at all</b>, but do run an Instagram or Facebook page. Their bio often
          carries an email or a phone/WhatsApp number, and a DM is a legitimate first touch for
          this segment.
        </p>
        <p>
          Counterintuitive but true: for anyone selling <i>websites or digital services</i>,
          these no-website businesses are the best prospects on the list — they need exactly
          what you sell, and no competitor scraping &quot;businesses with emails&quot; ever
          reaches them.
        </p>
      </Section>

      <Section heading="Method 3 — Directories & registries (free-ish, stale)">
        <p>
          Yelp, Yellow Pages, chamber-of-commerce lists, and trade registries have decent
          coverage but two chronic problems: the data ages badly (closed businesses, changed
          emails → bounces), and everyone else scrapes the same lists — those inboxes are
          hammered. Usable as a supplement, poor as a primary source.
        </p>
      </Section>

      <Section heading="Method 4 — Automated lead finding (30 seconds, this is what we build)">
        <p>
          Outreach Studio&apos;s Lead Finder runs the whole loop from Method 1–2 automatically:
          type a niche + city, and it searches business sources (AI web search, OpenStreetMap,
          Google Places), <b>visits every website</b>, and extracts emails — including the{" "}
          <Ex>[at]/[dot]</Ex>-obfuscated ones — plus Instagram, LinkedIn, phone, and company
          intel for personalization. Examples that work well:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><Ex>dentist</Ex> + <Ex>Austin, TX</Ex> — health niches have strong email coverage</li>
          <li><Ex>real estate</Ex> + <Ex>London</Ex> — agency-dense cities return fast</li>
          <li><Ex>restaurant</Ex> + <Ex>Manchester, UK</Ex> — pair with the no-website filter to find digital-service prospects</li>
        </ul>
        <p>Three filters worth knowing, because they change who you find:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>No website</b> — offline businesses; the tool then hunts their Instagram/phone
            across the web so they&apos;re still reachable
          </li>
          <li>
            <b>Outdated website</b> — sites failing concrete checks (no HTTPS, not
            mobile-friendly, ancient code) with the problems listed per lead: ready-made
            redesign pitches
          </li>
          <li>
            <b>Tech profile</b> — every lead is tagged with its platform (WordPress, Shopify,
            Wix…) and marketing tags (Facebook Pixel, Google Analytics), so &quot;WordPress
            sites running ads&quot; is one click
          </li>
        </ul>
        <p>
          The free plan includes 50 lead results a month — enough to test whether the quality
          beats your manual afternoon. <Link href="/signup" className="text-blue-600 underline">Try it free</Link>{" "}
          or see <Link href="/features" className="text-blue-600 underline">how the whole pipeline works</Link>.
        </p>
      </Section>

      <Section heading="The legal & etiquette part (read this once)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Business email ≠ consumer email.</b> Laws like CAN-SPAM (US) and PECR/GDPR
            (UK/EU) treat B2B outreach to relevant business addresses differently from consumer
            spam — but every regime requires honesty (real sender, truthful subject) and a
            working opt-out you honor permanently.
          </li>
          <li>
            <b>Relevance is your legal and moral cover:</b> a web designer emailing a business
            with a broken website about that website is legitimate interest; blasting 5,000
            unrelated inboxes is spam in every jurisdiction.
          </li>
          <li>
            <b>Never buy consumer lists.</b> Public business contact details, individually
            relevant outreach, easy opt-out — that&apos;s the lane.
          </li>
          <li>
            Volume discipline (25–50/day, warmed-up domain) isn&apos;t just deliverability —
            it keeps you unmistakably on the legitimate side. Full setup:{" "}
            <Link href="/guides/cold-email-deliverability" className="text-blue-600 underline">
              the deliverability guide
            </Link>.
          </li>
        </ul>
      </Section>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">
            From &quot;dentists in Austin&quot; to a contactable list in 30 seconds
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            50 free lead results a month, emails and personalization intel included. No card.
          </p>
        </div>
        <Link
          href="/signup"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
        >
          Find your first leads
        </Link>
      </div>
    </PublicShell>
  );
}
