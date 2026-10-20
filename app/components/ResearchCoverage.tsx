import Link from "next/link";
import Icon from "./Icon";

export default function ResearchCoverage() {
  return <section className="coverage-section page-width" aria-labelledby="coverage-title">
    <div className="coverage-intro"><h2 id="coverage-title" className="display-heading">Know where<br />the details come from.</h2><p className="marketing-copy">Three ways to research a business. Clear source coverage and dated website findings help you judge what is useful.</p><Link href="/docs#freshness" className="text-link">Understand sources & freshness<Icon name="arrow" className="h-4 w-4" /></Link></div>
    <dl className="coverage-ledger">{[
      ["OpenStreetMap", "Local business listings", "Public map records by business type and location. The limited live sample uses this source."],
      ["Web discovery", "Websites & public contact routes", "Research business websites and available contact details. Coverage varies by business and search."],
      ["Companies House", "Official UK company records", "Available on Pro with the No website filter. A registered office may differ from the trading address."],
    ].map(([source, title, description]) => <div key={source}><dt><strong>{source}</strong><span>{title}</span></dt><dd>{description}</dd></div>)}</dl>
  </section>;
}
