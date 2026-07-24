import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../../components/PublicShell";
import SpamCheckerClient from "./SpamCheckerClient";

export const metadata: Metadata = {
  title: "Free Email Spam Checker — test your cold email before sending",
  description:
    "Paste your subject line and email body and get an instant spam-filter check: trigger words, ALL CAPS, punctuation abuse, link count, and more. Free, no signup, runs in your browser.",
};

export default function SpamCheckerPage() {
  return (
    <PublicShell
      title="Email spam checker"
      subtitle="Paste your email, get an instant read on what spam filters will think — free, no signup, and nothing you type leaves your browser."
    >
      <SpamCheckerClient />

      {/* conversion banner */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">
            Outreach Studio runs this check on every email — automatically
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Plus AI that writes clean, personal cold emails in the first place. Free plan, no card.
          </p>
        </div>
        <Link
          href="/signup"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
        >
          Try it free
        </Link>
      </div>

      <Section heading="What this tool checks">
        <p>
          The same lint Outreach Studio runs before any campaign sends: known
          spam-trigger phrases (&quot;act now&quot;, &quot;risk-free&quot;,
          &quot;100% free&quot;…), exclamation-mark and ALL-CAPS abuse, repeated
          punctuation, link count, subject-line length, and money amounts in the
          subject. Each is a pattern real spam filters weigh against you.
        </p>
      </Section>

      <Section heading="Why cold emails land in spam">
        <p>
          Three things decide inbox placement: your domain&apos;s authentication
          (SPF, DKIM, DMARC — check yours with our{" "}
          <Link href="/tools/dns-checker" className="text-blue-600 underline">
            free DNS checker
          </Link>
          ), your sending behavior (volume, pace, bounce rate), and your content
          — which is what this tool checks. Clean content won&apos;t save an
          unauthenticated domain, but spammy content can sink a perfectly
          authenticated one.
        </p>
      </Section>

      <Section heading="Quick rules for cold email that deliver">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Under 150 words, plain text, one link at most</li>
          <li>No trigger phrases — write like you&apos;d write to a colleague</li>
          <li>Personalize genuinely: their business, their industry, their problem</li>
          <li>One clear, low-friction ask (a reply beats a booking link)</li>
          <li>Always include a working unsubscribe option</li>
          <li>
            The full playbook — authentication, warm-up, volume, monitoring — is in the{" "}
            <Link href="/guides/cold-email-deliverability" className="text-blue-600 underline">
              deliverability guide
            </Link>
            .
          </li>
        </ul>
      </Section>
    </PublicShell>
  );
}
