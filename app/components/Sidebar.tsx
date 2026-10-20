"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { LogoMark } from "./Logo";
import Icon, {type IconName} from "./Icon";
import { SITE } from "@/lib/site";

/**
 * The product is one feature: find businesses that need you, with the proof.
 * Everything else lives behind `outreachEnabled` and is unlinked by default.
 */
const PRODUCT_NAV = [
  { href: "/leads", label: "Find leads", icon: "search" },
  { href: "/watches", label: "New businesses", icon: "plus" },
  { href: "/contacts", label: "My leads", icon: "leads" },
  { href: "/billing", label: "Plan & usage", icon: "plan" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/docs", label: "Help & docs", icon: "help" },
];

/** The full app, shown only when a deployment opts back into outreach. */
const OUTREACH_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/leads", label: "Find leads", icon: "search" },
  { href: "/contacts", label: "My leads", icon: "leads" },
  { href: "/campaigns", label: "Campaigns", icon: "mail" },
  { href: "/messages", label: "Message Center", icon: "mail" },
  { href: "/billing", label: "Plan & Usage", icon: "plan" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/docs", label: "Help & Docs", icon: "help" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  const menuToggle=useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Defaults to the single-feature product until the server says otherwise.
  const [outreachEnabled, setOutreachEnabled] = useState(false);
  /** Parked, so it defaults to hidden and only the server can reveal it. */
  const [newBusinessesEnabled, setNewBusinessesEnabled] = useState(false);
  /**
   * How many new businesses are waiting, read from the stored counter rather
   * than the register — a badge is not worth a request to a shared quota on
   * every page load, and /api/watches answers from rows a check already wrote.
   */
  const [unseen, setUnseen] = useState(0);

  const onAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (onAuthPage) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setEmail(d?.user?.email ?? null);
        setIsAdmin(Boolean(d?.user?.isAdmin));
        setOutreachEnabled(Boolean(d?.outreachEnabled));
        setNewBusinessesEnabled(Boolean(d?.newBusinessesEnabled));
      })
      .catch(() => {});
  }, [onAuthPage, pathname]);

  // The count refreshes on navigation, so the badge drops the moment the user
  // has actually looked at the digest rather than on the next reload.
  useEffect(() => {
    // No badge for a hidden feature: while it is parked the API answers 404, and
    // asking anyway would be one pointless request on every navigation.
    if (onAuthPage || !newBusinessesEnabled) return;
    fetch("/api/watches")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUnseen(Number(d?.unseen ?? 0)))
      .catch(() => {});
  }, [onAuthPage, pathname, newBusinessesEnabled]);

  // ...and immediately when the digest page itself clears the count, since a
  // badge that keeps its number on the page that just emptied it reads as a bug.
  useEffect(() => {
    const cleared = () => setUnseen(0);
    window.addEventListener("watches:seen", cleared);
    return () => window.removeEventListener("watches:seen", cleared);
  }, []);

  // "New businesses" is parked: it stays in PRODUCT_NAV so re-enabling is one
  // env var, but the nav it is filtered out of until the server says otherwise,
  // and the default is the hidden state on purpose — a link that appears before
  // the flag has been read is a link to a redirect.
  const nav = outreachEnabled
    ? OUTREACH_NAV
    : PRODUCT_NAV.filter((item) => item.href !== "/watches" || newBusinessesEnabled);

  if (onAuthPage) return null; // auth screens are full-width

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="workspace-nav flex w-full shrink-0 flex-col bg-canvas text-muted lg:sticky lg:top-0 lg:h-screen lg:w-56" onKeyDown={e=>{if(e.key==='Escape'&&menuOpen){setMenuOpen(false);menuToggle.current?.focus();}}}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 lg:px-6 lg:py-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7 shrink-0" />
          <div>
            <div className="text-ink font-semibold text-lg tracking-tight leading-tight">
              {SITE.name}
            </div>
            <div className="text-xs text-muted">
              {outreachEnabled ? "AI outreach automation" : "Lead intelligence"}
            </div>
          </div>
        </div>
        <button ref={menuToggle} type="button" aria-expanded={menuOpen} aria-controls="product-navigation" aria-label={menuOpen?'Close workspace navigation':'Open workspace navigation'} onClick={()=>setMenuOpen(!menuOpen)} className="rounded-lg border border-field p-2.5 text-ink lg:hidden"><Icon name={menuOpen?'close':'menu'}/></button>
      </div>
      <nav id="product-navigation" aria-label="Product navigation" className={`${menuOpen?'block':'hidden'} space-y-1 px-3 py-3 lg:block lg:flex-1 lg:py-4`}>
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={()=>setMenuOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                active
                  ? "bg-raised text-ink font-medium"
                  : "hover:bg-raised hover:text-ink"
              }`}
            >
              <Icon name={item.icon as IconName} className="h-5 w-5 shrink-0"/>
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              {item.href === "/watches" && unseen > 0 && (
                <span
                  className="rounded-full bg-accent-action px-1.5 py-0.5 text-[10px] font-semibold text-ink"
                  title={`${unseen} new ${unseen === 1 ? "business" : "businesses"}`}
                >
                  {unseen > 99 ? "99+" : unseen}
                </span>
              )}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
              pathname.startsWith("/admin")
                ? "bg-raised text-ink font-medium"
                : "hover:bg-raised hover:text-ink"
            }`}
          >
            <Icon name="shield" className="h-5 w-5"/>
            Admin
          </Link>
        )}
      </nav>
      <div className={`${menuOpen?"flex":"hidden"} min-w-0 items-center justify-between gap-4 border-t border-line px-6 py-4 lg:block`}>
        {email && (
          <div className="flex min-w-0 items-center gap-1.5 lg:mb-1.5">
            <span className="truncate text-xs text-muted" title={email}>
              {email}
            </span>
            {isAdmin && (
              <span className="shrink-0 rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium text-muted">
                owner
              </span>
            )}
          </div>
        )}
        <button
          onClick={signOut}
          className="shrink-0 text-xs text-muted hover:text-ink transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
