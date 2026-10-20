"use client";

import { useId, useState } from "react";
import Icon from "./Icon";

const businesses = [
  { name: "Marlow Dental", area: "Croydon", category: "Dental practice", website: "marlow.example.test", finding: "Homepage link returns an error", detail: "The example appointment link returns HTTP 404. Confirm the current page before approaching the business.", status: "Needs review" },
  { name: "Fern & Field", area: "Greenwich", category: "Florist", website: "fern.example.test", finding: "Website could not be checked", detail: "An automated visit could not verify this example website. An unavailable audit is not proof of a broken site.", status: "Not verified" },
  { name: "Northline Studio", area: "Islington", category: "Fitness studio", website: "northline.example.test", finding: "No serious issue in this example", detail: "The example homepage was reachable. A passing check does not establish that every page or feature works.", status: "Checked" },
] as const;
const steps = ["Search", "Audit", "Shortlist"] as const;

/** A labelled product explanation. No real records, provider requests or account actions. */
export default function ProductStory({ initialStep = 0 }: { initialStep?: number }) {
  const id = useId();
  const [step, setStep] = useState(initialStep);
  const [record, setRecord] = useState(0);
  const business = businesses[record];
  return <figure className="product-story" data-depth="3">
    <figcaption className="story-caption"><span>Illustrative workflow</span><span>Fictional businesses</span></figcaption>
    <div className="story-chrome" data-depth="4"><span className="flex items-center gap-2"><Icon name="leads" className="h-4 w-4 text-accent" />Business research</span><span className="story-location"><Icon name="map" className="h-3.5 w-3.5" />London, UK</span></div>
    <div className="story-query"><div><span>Business type</span><strong>Local businesses</strong></div><div><span>Area</span><strong>London</strong></div><span className="story-source">Public-source workflow</span></div>
    <div className="story-steps" aria-label="Explore the illustrative workflow">
      {steps.map((label, index) => <button key={label} type="button" aria-pressed={step === index} aria-controls={`${id}-scene`} onClick={() => setStep(index)}><Icon name={index === 0 ? "search" : index === 1 ? "shield" : "check"} className="h-4 w-4" />{label}</button>)}
    </div>
    <div id={`${id}-scene`} className={`story-scene story-scene-${step}`} data-depth="0">
      <div className="story-results"><div className="story-column-heading"><span>Business & area</span><span>Website finding</span></div>
        {businesses.map((item, index) => <button type="button" key={item.name} aria-pressed={record === index} onClick={() => { setRecord(index); setStep(1); }} className={`story-row ${record === index ? "is-current" : ""}`}>
          <span className="story-business"><span className="story-monogram" aria-hidden="true">{item.name.slice(0, 1)}</span><span><strong>{item.name}</strong><small>{item.category} · {item.area}</small></span></span>
          <span className={`story-status story-status-${index}`}>{step === 2 && index === 0 ? <><Icon name="check" className="h-3.5 w-3.5" />Selected</> : item.status}</span>
        </button>)}
      </div>
      <div key={`${step}-${record}`} className="story-inspector" data-depth="4" aria-live="polite">
        {step === 0 ? <><Icon name="search" className="h-6 w-6 text-accent" /><h3>Your niche.<br />Your neighbourhood.</h3><p>Compare business details before deciding which record deserves a closer look.</p><span className="story-note">Choose a business above to explore its example.</span></> : step === 1 ? <><div className="story-inspector-top"><Icon name="shield" className="h-5 w-5 text-accent" /><span>Example website finding</span></div><h3>{business.finding}</h3><p>{business.detail}</p><span className="story-note">{business.website}<br />Illustrative dated audit · not a live check</span></> : <><Icon name="check" className="h-6 w-6 text-success" /><h3>A list you<br />can work with.</h3><p>Keep the businesses that fit. Inside your account, export a shortlist or save eligible contacts.</p><span className="story-note">Selection shown for illustration. No data is saved or exported here.</span></>}
      </div>
    </div>
    <div className="story-footer"><span>{step === 2 ? "1 example business selected" : "3 example businesses"}</span><span>{step === 1 ? "Evidence, with context" : step === 2 ? "Ready to qualify" : "Choose a record to inspect"}<Icon name="arrow" className="h-3.5 w-3.5" /></span></div>
  </figure>;
}
