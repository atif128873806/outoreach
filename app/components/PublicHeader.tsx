"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { SITE } from "@/lib/site";
import { LogoTile } from "./Logo";
import PilotSignupLink from "./PilotSignupLink";
import Icon from "./Icon";

const links = [["Product", "/features"], ["Live sample", "/demo"], ["Plans", "/pricing"], ["Help", "/docs"]] as const;

export default function PublicHeader({ tools }: { tools?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); }
  return (
    <header className="public-header sticky top-0 z-40 border-b border-line bg-canvas" onKeyDown={e => {
      if (e.key === "Escape" && open) { close(); toggle.current?.focus(); }
    }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="public-header-inner flex min-h-20 items-center justify-between gap-5">
        <Link href="/" aria-label={`${SITE.name} home`} onClick={close} className="flex shrink-0 items-center gap-3 text-lg font-semibold tracking-tight text-ink">
          <LogoTile className="h-7 w-7" />{SITE.name}
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm lg:flex">
          {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "font-medium text-accent" : "text-muted hover:text-ink"}>{label}</Link>)}
          {tools}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/login" className="text-sm font-medium text-muted hover:text-ink">Sign in</Link>
          <PilotSignupLink className="ui-primary">Get started</PilotSignupLink>
        </div>
        <button ref={toggle} type="button" aria-expanded={open} aria-controls="public-mobile-nav" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)} className="ui-secondary !p-2.5 lg:hidden"><Icon name={open ? "close" : "menu"} /></button>
      </div>
      {open && <nav id="public-mobile-nav" aria-label="Mobile navigation" className="border-t border-line px-5 pb-5 pt-2 lg:hidden">
        {links.map(([label, href]) => <Link key={href} href={href} onClick={close} aria-current={pathname === href ? "page" : undefined} className={`block rounded-lg px-3 py-3 text-sm ${pathname === href ? "bg-raised font-medium text-ink" : "text-muted hover:bg-canvas"}`}>{label}</Link>)}
        <div className="mt-3 flex justify-between gap-3 border-t border-line pt-4"><Link href="/login" onClick={close} className="ui-secondary">Sign in</Link><PilotSignupLink onClick={close} className="ui-primary">Get started</PilotSignupLink></div>
      </nav>}
    </header>
  );
}
