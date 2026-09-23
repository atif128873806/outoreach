import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Documentation — how to use Outreach Studio",
  description:
    "The complete guide: type a niche and a city, get live businesses (never a stale database) each with a website score and a plain-English list of what is wrong with their site — then export the ones worth contacting.",
};

const TOC = [
  ["quick-start", "Quick start (2 minutes)"],
  ["filters", "The four filters"],
  ["leads", "Finding leads"],
  ["accuracy", "What we refuse to claim"],
  ["working", "Working the list"],
  ["new-businesses", "New businesses (the weekly list)"],
  ["limits", "Plans & limits"],
  ["troubleshooting", "Troubleshooting"],
] as const;

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[13px]">{children}</code>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold text-zinc-800">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-zinc-600">{children}</div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <PublicShell
      title="Documentation"
      subtitle="What this tool does, how it decides, and what it deliberately won't claim — honestly written, no fluff."
    >
      {/* TOC */}
      <nav className="mb-12 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          On this page
        </div>
        <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-blue-600 hover:underline">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div id="quick-start" className="scroll-mt-20">
        <Section heading="Quick start — zero to a shortlist in ~2 minutes">
          <div className="space-y-5">
            <Step n={1} title="Create your account & verify your email">
              Sign up at <Link href="/signup" className="text-blue-600 underline">/signup</Link>,
              then click the link in the confirmation email. (Check spam if it doesn&apos;t
              arrive in a minute — then hit &quot;Resend&quot; from the banner in the app.)
            </Step>
            <Step n={2} title="Type a niche and a city">
              In the Lead Finder, both fields are required: a niche
              (&quot;dentists&quot;, &quot;roofers&quot;, &quot;yoga studios&quot;) and a
              place (&quot;Austin, USA&quot;, &quot;Manchester, UK&quot;). The place is a
              constraint, not a hint — see{" "}
              <a href="#accuracy" className="text-blue-600 underline">what we refuse to claim</a>.
            </Step>
            <Step n={3} title="Pick who you're looking for, then search">
              Choose one of the{" "}
              <a href="#filters" className="text-blue-600 underline">four filters</a> and how
              many results you want. Every business comes back with a website score, the
              concrete problems found, and everything needed to contact them — website, email,
              phone, Instagram, LinkedIn. Export the list as CSV or save it to{" "}
              <Link href="/leads" className="text-blue-600 underline">My leads</Link>.
            </Step>
          </div>
        </Section>
      </div>

      <div id="filters" className="scroll-mt-20">
        <Section heading="The four filters — each one is a different customer">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Any business</b> — everything the sources can find in that niche and place,
              ranked by how strong a prospect they are. The honest default.
            </li>
            <li>
              <b>Has a website</b> — only businesses with a reachable site. Use it when you
              need to see the business online before you decide anything.
            </li>
            <li>
              <b>Outdated or broken site</b> — the site is fetched and audited, and only
              businesses with a real, checkable defect survive: no HTTPS, a certificate a
              browser refuses, not mobile-friendly, dead homepage links, a free-builder
              page, 2000s-era markup. Worst sites first, because those are the easiest
              conversations to start. This is the redesign seller&apos;s filter.
            </li>
            <li>
              <b>No website</b> — businesses that exist on the map with no site at all. This
              is the most expensive search to run, because each business gets its own web
              lookup for an Instagram, phone or email — offline businesses usually have a
              social page even with no site. This is the web designer&apos;s filter.
            </li>
          </ul>
          <p className="mt-3">
            The filters unlock by plan:{" "}
            <b>Any business</b> and <b>Has a website</b> from Free,{" "}
            <b>Outdated or broken site</b> from Starter, and <b>No website</b> on Pro.
          </p>
        </Section>
      </div>

      <div id="leads" className="scroll-mt-20">
        <Section heading="Finding leads">
          <p>
            Results are fetched <b>live, per search</b> — there is no pre-built database sold
            to you as if it were fresh. Three sources, each with different strengths:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Web search (AI)</b> — reads the open web for the niche and place; often
              returns contact details and company context directly. Best default.
            </li>
            <li>
              <b>OpenStreetMap</b> — open map data; strong on local physical businesses
              (which is exactly who needs a website), though many entries carry no site.
            </li>
            <li>
              <b>Companies House (UK)</b> — the official register, for companies that
              incorporated recently and mostly have no site yet. It runs on the
              deployment&apos;s own register key, so there is nothing for you to set up.
            </li>
          </ul>
          <p>
            Each business is then enriched: its site is visited for an email, Instagram,
            LinkedIn and phone, including de-obfuscation of tricks like{" "}
            <Code>info [at] company [dot] com</Code>. Every site is audited, and the findings
            are attached to that lead.
          </p>
          <p>
            <b>The score is evidence, not opinion.</b> Every site is graded on real
            measurements — does it answer at all, is the certificate valid, does it load on a
            phone, do its links resolve, what platform is it built on. The score is 100 minus
            the weight of what actually failed. One grade is named{" "}
            <Code>unknown</Code> and it exists on purpose: it means we could not judge, and we
            will not pretend otherwise.
          </p>
        </Section>
      </div>

      <div id="accuracy" className="scroll-mt-20">
        <Section heading="What we refuse to claim (read this once)">
          <p>
            A tool like this fails in one specific way: it accuses a healthy business of
            being broken, and the person using it loses the deal on the first line. Every
            check below exists to stop that, at some cost in raw quantity:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Bot walls are not defects.</b> A site that answers <Code>403</Code>,{" "}
              <Code>429</Code> or <Code>451</Code> to our check is graded{" "}
              <Code>unknown</Code> — &quot;refused our automated check&quot;. Plenty of healthy
              sites refuse datacenter traffic.
            </li>
            <li>
              <b>Timeouts are never a finding.</b> A timeout may be our network, so it is
              recorded and never used as a reason to contact anyone.
            </li>
            <li>
              <b>Soft gaps stay soft.</b> A stale copyright year, a missing meta
              description, no analytics — recorded as findings, but never a flag and never a
              &quot;needs work&quot; verdict. A 2016 footer doesn&apos;t make a business
              broken.
            </li>
            <li>
              <b>JavaScript apps are not thin.</b> Sites built as app shells are recognised,
              so a perfectly good modern site is never flagged for &quot;almost no
              content&quot;.
            </li>
            <li>
              <b>Only things a visitor can click.</b> Broken-link checks ignore{" "}
              <Code>&lt;head&gt;</Code> metadata and vendor-injected links (feeds, API
              endpoints, email-obfuscation helpers) — those 404 to a machine but no human
              ever clicks them.
            </li>
            <li>
              <b>Numbers have to be dialable.</b> Anything that looks like a phone number but
              isn&apos;t — copyright ranges, IP addresses — is dropped rather than shown to
              you.
            </li>
            <li>
              <b>Location is enforced from the address.</b> Every business&apos;s own address
              is compared with the place you typed, and anything that places itself elsewhere
              is left out. You always see how many were left out and why. Records with no
              usable address are kept, not quietly dropped.
            </li>
          </ul>
          <p className="mt-3">
            The direction of every one of those decisions is the same: we would rather show
            you one fewer lead than point you at a business that is doing nothing wrong.
          </p>
        </Section>
      </div>

      <div id="working" className="scroll-mt-20">
        <Section heading="Working the list">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Order</b> — <i>Best prospects</i> balances everything we know;{" "}
              <i>Easiest to reach</i> puts businesses with an email, social handle or phone
              first; <i>Worst site first</i> is pure audit score, the redesign seller&apos;s
              order.
            </li>
            <li>
              <b>Expand any row</b> for the full audit: every check, what was measured, and
              the verdict. The short list on the row is what to say out loud.
            </li>
            <li>
              <b>Pitch column</b> copies that one lead&apos;s block — business, contact,
              score, the concrete problems — so you can work the list one at a time.
            </li>
            <li>
              <b>Export</b> writes the whole list as CSV with every way to reach the
              business, the score, the problems and the reason to make contact. Header names
              are stable, so re-importing the file lands in the right columns.
            </li>
            <li>
              <b>My leads</b> holds what you saved. A business you already imported is hidden
              on repeat searches and never counted twice.
            </li>
            <li>
              <b>Find the owner</b> — one click searches for the decision-maker behind a
              business and attaches their name and role to the lead.
            </li>
          </ul>
        </Section>
      </div>

      <div id="new-businesses" className="scroll-mt-20">
        <Section heading="New businesses — the list that fills itself">
          <p>
            Save a niche and a place on the <b>New businesses</b> page (Starter and up) and the
            list stops depending on you remembering to search. Everything here comes from the
            official UK company register, and a company is judged new by the one thing that
            cannot go stale: its <b>incorporation date</b>.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>What you get</b> — companies incorporated since your last check, newest first,
              each with its registered office, business type and director names taken from the
              register.
            </li>
            <li>
              <b>Why it is worth opening</b> — a business registered this week has no website to
              audit and nobody working with it yet. That is the one moment it is a lead and not a
              competitor&apos;s customer.
            </li>
            <li>
              <b>When it runs</b> — every day, per search. A search is picked up once seven days
              have passed since its last check, so a quiet week does not skip it and a failed run
              never loses the companies it failed to see.
            </li>
            <li>
              <b>The email</b> — one message per account covering every search that found
              something, and nothing at all when there is nothing to say. If the deployment has no
              system mailer set up (<Code>SYSTEM_SMTP_*</Code>), the list still builds; it simply
              stays in the app, and the page says so rather than leaving you waiting.
            </li>
            <li>
              <b>Clearing the list</b> — opening the page marks what you have seen, so the badge
              in the sidebar is a count of things you have not looked at yet.
            </li>
            <li>
              <b>Its one limit</b> — the register is UK-only. Searching a US city here is not a
              smaller list, it is the wrong list, so keep the watch to UK places.
            </li>
          </ul>
          <p>
            A row here is a name, a place and a director — <b>not an audit</b>. These businesses
            have not had their website checked, because a company this new usually has none. Open
            one in the Lead Finder when you are ready to check and pitch.
          </p>
        </Section>
      </div>

      <div id="limits" className="scroll-mt-20">
        <Section heading="Plans & limits">
          <p>
            See <Link href="/pricing" className="text-blue-600 underline">pricing</Link> for
            the current numbers. Two things are metered: <b>audited results per calendar
            month</b>, and <b>which filters</b> your plan unlocks. Owner lookups count as
            results.
          </p>
          <p>
            The important part is how a limit behaves: <b>nothing breaks and nothing is
            lost.</b> At the monthly limit, the Lead Finder asks you to upgrade and stops
            until the 1st. A result you never saw — one left out because it wasn&apos;t in
            your location — never counts against the month. Your live usage is on the{" "}
            <b>Plan &amp; usage</b> page in the app.
          </p>
        </Section>
      </div>

      <div id="troubleshooting" className="scroll-mt-20">
        <Section heading="Troubleshooting">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Verification email didn&apos;t arrive</b> — check spam, then use Resend
              from the in-app banner. Mark it &quot;Not spam&quot; so the next ones land
              properly.
            </li>
            <li>
              <b>Fewer results than I asked for</b> — the note above the results tells you
              which case it is. Either the source genuinely ran out for that niche and place
              (try a broader niche, a nearby bigger city, or another source), or some
              businesses were left out because their address placed them elsewhere — the
              count is shown.
            </li>
            <li>
              <b>A site reads &quot;unknown&quot;</b> — we could not judge it (refused our
              check, or never answered). That&apos;s information, not a defect: nothing was
              accused, and it is not counted as a business that needs work.
            </li>
            <li>
              <b>&quot;The site may be slow&quot;</b> — heavy pages get flagged because slow
              sites lose customers; that one is a measurement, and worth mentioning only if
              it is comfortably above the usual range.
            </li>
            <li>
              <b>&quot;Out of its free daily allowance&quot;</b> — the shared web-search
              quota for the whole day is used up, so it returns at 00:00 UTC. Every other
              source keeps working meanwhile, and OpenStreetMap and the UK register need no
              search at all.
            </li>
            <li>
              <b>Anything else</b> — email{" "}
              <Link href="/contact" className="text-blue-600 underline">support</Link>; we
              usually answer within a business day.
            </li>
          </ul>
        </Section>
      </div>

      {/* CTA */}
      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">Ready to try it?</div>
          <p className="mt-1 text-sm text-zinc-400">
            Free plan, audited leads every month, no card and no trial clock.
          </p>
        </div>
        <Link
          href="/signup"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
        >
          Start free
        </Link>
      </div>
    </PublicShell>
  );
}
