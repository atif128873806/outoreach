import type { Metadata } from "next";
import Link from "next/link";
import PublicShell, { Section } from "../../components/PublicShell";
import DnsCheckerClient from "./DnsCheckerClient";

export const metadata: Metadata = {
  title: "Free SPF, DKIM & DMARC Checker — test your email domain",
  description:
    "Check whether your domain has the SPF, DKIM, and DMARC records that decide if your email lands in the inbox or in spam. Instant results with fix-it advice. Free, no signup.",
};

export default function DnsCheckerPage() {
  return (
    <PublicShell
      title="SPF, DKIM & DMARC checker"
      subtitle="The three DNS records that decide whether your email reaches the inbox. Check any domain — free, instant, no signup."
    >
      <DnsCheckerClient />

      {/* conversion banner */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">
            Records missing? Outreach Studio walks you through fixing them
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Then sends your outreach at a safe pace with warm-up, caps, and send windows built in.
          </p>
        </div>
        <Link
          href="/signup"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
        >
          Start free
        </Link>
      </div>

      <Section heading="What are SPF, DKIM, and DMARC?">
        <p>
          <b>SPF</b> lists which servers may send email for your domain.{" "}
          <b>DKIM</b> cryptographically signs each message so receivers can
          verify it wasn&apos;t forged. <b>DMARC</b> tells receivers what to do
          when a message fails those checks. Gmail and Outlook treat mail from
          domains without them as suspicious — often sending it straight to
          spam, no matter how good the content is.
        </p>
      </Section>

      <Section heading="How to fix a failing check">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>SPF:</b> add a TXT record on your root domain. Your email host&apos;s
            docs give the exact value — it looks like{" "}
            <code className="rounded bg-zinc-100 px-1 text-[13px]">v=spf1 a mx include:… ~all</code>.
          </li>
          <li>
            <b>DKIM:</b> enable signing in your email panel (cPanel: Email
            Deliverability; Google Workspace: Admin → Gmail → Authenticate),
            then publish the key it gives you as a TXT record.
          </li>
          <li>
            <b>DMARC:</b> add a TXT record on <code className="rounded bg-zinc-100 px-1 text-[13px]">_dmarc.yourdomain.com</code>{" "}
            starting with{" "}
            <code className="rounded bg-zinc-100 px-1 text-[13px]">v=DMARC1; p=none;</code>{" "}
            — tighten the policy once your own mail passes.
          </li>
          <li>
            Records can take 15–60 minutes to propagate — re-check after saving.
          </li>
        </ul>
      </Section>

      <Section heading="Authentication is half the battle">
        <p>
          Perfect DNS won&apos;t save spammy content, and great content
          won&apos;t save an unauthenticated domain. Run your email copy through
          our free{" "}
          <Link href="/tools/spam-checker" className="text-blue-600 underline">
            spam checker
          </Link>{" "}
          too — then send at a human pace with daily caps and warm-up, which is
          exactly what Outreach Studio automates.
        </p>
      </Section>
    </PublicShell>
  );
}
