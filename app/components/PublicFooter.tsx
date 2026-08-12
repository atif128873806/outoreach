import Link from "next/link";
import { SITE } from "@/lib/site";
import { LogoTile } from "./Logo";

const FOOTER_GROUPS = [
  {
    label: "Product",
    links: [
      ["Features", "/features"],
      ["Product demo", "/demo"],
      ["Pricing", "/pricing"],
      ["Documentation", "/docs"],
    ],
  },
  {
    label: "Resources",
    links: [
      ["All guides", "/guides"],
      ["Cold email deliverability", "/guides/cold-email-deliverability"],
      ["Find business emails", "/guides/find-local-business-emails"],
    ],
  },
  {
    label: "Free tools",
    links: [
      ["Spam checker", "/tools/spam-checker"],
      ["SPF, DKIM & DMARC checker", "/tools/dns-checker"],
    ],
  },
  {
    label: "Company",
    links: [
      ["Contact", "/contact"],
      ["Sign in", "/login"],
      ["Create an account", "/signup"],
    ],
  },
] as const;

export default function PublicFooter() {
  return (
    <footer
      id="site-footer"
      className="border-t border-zinc-800 bg-zinc-950 text-zinc-400"
    >
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-8">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_4fr] lg:gap-10">
          <div className="max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-white"
              aria-label={`${SITE.name} home`}
            >
              <LogoTile className="h-9 w-9" />
              <span className="text-base">{SITE.name}</span>
            </Link>
            <p className="mt-5 text-sm leading-6 text-zinc-400">
              Find qualified businesses, write genuinely personal outreach, and
              follow up at a human pace — from one focused pipeline.
            </p>
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                Responsible outreach by design
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Simulation-first setup, permanent opt-outs, controlled sending,
                and follow-ups that stop when a prospect replies.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:gap-8">
            {FOOTER_GROUPS.map((group) => (
              <nav key={group.label} aria-label={`${group.label} footer links`}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200">
                  {group.label}
                </h2>
                <ul className="mt-5 space-y-3.5 text-sm">
                  {group.links.map(([label, href]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="leading-5 transition-colors hover:text-white"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-zinc-800 pt-7 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
          <div className="leading-5">
            © {new Date().getFullYear()} {SITE.name}. Operated by {SITE.operator}.
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="transition-colors hover:text-zinc-200"
            >
              {SITE.supportEmail}
            </a>
            <Link href="/terms" className="transition-colors hover:text-zinc-200">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-zinc-200">
              Privacy
            </Link>
            <Link
              href="/refund-policy"
              className="transition-colors hover:text-zinc-200"
            >
              Refund policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
