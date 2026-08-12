import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Documentation — how to use Outreach Studio",
  description:
    "The complete guide: connect your mailbox, find leads with emails included, launch an AI-written campaign, and handle replies — from zero to first campaign in about 10 minutes.",
};

const TOC = [
  ["quick-start", "Quick start (10 minutes)"],
  ["settings", "Settings: identity, SMTP & IMAP"],
  ["leads", "Finding leads"],
  ["contacts", "Contacts & targeting"],
  ["campaigns", "Creating a campaign"],
  ["replies", "Replies & the Message Center"],
  ["deliverability", "Deliverability rules"],
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
      subtitle="Everything from first signup to your first booked reply — honestly written, no fluff."
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
        <Section heading="Quick start — zero to first campaign in ~10 minutes">
          <div className="space-y-5">
            <Step n={1} title="Create your account & verify your email">
              Sign up at <Link href="/signup" className="text-blue-600 underline">/signup</Link>,
              then click the link in the confirmation email. Verification unlocks real
              sending and the included AI writing. (Check spam if it doesn&apos;t arrive
              in a minute — then hit &quot;Resend&quot; from the banner in the app.)
            </Step>
            <Step n={2} title="Fill in your sender identity (Settings)">
              Your name, role, company, and what your company does. The AI writes every
              email in <i>your</i> voice from these — 2 minutes here massively improves
              every message.
            </Step>
            <Step n={3} title="Find your first leads">
              Lead Finder → type a niche (&quot;dentists&quot;) and a city → Find leads.
              Import the ones with emails straight into Contacts.
            </Step>
            <Step n={4} title="Create a campaign — in simulation first">
              Describe your offer in a sentence or two (the ✨ AI assistant will sharpen
              it), preview a sample email, and schedule. <b>Without SMTP configured,
              everything runs in simulation</b> — messages are generated and logged but
              nothing is actually sent. Perfect for testing.
            </Step>
            <Step n={5} title="Connect your mailbox and go live">
              Add SMTP in Settings (below), turn on warm-up if the domain is new, and
              your next campaign sends for real.
            </Step>
          </div>
        </Section>
      </div>

      <div id="settings" className="scroll-mt-20">
        <Section heading="Settings: identity, SMTP & IMAP">
          <p>
            <b>Sender identity</b> — name, role, company, company description, and
            sign-off. Used by the AI for every message. Be specific: &quot;We build
            booking websites for dental clinics&quot; beats &quot;we do software.&quot;
            Add your valid business postal address here as well; it is included in the
            compliance footer of every real campaign email.
          </p>
          <p>
            <b>Email delivery (SMTP)</b> — works with any mailbox: Google Workspace,
            Zoho, Namecheap/cPanel, Outlook. Easiest path: use <b>⚡ Quick setup</b> —
            type the email you&apos;ll send from and every field (host, port, SSL,
            IMAP) is detected and filled automatically; you only paste the password.
            For Gmail/Outlook/Zoho/Yahoo that password is an <b>App Password</b> —
            the wizard links you straight to the right page to create one, and{" "}
            <b>Verify &amp; save</b> checks the login live (no email sent) so only a
            working configuration is stored. Then use <b>Send test email</b> for the
            final proof.
          </p>
          <p>
            <b>Reply detection (IMAP)</b> — lets the app watch your inbox for replies
            and bounces. If your IMAP credentials are the same mailbox, leave the IMAP
            fields empty — the SMTP values are reused. Typical IMAP port:{" "}
            <Code>993</Code>.
          </p>
          <p>
            <b>Public base URL</b> — set this to the address of this app so open/click
            tracking and unsubscribe links in your emails point somewhere real.
          </p>
          <p>
            <b>AI provider</b> — AI writing is included free (daily limit by plan). You
            can optionally add your own Anthropic (Claude) API key for unlimited
            generation with zero markup.
          </p>
        </Section>
      </div>

      <div id="leads" className="scroll-mt-20">
        <Section heading="Finding leads">
          <p>Three sources, each with different strengths:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Web search (AI)</b> — searches the open web; often returns emails and
              company intel (what they do, size) directly. Best default.
            </li>
            <li>
              <b>OpenStreetMap</b> — free open business database; great coverage of
              local physical businesses, but many entries lack websites.
            </li>
            <li>
              <b>Google Places</b> — official Maps data; needs your own (free-tier)
              Google API key in Settings.
            </li>
          </ul>
          <p>
            After the source returns businesses, each website is visited automatically
            to extract emails, Instagram, and LinkedIn — including de-obfuscating
            tricks like <Code>info [at] company [dot] com</Code>. Results you already
            imported are hidden on repeat searches and never charged to your quota.
          </p>
          <p>
            <b>If you get fewer than you asked for:</b> the source genuinely ran out of
            matches for that niche + area. Try another source, a broader niche, or a
            nearby bigger city.
          </p>
          <p>
            <b>Find the owner</b> — on any lead, one click searches LinkedIn for the
            decision-maker behind the business; picking one attaches their name and
            role to the contact so the AI can personalize further. Owner lookups use 1
            lead credit each.
          </p>
          <p>
            <b>Offline-business mode</b> — set the Website filter to{" "}
            <Code>No website</Code> to find businesses with no site at all: perfect
            prospects if you sell websites or digital services. This mode picks its
            own sources (map data — OpenStreetMap, plus Google Places if you added a
            key) and then automatically hunts each business&apos;s Instagram, phone,
            and email across the web, since offline businesses usually have an
            Instagram page even without a site. Import them (a business name plus an
            Instagram handle or phone is enough — no email needed) and reach them
            with an Instagram DM campaign or a call.
          </p>
          <p>
            <b>Redesign-prospect mode</b> — the <Code>Outdated website</Code> filter
            audits every site found and keeps only the ones with concrete problems:
            no HTTPS, not mobile-friendly, free-builder hosting, ancient copyright
            dates, 2000s-era code. The specific issues are saved into each
            lead&apos;s notes, so the AI opens your email with them — &quot;I noticed
            your site isn&apos;t mobile-friendly…&quot; — automatically.
          </p>
          <p>
            <b>Tech profile on every lead</b> — every website found is also read for
            its platform (WordPress, Shopify, Wix…) and marketing tags (Facebook
            Pixel, Google Analytics…). Badges appear on each lead, one-click chips
            above the results filter by them (import &amp; CSV follow the filter),
            and the facts flow into the lead&apos;s notes so the AI can pitch with
            them — a business running ads to an outdated site is your hottest
            prospect.
          </p>
        </Section>
      </div>

      <div id="contacts" className="scroll-mt-20">
        <Section heading="Contacts & targeting">
          <p>
            Import from the Lead Finder, upload a CSV (only <Code>email</Code> is
            required — headers like company/industry/url are auto-detected), or add
            manually. Duplicates are skipped by email automatically.
          </p>
          <p>
            <b>Targeting specific people:</b> the <i>category</i> field is free text
            and doubles as your list system. Give any group of contacts a custom
            category like <Code>vip-list</Code> (when importing or by editing a
            contact), then choose that category as the campaign&apos;s audience — only
            those contacts get it.
          </p>
          <p>
            Unsubscribed and bounced contacts are excluded from every future send
            automatically and permanently.
          </p>
        </Section>
      </div>

      <div id="campaigns" className="scroll-mt-20">
        <Section heading="Creating a campaign">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Brief</b> — one or two honest sentences: what you offer, the concrete
              benefit, what you want them to do. The ✨ <b>Improve with AI</b> button
              turns a rough idea into a crisp brief and names the campaign.
            </li>
            <li>
              <b>Channel</b> — Email sends automatically. Instagram and LinkedIn
              produce <i>drafts</i> you send manually from the Message Center
              (automating DMs gets accounts banned — we don&apos;t).
            </li>
            <li>
              <b>Audience</b> — a category, or All contacts.
            </li>
            <li>
              <b>Pace</b> — messages per hour (keep it 10–20), an optional send window
              (e.g. 9:00–17:00 in your Settings timezone), and a schedule time.
            </li>
            <li>
              <b>Follow-ups</b> — up to 3, N days apart, written with the earlier email
              in context. A reply stops that contact&apos;s sequence instantly.
            </li>
            <li>
              <b>A/B subject test</b> — alternates two subject strategies and reports
              open rates per arm on the campaign page.
            </li>
            <li>
              <b>Test batch</b> — check &quot;Start with a test batch&quot; and only the
              first 5 or 10 messages go out; the campaign then pauses itself so you can
              review results (and edit) before hitting Resume for the rest.
            </li>
            <li>
              <b>Editing</b> — the ✎ Edit button on any scheduled, paused, or running
              campaign changes the name, brief, tone, speed, and follow-ups. Messages are
              written at send time, so edits apply to everything not yet sent.
            </li>
            <li>
              <b>Preview</b> — always generate a sample before scheduling: it shows the
              real AI output for a real contact, runs the spam-filter check, and can
              email the sample to your own inbox.
            </li>
          </ul>
          <p>
            Campaigns can be paused, resumed, started immediately, or cancelled any
            time; the per-message log shows every send, open, click, and reply.
          </p>
        </Section>
      </div>

      <div id="replies" className="scroll-mt-20">
        <Section heading="Replies & the Message Center">
          <p>
            With IMAP connected, your inbox is checked every 2 minutes. Each reply is
            classified — <b>interested</b>, <b>question</b>, <b>not interested</b>,{" "}
            <b>out of office</b> — and the AI drafts a suggested response in your
            voice, ready to copy or open pre-filled in your mail app. Bounce notices
            automatically mark the contact and stop all future sends to them.
          </p>
          <p>
            Instagram and LinkedIn drafts live here too: copy → open profile → mark
            sent, one click each. LinkedIn sequences start with a connection note
            (kept under LinkedIn&apos;s 200-character cap) followed by direct
            messages; marking a draft sent queues the next follow-up after your
            campaign&apos;s interval, and <b>got a reply</b> stops that
            contact&apos;s sequence instantly. We draft, you send — automating
            LinkedIn sends violates their terms and risks your account, so we
            never do it.
          </p>
        </Section>
      </div>

      <div id="deliverability" className="scroll-mt-20">
        <Section heading="Deliverability rules (read this once — it matters)">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Authenticate your domain</b>: SPF, DKIM, and DMARC records. Check
              yours in 5 seconds with the free{" "}
              <Link href="/tools/dns-checker" className="text-blue-600 underline">
                DNS checker
              </Link>{" "}
              — the Settings page has the same check with fix-it advice.
            </li>
            <li>
              <b>Identify the sender</b>: keep a valid business postal address in Settings.
              It is added to every real campaign email alongside the one-click unsubscribe.
            </li>
            <li>
              <b>Warm up new domains</b>: turn on warm-up mode — it ramps 10/day →
              25 → 40 → your full cap over 4 weeks. Skipping this is the #1 way new
              senders end up in spam.
            </li>
            <li>
              <b>Keep volume human</b>: daily cap 25–50 while your domain is young;
              throttle 10–20/hour; send inside business hours.
            </li>
            <li>
              <b>Never cold-email from your main business domain</b> — use a separate
              look-alike domain so your transactional/personal mail is never at risk.
            </li>
            <li>
              <b>Content matters</b>: the built-in spam check runs on every preview;
              the same check is free for anyone at{" "}
              <Link href="/tools/spam-checker" className="text-blue-600 underline">
                /tools/spam-checker
              </Link>
              .
            </li>
          </ul>
        </Section>
      </div>

      <div id="limits" className="scroll-mt-20">
        <Section heading="Plans & limits">
          <p>
            See <Link href="/pricing" className="text-blue-600 underline">pricing</Link>{" "}
            for the current numbers. The important part is how limits behave:{" "}
            <b>nothing breaks.</b> At the daily email cap, remaining messages send
            tomorrow. At the AI limit, the built-in template engine takes over until
            midnight. At the monthly lead limit, the Lead Finder pauses until the 1st
            (or an upgrade). Your live usage is on the{" "}
            <b>Plan &amp; Usage</b> page in the app.
          </p>
        </Section>
      </div>

      <div id="troubleshooting" className="scroll-mt-20">
        <Section heading="Troubleshooting">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Verification email didn&apos;t arrive</b> — check spam, then use
              Resend from the in-app banner. Mark it &quot;Not spam&quot; so the next
              ones land properly.
            </li>
            <li>
              <b>&quot;Test email failed&quot; / SMTP errors</b> — wrong host/port
              combo is the usual cause: <Code>465</Code> needs SSL on,{" "}
              <Code>587</Code> needs SSL off. Gmail needs an App Password. Some hosts
              use <Code>mail.yourdomain.com</Code>, others a server hostname from
              your hosting panel.
            </li>
            <li>
              <b>My emails go to the recipient&apos;s spam</b> — run the{" "}
              <Link href="/tools/dns-checker" className="text-blue-600 underline">
                DNS check
              </Link>{" "}
              first; fix any ✗. Then: new domains need 2–4 weeks of low, steady,
              warmed-up volume to build reputation. This is normal.
            </li>
            <li>
              <b>Lead search returned fewer than requested</b> — that niche/city
              genuinely ran out of findable businesses. Switch source or broaden.
            </li>
            <li>
              <b>&quot;Provider is busy&quot; / temporary AI errors</b> — wait a
              minute and retry; campaigns fall back to the template engine
              automatically, so sending never stops. When that happens the campaign
              page shows how many messages used templates — templates personalize
              per business but don&apos;t follow custom brief instructions.
            </li>
            <li>
              <b>&quot;My custom instructions weren&apos;t followed&quot;</b> — put them
              in the campaign brief (they override the AI&apos;s style rules), and check
              the campaign page for a template-fallback notice: template-written
              messages are the usual cause.
            </li>
            <li>
              <b>Anything else</b> — email{" "}
              <Link href="/contact" className="text-blue-600 underline">support</Link>;
              we usually answer within a business day.
            </li>
          </ul>
        </Section>
      </div>

      {/* CTA */}
      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">Ready to try it?</div>
          <p className="mt-1 text-sm text-zinc-400">
            Free plan, simulation mode, nothing sends until you say so.
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
