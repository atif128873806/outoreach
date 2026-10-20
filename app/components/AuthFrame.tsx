"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";
import { LogoTile } from "./Logo";
import Icon from "./Icon";

export default function AuthFrame({children}: {children: React.ReactNode}) {
  const admin = usePathname().startsWith("/admin");
  const brand = <Link href="/" aria-label={`${SITE.name} home`} className="flex items-center gap-3 text-lg font-semibold text-ink"><LogoTile className="h-8 w-8"/>{SITE.name}</Link>;
  return <main id="main-content" className="auth-layout"><aside className="auth-context">{brand}<div><h2>{admin ? <>See what&apos;s happening.<br />Understand why.</> : <>A better list starts<br />with a closer look.</>}</h2><p>{admin ? "A separate workspace for recorded search activity, source performance, errors and the London pilot." : "Research London businesses, inspect available website evidence and build a shortlist for the work you do."}</p><div className="auth-flow">{(admin ? [["leads", "Recorded user & search activity"], ["settings", "Queue, cache & error visibility"], ["shield", "Separate administrator access"]] : [["search", "Search a business type and area"], ["shield", "Review details and dated findings"], ["leads", "Keep the businesses that fit"]]).map(([icon,label])=><div key={label}><Icon name={icon as "search"|"shield"|"leads"|"settings"}/><span>{label}</span></div>)}</div></div><p className="text-xs leading-6 text-muted">{admin ? "Operational records reflect recorded activity and retention limits." : "Public-source coverage varies. Check the evidence before approaching a business."}</p></aside><div className="auth-content"><div className="auth-mobile-brand">{brand}</div>{children}<div className="mt-9 flex flex-wrap justify-center gap-6 text-xs text-muted"><Link href="/" className="hover:text-ink">Back to website</Link><Link href="/privacy" className="hover:text-ink">Privacy</Link><Link href="/contact" className="hover:text-ink">Need help?</Link></div></div></main>;
}
