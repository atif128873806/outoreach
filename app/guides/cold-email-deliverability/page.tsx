import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../../components/PublicShell";

export const metadata: Metadata = {
  title: "Cold Email Deliverability in 2026: SPF, DKIM, DMARC & Warm-up — Complete Setup Guide",
  description:
    "Why cold emails land in spam and how to fix it: exact SPF/DKIM/DMARC records, domain warm-up schedules, sending limits, and content rules — written from real debugging, not theory.",
};

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[13px] break-all">{children}</code>;
}

function WarStory({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border-l-4 border-blue-300 bg-blue-50/50 px-4 py-3 text-sm leading-relaxed text-zinc-600">
      <span className="font-semibold text-blue-700">From the trenches: </span>
      {children}
    </div>
  );
}

export default function DeliverabilityGuide() {
  return (
    <PublicShell
      title="Cold email deliverability in 2026: the complete setup"
      subtitle="Everything that decides whether your email lands in the inbox or dies in spam — with the exact records, schedules, and limits. Written from real debugging, not recycled blog posts."
      updated="July 2026"
    >
      <Section heading="The three walls between you and the inbox">
        <p>
          Gmail and Outlook judge every incoming email on three levels, in order:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Authentication</b> — can your domain prove it sent this? (SPF, DKIM, DMARC —
            fixable in 30 minutes, covered below)
          </li>
          <li>
            <b>Reputation</b> — does your domain/IP have a history of wanted mail? (built over
            weeks with warm-up and steady volume)
          </li>
          <li>
            <b>Content & behavior</b> — does this look like spam, and do people mark it as spam?
          </li>
        </ul>
        <p>
          Most "why is my cold email in spam?!" posts are a failure at wall #1 — the cheapest one
          to fix. Start there.
        </p>
      </Section>

      <Section heading="Wall 1: Authentication — SPF, DKIM, DMARC (30 minutes, once)">
        <p>
          <b>SPF</b> is a DNS record listing which servers may send email for your domain.
          Add a TXT record on your root domain:
        </p>
        <p>
          <Code>v=spf1 a mx include:_spf.google.com ~all</Code>{" "}
          <span className="text-zinc-400">(Google Workspace example — your email host&apos;s docs
          have the exact include for your provider)</span>
        </p>
        <p>
          <b>DKIM</b>{" "}cryptographically signs each message so receivers can verify it wasn&apos;t
          forged. Your email provider generates the key — you publish it as a TXT record on{" "}
          <Code>selector._domainkey.yourdomain.com</Code>. Where to find it: Google Workspace →
          Admin → Gmail → Authenticate email; cPanel → Email Deliverability; Zoho → Mail Admin →
          DKIM. If you skip DKIM, Gmail treats you as second-class regardless of everything else.
        </p>
        <p>
          <b>DMARC</b> tells receivers what to do when a message fails those checks. Start
          gentle — a TXT record on <Code>_dmarc.yourdomain.com</Code>:
        </p>
        <p>
          <Code>v=DMARC1; p=none; rua=mailto:you@yourdomain.com</Code>
        </p>
        <p>
          After 2–3 weeks of your own mail passing cleanly, tighten <Code>p=none</Code> to{" "}
          <Code>p=quarantine</Code>.
        </p>
        <WarStory>
          Our own verification emails went to spam at launch — mail-tester scored us 6/10.
          The fix was exactly these three records plus an MX record, and the score went to
          10/10 within an hour of DNS propagating. The records are free; not having them is
          expensive.
        </WarStory>
        <p>
          <b>Check yourself right now</b> — our free{" "}
          <Link href="/tools/dns-checker" className="text-blue-600 underline">
            SPF/DKIM/DMARC checker
          </Link>{" "}
          reads your domain and tells you exactly what&apos;s missing, with fix-it snippets. No
          signup.
        </p>
        <p className="text-sm text-zinc-500">
          Two gotchas that cost us hours: (1) in Namecheap-style DNS panels the Host field for a
          root TXT record is <Code>@</Code>, not your domain name — and nothing saves until you
          hit &quot;Save all changes&quot;; (2) DKIM values are very long — a truncated paste
          fails silently.
        </p>
      </Section>

      <Section heading="Wall 2: Reputation — warm-up, or die on day one">
        <p>
          A brand-new domain (or a domain that never sent bulk) has <i>no</i> reputation. Send
          200 cold emails on day one and Gmail's models flag the pattern instantly — that domain
          can be effectively dead within a week.
        </p>
        <p>The warm-up schedule that works:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Week 1: ~10 emails/day</li>
          <li>Week 2: ~25/day</li>
          <li>Week 3: ~40/day</li>
          <li>Week 4+: your full cap — and keep a cap (25–50/day per mailbox is the sane zone)</li>
        </ul>
        <p>
          During warm-up, replies matter more than volume — early back-and-forth conversations
          teach providers your mail is wanted. Send your first batches to your most promising
          leads, not your longest list.
        </p>
        <p>
          Two structural rules that protect reputation permanently:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Never cold-email from your main domain.</b> Your primary domain carries your
            transactional and personal mail — one bad campaign can poison it. Buy a look-alike
            domain (~$10) for outreach, set up its DNS the same way, and point its website at
            your real site.
          </li>
          <li>
            <b>Drip, don&apos;t blast.</b> 10–20 emails per hour inside business hours looks
            human. 500 at 9:00 sharp looks like what it is.
          </li>
        </ul>
        <WarStory>
          This is why Outreach Studio has warm-up ramps, daily caps, hourly throttles, and
          send windows built in and turned on by default — we treat them as safety equipment,
          not power-user options.
        </WarStory>
      </Section>

      <Section heading="Wall 3: Content — write like a person, get read like one">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Plain text beats HTML for cold email. One link maximum; no images or attachments.</li>
          <li>
            Kill trigger phrases (&quot;risk-free&quot;, &quot;act now&quot;, &quot;100%
            free&quot;), ALL-CAPS words, and !!!— filters weigh each one against you.
          </li>
          <li>Under 150 words. Personalized first line. One soft question as the ask.</li>
          <li>
            Always include a working unsubscribe link and honor it — it&apos;s the law
            (CAN-SPAM/GDPR) <i>and</i> it protects you: an unsubscribe click is harmless, a
            spam-button click is poison.
          </li>
        </ul>
        <p>
          Paste any draft into our free{" "}
          <Link href="/tools/spam-checker" className="text-blue-600 underline">
            spam checker
          </Link>{" "}
          — it flags exactly what filters will, in your browser, no signup.
        </p>
      </Section>

      <Section heading="Monitoring: know before your prospects do">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>mail-tester.com</b> — send one email, get a 0–10 score with specifics. Do this
            after any DNS change.
          </li>
          <li>
            <b>Google Postmaster Tools</b> — free domain-reputation dashboard from Gmail itself;
            set it up once you send steadily.
          </li>
          <li>
            <b>Watch your own numbers</b> — a sudden open-rate drop (say 45% → 15%) almost always
            means you slid into spam. Stop, halve volume, re-check DNS, and rebuild.
          </li>
        </ul>
      </Section>

      <Section heading="The 10-point checklist">
        <ul className="list-disc space-y-1 pl-5">
          <li>Separate outreach domain (never your main one)</li>
          <li>SPF record published</li>
          <li>DKIM signing enabled and published</li>
          <li>DMARC at p=none, tightened after 2–3 clean weeks</li>
          <li>MX + reverse-DNS sane (your host usually handles this)</li>
          <li>Warm-up ramp: 10 → 25 → 40 → cap</li>
          <li>Daily cap 25–50 per mailbox, 10–20/hour, business-hours window</li>
          <li>Plain text, ≤1 link, no trigger words, unsubscribe present</li>
          <li>Bounces removed automatically (over ~3% bounce rate kills domains)</li>
          <li>mail-tester 9+ before any real campaign</li>
        </ul>
      </Section>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">
            Or let the platform enforce all ten for you
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Outreach Studio ships with warm-up ramps, caps, windows, spam checks, DNS
            verification, and automatic bounce handling — on by default. Free plan, no card.
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
