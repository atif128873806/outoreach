import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../components/PublicShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy Policy — ${SITE.name}`,
  description: `How ${SITE.name} collects, uses, and protects data.`,
};

const UPDATED = "August 9, 2026";

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
          (your account), we are the data controller. For personal data in the business
          leads you collect — and in the contact lists you upload, where the optional
          outreach features are enabled — you are the controller and we process it on your
          behalf. Contact:{" "}
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
            <b>Workspace data</b> — the leads and contacts you discover or save, the
            searches you run, and any messages you generate (or, where outreach is enabled
            on your deployment, send) and their replies and statistics.
          </li>
          <li>
            <b>Connection credentials</b> — API keys you choose to store, and SMTP/IMAP
            passwords if outreach is enabled. These are encrypted at rest (AES-256-GCM) and
            never returned to the browser once saved.
          </li>
          <li>
            <b>Engagement signals</b> — where outreach is enabled, opens, link clicks,
            replies, bounces and unsubscribes for emails you send, so you can see results.
            This deployment sends no email, so it records none of this.
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
          <li>
            to operate the product: run your searches, fetch each business&apos;s public
            details, audit its website, and — where outreach is enabled — send your
            campaigns, poll your inbox for replies and show statistics;
          </li>
          <li>to generate message drafts via the AI provider configured for your account;</li>
          <li>to send transactional email (welcome, email verification, password reset);</li>
          <li>to protect the Service: rate limiting, abuse prevention, enforcing usage limits;</li>
          <li>to respond when you contact support.</li>
        </ul>
      </Section>

      <Section heading="4. Third parties that process data">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Public data sources</b> — the businesses returned by a search come from open
            map data (OpenStreetMap), the official UK company register, and a web-search
            provider that reads publicly published business pages. Nothing about you is sent
            to them beyond the niche and location you typed.
          </li>
          <li>
            <b>AI providers</b> (Anthropic, Groq) — receive the briefs and business details
            needed to draft a message. With your own API key, your provider relationship
            applies; with the included AI, requests go through our key.
          </li>
          <li>
            <b>Your email provider</b> — where outreach is enabled, messages are sent
            through the SMTP server you connect and replies are read from the IMAP inbox you
            connect. This deployment does not connect to a mailbox.
          </li>
          <li>
            <b>Payment providers</b> — if you purchase a paid plan, the provider and its
            privacy terms are disclosed before payment. Card or bank details are processed
            by that provider; we do not store full card numbers.
          </li>
          <li>
            <b>Hosting</b> — the application and database run on servers we rent in the EU.
          </li>
        </ul>
      </Section>

      <Section heading="5. Business contacts in your leads">
        <p>
          The leads this Service returns are businesses, and the contact details on them are
          the ones those businesses publish publicly. We do not sell personal data and we do
          not compile consumer lists. Where outreach is enabled and you send to those
          contacts, you are the sender: every message carries a one-click unsubscribe link,
          opting out is enforced permanently and automatically, and you may not remove or
          work around it. If you received unwanted contact that references {SITE.name},
          contact us at{" "}
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
