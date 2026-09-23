import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../components/PublicShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Terms of Service — ${SITE.name}`,
  description: `The terms that govern your use of ${SITE.name}.`,
};

const UPDATED = "August 9, 2026";

export default function TermsPage() {
  return (
    <PublicShell
      title="Terms of Service"
      subtitle={`These terms govern your use of ${SITE.name}. By creating an account you agree to them.`}
      updated={UPDATED}
    >
      <Section heading="1. The service">
        <p>
          {SITE.name} (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;) is operated by
          {" "}
          {SITE.operator}. It finds real businesses from live public sources, audits each
          one&apos;s website, and tells you what is wrong with that site and who to contact
          about it.
        </p>
        <p>
          The Service does not send email on your behalf. Where an operator enables the
          optional outreach features, the Service can additionally connect to accounts and
          infrastructure you own — your SMTP mailbox, your IMAP inbox, and your own AI
          provider API keys — to dispatch messages you write, and you remain the sender of
          every message sent that way. On a deployment where those features are not enabled,
          they are neither offered nor available, and nothing on this page depends on them.
        </p>
      </Section>

      <Section heading="2. Your account">
        <p>
          You must provide a valid email address and keep your credentials confidential. You
          are responsible for all activity under your account. You must be at least 18 years
          old and using the Service for business purposes.
        </p>
        <p>
          We may suspend or terminate accounts that violate these terms, abuse the Service,
          or create risk for us or for other users.
        </p>
      </Section>

      <Section heading="3. Acceptable use — anti-spam">
        <p>
          The Service is built for legitimate, targeted business outreach. You agree that
          you will:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            comply with all laws that apply to your messaging, including CAN-SPAM, GDPR,
            PECR, CASL, and equivalent legislation in your recipients&apos; jurisdictions;
          </li>
          <li>
            contact only businesses and professionals for whom you have a lawful basis to
            send commercial messages;
          </li>
          <li>identify yourself truthfully in every message — no false senders, no misleading subject lines;</li>
          <li>honor opt-outs: the Service enforces its unsubscribe list automatically and you must never circumvent it;</li>
          <li>not send content that is illegal, deceptive, fraudulent, or harassing;</li>
          <li>not use purchased, scraped consumer, or otherwise unlawfully obtained contact lists.</li>
        </ul>
        <p>
          We may suspend sending, or the account, immediately when messaging patterns
          indicate spam or abuse (for example unusually high bounce or complaint rates).
        </p>
      </Section>

      <Section heading="4. Plans, billing, and taxes">
        <p>
          The free plan is provided as-is with usage limits (for example a daily cap on
          included AI generations). Paid plans are currently activated manually after we
          confirm the price, payment method, billing period, and any applicable taxes with
          you before payment. Subscription pricing is shown on the{" "}
          <Link href="/pricing" className="text-blue-600 underline">pricing page</Link>{" "}
          and is confirmed again when you request an upgrade.
        </p>
        <p>
          A plan renews only under the terms disclosed with its invoice or payment request.
          You can cancel before the next paid period by contacting support and keep access
          until the end of the period already paid. Refunds are handled per our{" "}
          <Link href="/refund-policy" className="text-blue-600 underline">refund policy</Link>.
        </p>
      </Section>

      <Section heading="5. Your content and data">
        <p>
          You retain all rights to the data you bring — contact lists, campaign briefs,
          messages, and settings. You grant us the limited right to process that data solely
          to operate the Service for you. Handling of personal data is described in the{" "}
          <Link href="/privacy" className="text-blue-600 underline">privacy policy</Link>.
        </p>
        <p>
          For contact data you upload or collect, you are the data controller; we act as a
          processor on your instructions. You are responsible for having a lawful basis to
          process and contact the people on your lists.
        </p>
      </Section>

      <Section heading="6. AI-generated content">
        <p>
          The Service can draft messages with third-party AI models. You review and are
          responsible for every message sent from your account, including AI drafts.
          AI output may contain errors — check claims, numbers, and names before sending.
        </p>
      </Section>

      <Section heading="7. Third-party services">
        <p>
          The Service interoperates with services you configure: your email provider (SMTP/
          IMAP), AI providers (such as Anthropic or Groq), and lead-data sources. Your use of
          those services is governed by their own terms, and outages or changes on their side
          are outside our control.
        </p>
      </Section>

      <Section heading="8. Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;. We do not
          warrant uninterrupted operation, that emails will reach any particular inbox, or
          any specific business outcome. Deliverability depends heavily on factors we don&apos;t
          control, including your domain reputation and recipient mail servers.
        </p>
      </Section>

      <Section heading="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, our total liability arising out of or
          related to the Service is limited to the amount you paid us in the twelve months
          before the claim, and we are not liable for indirect, incidental, special, or
          consequential damages, or for lost profits, revenue, or data.
        </p>
      </Section>

      <Section heading="10. Termination">
        <p>
          You may delete your account at any time by contacting support. We may terminate or
          suspend access for breach of these terms. Sections that by their nature should
          survive termination (including limitations of liability) survive.
        </p>
      </Section>

      <Section heading="11. Changes to these terms">
        <p>
          We may update these terms as the Service evolves. For material changes we will
          give notice (for example by email or an in-app notice) before they take effect.
          Continued use after the effective date constitutes acceptance.
        </p>
      </Section>

      <Section heading="12. Contact">
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="text-blue-600 underline">
            {SITE.supportEmail}
          </a>
          .
        </p>
      </Section>
    </PublicShell>
  );
}
