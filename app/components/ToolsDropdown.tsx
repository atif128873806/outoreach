import Link from "next/link";
import { isOutreachEnabled } from "@/lib/product";

/**
 * "Free tools" nav item with a pure-CSS hover/focus dropdown (no JS, works in
 * server components). Used in the landing, features, and PublicShell headers.
 *
 * Both tools exist to serve the outreach half — one checks the email you are
 * about to send, the other the DNS records that decide whether it arrives — so
 * with outreach hidden the whole nav item goes, rather than advertising a
 * product this deployment does not sell.
 */
export default function ToolsDropdown() {
  if (!isOutreachEnabled()) return null;

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1 text-muted transition-colors hover:text-ink group-focus-within:text-ink"
        aria-haspopup="true"
      >
        Free tools
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 transition-transform group-hover:rotate-180"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {/* pt-3 bridge keeps hover alive between trigger and panel */}
      <div className="invisible absolute left-1/2 z-50 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl shadow-black/10">
          <Link
            href="/tools/spam-checker"
            className="block rounded-xl px-3.5 py-3 transition-colors hover:bg-canvas"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-surface text-warning">
                ⚠
              </span>
              Email spam checker
            </div>
            <p className="mt-1 pl-9 text-xs leading-relaxed text-muted">
              Paste your email, see what spam filters flag — runs in your browser
            </p>
          </Link>
          <Link
            href="/tools/dns-checker"
            className="block rounded-xl px-3.5 py-3 transition-colors hover:bg-canvas"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-surface text-success">
                ✓
              </span>
              SPF / DKIM / DMARC checker
            </div>
            <p className="mt-1 pl-9 text-xs leading-relaxed text-muted">
              Check the 3 DNS records that decide inbox vs. spam — any domain
            </p>
          </Link>
          <div className="mt-1 border-t border-line px-3.5 py-2.5 text-[11px] text-muted">
            Free · no signup · by LeadBoffin
          </div>
        </div>
      </div>
    </div>
  );
}
