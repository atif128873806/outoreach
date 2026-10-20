import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import ToolsDropdown from "./ToolsDropdown";

export default function PublicShell({ title, subtitle, updated, wide = false, children }: {
  title: string; subtitle?: string; updated?: string; wide?: boolean; children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-canvas text-ink antialiased">
    <PublicHeader tools={<ToolsDropdown />} />
    <main id="main-content" className={`public-reading ${wide ? "page-width" : "reading-width"}`}>
      <div className="public-reading-header"><h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{subtitle}</p>}
        {updated && <p className="mt-3 text-xs text-muted">Last updated: {updated}</p>}
      </div>{children}
    </main><PublicFooter />
  </div>;
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return <section className="reading-section mt-12 first:mt-0"><h2 className="text-lg font-semibold tracking-tight">{heading}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-muted">{children}</div></section>;
}
