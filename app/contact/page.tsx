import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../components/PublicShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact — ${SITE.name}`,
  description: `Get in touch with the ${SITE.name} team.`,
};

export default function ContactPage() {
  return (
    <PublicShell
      title="Contact us"
      subtitle="Real humans, usually within one business day."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">Support &amp; billing</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Product questions, account help, subscriptions, and refunds.
          </p>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {SITE.supportEmail}
          </a>
          <p className="mt-3 text-xs text-zinc-400">
            We aim to reply within 1 business day (worst case 2).
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">Abuse reports</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Received unwanted email sent through {SITE.name}? Forward it to us — every
            campaign email also carries a one-click unsubscribe link that is enforced
            permanently.
          </p>
          <a
            href={`mailto:${SITE.supportEmail}?subject=Abuse%20report`}
            className="mt-4 inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Report abuse
          </a>
        </div>
      </div>

      <Section heading="Company">
        <p>
          {SITE.name} is operated by {SITE.operator}. Legal documents:{" "}
          <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link>,{" "}
          <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>,{" "}
          <Link href="/refund-policy" className="text-blue-600 underline">Refund Policy</Link>.
        </p>
      </Section>
    </PublicShell>
  );
}
