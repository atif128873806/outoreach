import Link from "next/link";
import { SITE } from "@/lib/site";
import { isOutreachEnabled } from "@/lib/product";
import { LogoTile } from "./Logo";

/**
 * Links that only make sense while the outreach half is on. The guide and the
 * two email tools are marketing for campaigns and sending, so with those hidden
 * they would be the footer of a different product — see OUTREACH_PREFIXES.
 */
const OUTREACH_LINKS = new Set([
  "/guides/cold-email-deliverability",
  "/tools/spam-checker",
  "/tools/dns-checker",
]);

const FOOTER_GROUPS = [
  {
    label: "Product",
    links: [
      ["Features", "/features"],
      ["Live sample", "/demo"],
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
  const outreach = isOutreachEnabled();
  // Groups are dropped only when every link in them is gone, so "Free tools"
  // disappears rather than rendering as an empty heading.
  const groups = FOOTER_GROUPS.map((g) => ({
    label: g.label,
    links: g.links.filter(([, href]) => outreach || !OUTREACH_LINKS.has(href)),
  })).filter((g) => g.links.length > 0);

  return (
    <footer
      id="site-footer"
      className="border-t border-line bg-canvas text-muted"
    >
      <div className="page-width pt-16 pb-8">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_4fr] lg:gap-10">
          <div className="max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink"
              aria-label={`${SITE.name} home`}
            >
              <LogoTile className="h-9 w-9" />
              <span className="text-2xl">{SITE.name}</span>
            </Link>
            <p className="mt-5 text-sm leading-6 text-muted">
              Find London businesses from public sources, review available website
              findings, and qualify a shortlist for your own outreach. Matching
              fresh records can be reused from cache.
            </p>
            <div className="mt-6 border-t border-line pt-5">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                Evidence, not guesses
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                Review the dated evidence and source coverage, then confirm an
                issue before quoting it to a business owner.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:gap-8">
            {groups.map((group) => (
              <nav key={group.label} aria-label={`${group.label} footer links`}>
                <h2 className="text-sm font-medium text-ink">
                  {group.label}
                </h2>
                <ul className="mt-5 space-y-3.5 text-sm">
                  {group.links.map(([label, href]: readonly [string, string]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="leading-5 transition-colors hover:text-ink"
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

        <div className="mt-14 flex flex-col gap-5 border-t border-line pt-7 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <div className="leading-5">
            © {new Date().getFullYear()} {SITE.name}. Operated by {SITE.operator}.
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="transition-colors hover:text-ink"
            >
              {SITE.supportEmail}
            </a>
            <Link href="/terms" className="transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link
              href="/refund-policy"
              className="transition-colors hover:text-ink"
            >
              Refund policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
