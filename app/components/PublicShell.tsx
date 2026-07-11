import Link from "next/link";
import { SITE } from "@/lib/site";

/**
 * Shared chrome for public pages (pricing, legal, contact): the same light
 * design language as the landing page, with a consistent header and footer.
 */
export default function PublicShell({
  title,
  subtitle,
  updated,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  /** "Last updated" stamp for legal documents */
  updated?: string;
  /** wide content (pricing grid) vs. narrow reading column (legal text) */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-semibold tracking-tight">
            {SITE.name}
          </Link>
          <nav className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/pricing" className="hover:text-zinc-900">Pricing</Link>
            <Link href="/contact" className="hover:text-zinc-900">Contact</Link>
            <Link href="/login" className="hover:text-zinc-900">Sign in</Link>
            <Link
              href="/signup"
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 font-medium text-white hover:bg-zinc-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className={`mx-auto px-6 py-16 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 text-zinc-500">{subtitle}</p>}
        {updated && <p className="mt-2 text-xs text-zinc-400">Last updated: {updated}</p>}
        <div className="mt-10">{children}</div>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-400 md:flex-row">
          <div>
            <span className="font-semibold text-zinc-600">{SITE.name}</span> · AI outreach
            automation · operated by {SITE.operator}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/pricing" className="hover:text-zinc-600">Pricing</Link>
            <Link href="/terms" className="hover:text-zinc-600">Terms</Link>
            <Link href="/privacy" className="hover:text-zinc-600">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-zinc-600">Refunds</Link>
            <Link href="/contact" className="hover:text-zinc-600">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Reading-typography helpers shared by the legal documents. */
export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-600">{children}</div>
    </section>
  );
}
