import type { Metadata } from "next";
import PublicShell, { Section } from "../components/PublicShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Refund Policy — ${SITE.name}`,
  description: `Refunds and cancellation for ${SITE.name} subscriptions.`,
};

const UPDATED = "August 9, 2026";

export default function RefundPolicyPage() {
  return (
    <PublicShell
      title="Refund Policy"
      subtitle="Fair and simple: try it risk-free, cancel anytime."
      updated={UPDATED}
    >
      <Section heading="14-day money-back guarantee">
        <p>
          If {SITE.name} Pro isn&apos;t right for you, email{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="text-blue-600 underline">
            {SITE.supportEmail}
          </a>{" "}
          within <b>14 days of your first payment</b> and we&apos;ll refund it in full — no
          questionnaire, no hoops. This applies to your first subscription purchase.
        </p>
      </Section>

      <Section heading="Renewals">
        <p>
          A paid plan renews only under the terms disclosed with its invoice or payment
          request. If a disclosed renewal charge goes through and you meant to cancel,
          contact us within 7 days and we&apos;ll refund it, provided the account saw no
          meaningful use in the new period.
        </p>
      </Section>

      <Section heading="Cancelling">
        <p>
          You can cancel anytime — your plan stays active until the end of the period
          you&apos;ve paid for, and you won&apos;t be charged again. Cancelling doesn&apos;t
          delete your data; downgrading returns you to the free plan&apos;s limits.
        </p>
      </Section>

      <Section heading="How refunds are processed">
        <p>
          Approved refunds are returned through the original payment provider where
          possible. We confirm the expected timing when the refund is approved; bank and
          provider processing times vary. Any refundable taxes collected with the payment
          are returned with it.
        </p>
      </Section>

      <Section heading="Exceptions">
        <p>
          We may decline refunds where the guarantee is being abused (for example repeated
          purchase-and-refund cycles) or where the account violated our{" "}
          <a href="/terms" className="text-blue-600 underline">Terms of Service</a>{" "}
          (for example spam abuse). Statutory consumer rights in your country are not
          affected by this policy.
        </p>
      </Section>
    </PublicShell>
  );
}
