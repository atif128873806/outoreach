/** Public workflow configuration. No credentials, private results or account gates. */
export const PILOT_AUDIENCES = {
  agencies: { label: "Web agencies & freelancers", niche: "dentists", location: "Croydon, London, UK",
    area: "Croydon, London", category: "Dental practice", tag: '["amenity"="dentist"]', bbox: "51.35,-0.15,51.40,-0.05",
    title: "Find businesses worth a website conversation",
    description: "Build a shortlist, review available website findings, then check the evidence before contacting a business.",
    guidance: "Start with Any business. The broken-site filter is available on paid plans; an issue is not proof that a business wants a redesign." },
  accountants: { label: "Accountants", niche: "cafes", location: "Hackney, London, UK",
    area: "Hackney, London", category: "Cafe", tag: '["amenity"="cafe"]', bbox: "51.53,-0.09,51.56,-0.02",
    title: "Research local businesses that fit your practice",
    description: "Review a local business sample, then qualify location and business activity for your own accounting services.",
    guidance: "This free first search uses map data. Companies House remains a Pro source with the No website filter. A register record does not prove accounting need; this is not a new-company feed." },
  sales: { label: "Local sales teams", niche: "electricians", location: "Southwark, London, UK",
    area: "Southwark, London", category: "Electrician", tag: '["craft"="electrician"]', bbox: "51.44,-0.115,51.505,-0.04",
    title: "Build a focused local sales shortlist",
    description: "Choose a business type and London area, check the available details, and save or export the businesses that fit.",
    guidance: "Category and area are a research starting point, not buying intent. Coverage and public contact details vary by business." },
} as const;
export type PilotAudience = keyof typeof PILOT_AUDIENCES;
export function isPilotAudience(value: unknown): value is PilotAudience {
  return typeof value === "string" && Object.hasOwn(PILOT_AUDIENCES, value);
}
export function pilotAudience(value: unknown): PilotAudience {
  return isPilotAudience(value) ? value : "agencies";
}
export function pilotSearchPath(audience: PilotAudience): string {
  const item = PILOT_AUDIENCES[audience];
  return `/leads?${new URLSearchParams({ audience, niche: item.niche, location: item.location, source: "osm", filter: "any", count: "10" })}`;
}
export function pilotSignupPath(audience: PilotAudience): string { return `/signup?audience=${audience}`; }
export const PILOT_BROWSER_EVENTS = ["landing_view", "preview_view", "signup_view", "upgrade_interest"] as const;
export type PilotBrowserEvent = typeof PILOT_BROWSER_EVENTS[number];
export function isPilotBrowserEvent(value: unknown): value is PilotBrowserEvent {
  return typeof value === "string" && PILOT_BROWSER_EVENTS.some(event => event === value);
}
