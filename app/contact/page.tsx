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
        <div className="rounded-2xl border border-line p-6">
          <h2 className="font-semibold">Support &amp; billing</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Product questions, account help, subscriptions, and refunds.
          </p>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="mt-4 inline-block rounded-lg bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-action-hover"
          >
            {SITE.supportEmail}
          </a>
          <p className="mt-3 text-xs text-muted">
            We aim to reply within 1 business day (worst case 2).
          </p>
        </div>

        <div className="rounded-2xl border border-line p-6">
          <h2 className="font-semibold">Abuse reports</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Received unwanted contact that references {SITE.name}? Forward it to us. This
            service finds publicly listed business details — it does not send email on
            anyone&apos;s behalf — so whatever reached you came from a user&apos;s own mailbox.
            We investigate every report, and using the data to harass businesses is a
            terms violation we enforce.
          </p>
          <a
            href={`mailto:${SITE.supportEmail}?subject=Abuse%20report`}
            className="mt-4 inline-block rounded-lg border border-field px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
          >
            Report abuse
          </a>
        </div>
      </div>

      <Section heading="Company">
        <p>
          {SITE.name} is operated by {SITE.operator}. Legal documents:{" "}
          <Link href="/terms" className="text-accent underline">Terms of Service</Link>,{" "}
          <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>,{" "}
          <Link href="/refund-policy" className="text-accent underline">Refund Policy</Link>.
        </p>
      </Section>
    </PublicShell>
  );
}
