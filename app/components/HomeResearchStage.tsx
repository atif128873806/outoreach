"use client";

import { useId, useState } from "react";
import Icon from "./Icon";

const records = [
  { name: "Marlow Dental", category: "Dental practice", area: "Croydon", website: "marlow.example.test", status: "Needs review", finding: "Homepage link returns an error", detail: "The example appointment link returns HTTP 404. Confirm the current page before approaching the business." },
  { name: "Fern & Field", category: "Florist", area: "Greenwich", website: "fern.example.test", status: "Not verified", finding: "Website could not be checked", detail: "An automated visit could not verify this example website. An unavailable audit is not proof of a broken site." },
  { name: "Northline Studio", category: "Fitness studio", area: "Islington", website: "northline.example.test", status: "Checked", finding: "No serious issue in this example", detail: "The example homepage was reachable. A passing check does not establish that every page or feature works." },
] as const;

/** Fictional workflow. No account action or provider call. */
export default function HomeResearchStage() {
  const sceneId = useId();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(0);
  const record = records[selected];
  function inspect(index: number) {
    setSelected(index);
    setStep(1);
  }

  return <figure className="home-research-stage" data-depth="3">
    <figcaption className="research-stage-caption"><span>Illustrative workflow</span><span>Fictional businesses</span></figcaption>
    <div className="research-stage-bar"><span><Icon name="leads" />London business research</span><div className="research-stage-steps" role="group" aria-label="Explore the illustrative workflow">
      {["Search", "Audit", "Shortlist"].map((label, index) => <button key={label} type="button" aria-pressed={step === index} aria-controls={sceneId} onClick={() => setStep(index)}><Icon name={index === 0 ? "search" : index === 1 ? "shield" : "check"} className="h-4 w-4" />{label}</button>)}
    </div></div>
    <div className="research-stage-body" id={sceneId}>
      <div className="stage-records" data-depth="4">
        <div className="stage-query"><span>Business type<strong>Local businesses</strong></span><span>Area<strong>London, UK</strong></span></div>
        <div className="stage-records-heading"><span>Business & area</span><span>Website finding</span></div>
        {records.map((item, index) => <button key={item.name} type="button" aria-pressed={selected === index} aria-controls={sceneId} onClick={() => inspect(index)} className={`stage-record ${selected === index ? "is-selected" : ""}`}><span className="stage-business-mark" aria-hidden="true">{step === 2 && index === selected ? <Icon name="check" /> : item.name.charAt(0)}</span><span className="stage-business-name"><strong>{item.name}</strong><small>{item.category}<br />{item.area}</small></span><span className={`stage-record-status stage-record-status-${index}`}>{step === 2 && index === selected ? "Selected" : item.status}</span><Icon name="arrow" className="stage-record-arrow h-4 w-4" /></button>)}
        <div className="stage-records-bottom"><Icon name="leads" className="h-4 w-4" /><span>{step === 2 ? "1 example business selected" : "3 example businesses"}</span><span>Public-source workflow</span></div>
      </div>
      <div className="stage-evidence" data-depth="4">
        <div className="stage-evidence-heading"><Icon name={step === 2 ? "check" : "shield"} className="h-4 w-4" /><span>{step === 2 ? "Your example shortlist" : "Business detail"}</span></div>
        <div key={`${selected}-${step}`} className="stage-evidence-content" aria-live="polite">
          <div className="stage-evidence-record"><span>{record.name.charAt(0)}</span><div><strong>{record.name}</strong><small>{record.category} · {record.area}</small></div></div>
          {step === 0 ? <><h3>Your niche.<br />Your neighbourhood.</h3><p>Compare business details before deciding which record deserves a closer look.</p><div className="stage-evidence-note"><Icon name="search" className="h-4 w-4" /><span>Choose a business to explore its example.</span></div></> : step === 1 ? <><div className={`stage-evidence-status stage-record-status-${selected}`}><Icon name={selected === 2 ? "check" : "shield"} className="h-4 w-4" />{record.status}</div><h3>{record.finding}</h3><p>{record.detail}</p><div className="stage-evidence-note"><Icon name="clock" className="h-4 w-4" /><span>Illustrative dated audit.<br />Not a live check.</span></div></> : <><div className="stage-evidence-status"><Icon name="check" className="h-4 w-4" />Selected for illustration</div><h3>A list you<br />can work with.</h3><p>Keep the businesses that fit. Inside your account, export a shortlist or save eligible contacts.</p><div className="stage-evidence-note"><Icon name="leads" className="h-4 w-4" /><span>No data is saved or exported in this demonstration.</span></div></>}
          <span className="stage-evidence-website">{record.website}</span>
        </div>
      </div>
    </div>
    <div className="research-stage-footer"><span>Search by area. Inspect the evidence. Keep what fits.</span><span>Explore the steps above<Icon name="arrow" className="h-4 w-4" /></span></div>
  </figure>;
}
