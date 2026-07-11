import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../components/PublicShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy Policy — ${SITE.name}`,
  description: `How ${SITE.name} collects, uses, and protects data.`,
};

const UPDATED = "July 11, 2026";

export default function PrivacyPage() {
  return (
    <PublicShell
      title="Privacy Policy"
      subtitle={`How ${SITE.name} handles your data — plainly, without legal fog.`}
      updated={UPDATED}
    >
      <Section heading="1. Who we are">
        <p>
          {SITE.name} is operated by {SITE.operator}. For data you give us about yourself
          (your account), we are the data controller. For contact data you upload to run
          campaigns, you are the controller and we process it on your behalf. Contact:{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="text-blue-600 underline">
            {SITE.supportEmail}
          </a>
          .
        </p>
      </Section>

      <Section heading="2. Data we collect">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Account data</b> — your name, email address, and a salted hash of your
            password (we can never read the password itself).
          </li>
          <li>
            <b>Workspace data</b> — contacts you import or discover, campaigns, generated
            messages, replies, and campaign statistics.
          </li>
          <li>
            <b>Connection credentials</b> — SMTP/IMAP passwords and API keys you choose to
            store. These are encrypted at rest (AES-256-GCM) and never returned to the
            browser once saved.
          </li>
          <li>
            <b>Engagement signals</b> — opens, link clicks, replies, bounces, and
            unsubscribes for emails you send, so you can see campaign results.
          </li>
          <li>
            <b>Technical basics</b> — IP addresses in server logs and rate-limit records,
            kept briefly for security.
          </li>
        </ul>
        <p>We do not sell data or run third-party advertising or analytics trackers.</p>
      </Section>

      <Section heading="3. How we use data">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>to operate the product: send your campaigns, poll your inbox for replies, show statistics;</li>
          <li>to generate message drafts via the AI provider configured for your account;</li>
          <li>to send transactional email (welcome, email verification, password reset);</li>
          <li>to protect the Service: rate limiting, abuse prevention, enforcing sending limits;</li>
          <li>to respond when you contact support.</li>
        </ul>
      </Section>

      <Section heading="4. Third parties that process data">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>AI providers</b> (Anthropic, Groq) — receive campaign briefs and contact
            business details to draft messages. With your own API key, your provider
            relationship applies; with the included AI, requests go through our key.
          </li>
          <li>
            <b>Your email provider</b> — messages are sent through the SMTP server you
            connect; replies are read from the IMAP inbox you connect.
          </li>
          <li>
            <b>Paddle</b> — our merchant of record for paid plans. Paddle processes payment
            details; we never see your full card number.
          </li>
          <li>
            <b>Hosting</b> — the application and database run on servers we rent in the EU.
          </li>
        </ul>
      </Section>

      <Section heading="5. Recipients of your campaigns">
        <p>
          If you received an email sent with {SITE.name}: the sender chose and controls your
          contact information — we process it for them. Every campaign email carries an
          unsubscribe link; opting out is enforced permanently and automatically. To raise a
          concern about a sender, contact us at{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="text-blue-600 underline">
            {SITE.supportEmail}
          </a>{" "}
          and we will investigate.
        </p>
      </Section>

      <Section heading="6. Cookies">
        <p>
          We use one strictly necessary cookie: your session (an HMAC-signed token that
          keeps you logged in for 30 days). No advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section heading="7. Retention and deletion">
        <p>
          Your data is kept while your account is active. Deleting your account removes your
          contacts, campaigns, messages, settings, and credentials from the live database.
          Server backups age out on a rolling schedule. To request deletion or a copy of
          your data, email{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="text-blue-600 underline">
            {SITE.supportEmail}
          </a>
          .
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          Passwords are hashed with scrypt; stored credentials are encrypted with
          AES-256-GCM; the Service runs over HTTPS; access to production systems is limited
          to the operator. No internet service can promise perfect security, but security
          decisions in {SITE.name} err on the conservative side.
        </p>
      </Section>

      <Section heading="9. Your rights">
        <p>
          Depending on where you live (e.g. GDPR, UK GDPR, CCPA), you may have rights to
          access, correct, export, or delete your personal data, and to object to or
          restrict processing. Email us and we will honor these requests for the data we
          control. For contact data uploaded by one of our users, we will refer the request
          to that user, as they are the controller.
        </p>
      </Section>

      <Section heading="10. Changes">
        <p>
          We will post updates here and, for material changes, notify you by email or
          in-app. See also our{" "}
          <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link>.
        </p>
      </Section>
    </PublicShell>
  );
}
