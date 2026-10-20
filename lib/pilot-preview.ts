import { randomUUID } from "node:crypto";
import { getDb, q1, q, type Queryable } from "./db";
import { PILOT_AUDIENCES, type PilotAudience } from "./pilot";

export interface PreviewBusiness { name: string; area: string; category: string; website: string; }
export interface PilotPreview { audience: PilotAudience; businesses: PreviewBusiness[]; fetchedAt: string; reused: boolean; source: "OpenStreetMap"; }
export class PreviewUnavailable extends Error {
  retryAfter: number;
  constructor(retryAfter = 60) {
    super("The live sample is temporarily unavailable. Try again shortly or create an account to run your own search.");
    this.retryAfter = retryAfter;
  }
}
const PREVIEW_TTL = 7 * 86400_000;
const flights = new Map<PilotAudience, Promise<PilotPreview>>();

/** Fail closed for anonymous/provider budgets; shared across processes. */
export async function reservePilotWindow(db: Queryable, key: string, limit: number, milliseconds: number): Promise<boolean> {
  const rows = await db.query<{ count: number }>(`INSERT INTO rate_limits(key,count,reset_at)
    VALUES($1,1,clock_timestamp()+$2*interval '1 millisecond') ON CONFLICT(key) DO UPDATE SET
    count=CASE WHEN rate_limits.reset_at<=clock_timestamp() THEN 1 ELSE rate_limits.count+1 END,
    reset_at=CASE WHEN rate_limits.reset_at<=clock_timestamp() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
    RETURNING count`, [key, milliseconds]);
  return Number(rows[0]?.count ?? limit + 1) <= limit;
}
function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}
export function publicPreviewWebsite(value: unknown): string {
  const text = clean(value, 1000); if (!text) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      !url.hostname.includes(".") || /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return "";
    return url.origin + url.pathname; // query strings/fragments never enter the public sample
  } catch { return ""; }
}
/** Projection occurs before persistence/response. No spread of provider payloads. */
export function projectPreviewElements(elements: unknown, audience: PilotAudience): PreviewBusiness[] {
  if (!Array.isArray(elements)) throw new PreviewUnavailable(600);
  const item = PILOT_AUDIENCES[audience]; const seen = new Set<string>(); const result: PreviewBusiness[] = [];
  const [south, west, north, east] = item.bbox.split(",").map(Number);
  for (const element of elements.slice(0, 20)) {
    if (!element || typeof element !== "object") continue;
    const raw = element as Record<string, unknown>, tags = raw.tags as Record<string, unknown> | undefined;
    const position = (raw.center ?? raw) as Record<string, unknown>;
    if (!tags || typeof tags !== "object" || typeof position.lat !== "number" || typeof position.lon !== "number" ||
      !Number.isFinite(position.lat) || !Number.isFinite(position.lon) || position.lat < south || position.lat > north || position.lon < west || position.lon > east) continue;
    const expected = audience === "agencies" ? tags.amenity === "dentist" : audience === "accountants" ? tags.amenity === "cafe" : tags.craft === "electrician";
    const name = clean(tags.name, 160); if (!expected || !name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase()); result.push({ name, area: item.area, category: item.category,
      website: publicPreviewWebsite(tags.website ?? tags["contact:website"]) });
    if (result.length === 3) break;
  }
  return result;
}
async function fetchPreview(audience: PilotAudience): Promise<PreviewBusiness[]> {
  const item = PILOT_AUDIENCES[audience];
  const query = `[out:json][timeout:12][maxsize:16777216];nwr${item.tag}["name"](${item.bbox});out center tags 20;`;
  // Fixed server endpoint and fixed queries. No Nominatim, crawling, paid API or mirror retries.
  const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", redirect: "error",
    signal: AbortSignal.timeout(18_000), body: new URLSearchParams({ data: query }),
    headers: { "User-Agent": "OutreachStudio/1.0 LondonPilot (https://outreach.sakodev.com)", "Content-Type": "application/x-www-form-urlencoded" } });
  if (!response.ok) throw new PreviewUnavailable(600);
  if (Number(response.headers.get("content-length") ?? 0) > 1_048_576) throw new PreviewUnavailable(600);
  const reader = response.body?.getReader(); if (!reader) throw new PreviewUnavailable(600);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 1_048_576) { await reader.cancel(); throw new PreviewUnavailable(600); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  // Overpass can return HTTP 200 with a runtime-error remark and partial rows.
  if (typeof json.remark === "string" && json.remark.trim()) throw new PreviewUnavailable(600);
  return projectPreviewElements(json.elements, audience);
}
function storedPreview(row: { payload: string | null; fetched_at: string | Date | null } | null | undefined, audience: PilotAudience): PilotPreview | null {
  const at = row?.fetched_at ? new Date(row.fetched_at).getTime() : NaN;
  if (!row?.payload || !Number.isFinite(at) || at > Date.now() + 60_000 || Date.now() - at >= PREVIEW_TTL) return null;
  try {
    const values: unknown = JSON.parse(row.payload); if (!Array.isArray(values) || values.length > 3) return null;
    const item = PILOT_AUDIENCES[audience];
    const businesses = values.map(value => { const r = value as PreviewBusiness;
      return { name: clean(r.name,160), area: item.area, category: item.category, website: publicPreviewWebsite(r.website) }; });
    if (businesses.some(b => !b.name)) return null;
    return { audience, businesses, fetchedAt: new Date(at).toISOString(), reused: true, source: "OpenStreetMap" };
  } catch { return null; }
}
export async function loadPilotPreview(audience: PilotAudience, producer = fetchPreview): Promise<PilotPreview> {
  const existing = flights.get(audience); if (existing) return existing;
  const promise = (async () => {
    const hit = storedPreview(await q1<{ payload: string | null; fetched_at: string | Date | null }>(
      "SELECT payload,fetched_at FROM pilot_preview_samples WHERE audience=$1", [audience]), audience);
    if (hit) return hit;
    const claim = randomUUID();
    const claimed = await (await getDb()).transaction(async tx => {
      await tx.query("SELECT pg_advisory_xact_lock(734922)");
      await tx.query("INSERT INTO pilot_preview_samples(audience) VALUES($1) ON CONFLICT DO NOTHING", [audience]);
      const [row] = await tx.query<{ payload: string | null; fetched_at: string | Date | null; retry_after: string | Date }>(
        "SELECT payload,fetched_at,retry_after FROM pilot_preview_samples WHERE audience=$1 FOR UPDATE", [audience]);
      const cached = storedPreview(row, audience); if (cached) return cached;
      const delay = Math.ceil((new Date(row.retry_after).getTime() - Date.now()) / 1000);
      if (delay > 0) throw new PreviewUnavailable(Math.min(600,delay));
      if (!await reservePilotWindow(tx,"pilot-preview-provider-minute",1,60_000) ||
        !await reservePilotWindow(tx,"pilot-preview-provider-day",12,86400_000)) throw new PreviewUnavailable(60);
      await tx.query("UPDATE pilot_preview_samples SET claim=$2,retry_after=clock_timestamp()+interval '30 seconds' WHERE audience=$1", [audience,claim]);
      return null;
    });
    if (claimed) return claimed;
    try {
      const produced = await producer(audience);
      // Re-project test/custom producer too; never cache its extra fields.
      const item = PILOT_AUDIENCES[audience];
      const businesses = produced.slice(0,3).filter(b => clean(b.name,160)).map(b => ({ name: clean(b.name,160),
        area: item.area, category: item.category, website: publicPreviewWebsite(b.website) }));
      const fetchedAt = new Date().toISOString();
      const rows = await q("UPDATE pilot_preview_samples SET payload=$3,fetched_at=$4,retry_after=now(),claim=NULL WHERE audience=$1 AND claim=$2 RETURNING audience", [audience,claim,JSON.stringify(businesses),fetchedAt]);
      if (!rows.length) throw new PreviewUnavailable(60);
      return { audience,businesses,fetchedAt,reused:false,source:"OpenStreetMap" as const };
    } catch {
      await q("UPDATE pilot_preview_samples SET retry_after=clock_timestamp()+interval '10 minutes',claim=NULL WHERE audience=$1 AND claim=$2", [audience,claim]);
      throw new PreviewUnavailable(600);
    }
  })();
  flights.set(audience,promise);
  try { return await promise; } finally { if (flights.get(audience) === promise) flights.delete(audience); }
}
