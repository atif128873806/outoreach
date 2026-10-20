import { randomUUID } from "node:crypto";
import { getDb, q, q1 } from "./db";
import { type PilotAudience, type PilotBrowserEvent } from "./pilot";
export const PILOT_COOKIE = "pilot_journey";
export const PILOT_CHOICE_COOKIE = "pilot_analytics_choice";
export const PILOT_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 };
const validId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
export async function pilotSession(id: unknown, userId: number | null = null) {
  if (!validId(id)) return null;
  return q1<{id:string;user_id:number|null;audience:PilotAudience}>(`SELECT id,user_id,audience FROM pilot_sessions
    WHERE id=$1 AND expires_at>now() AND (user_id IS NULL OR user_id=$2)`,[id,userId]);
}
export async function startPilotSession(audience: PilotAudience, userId: number | null, prior: unknown): Promise<string> {
  const existing = await pilotSession(prior,userId); if (existing) return existing.id;
  const id = randomUUID();
  await q("INSERT INTO pilot_sessions(id,user_id,audience,expires_at) VALUES($1,$2,$3,now()+interval '30 days')",[id,userId,audience]);
  return id;
}
export async function withdrawPilotSession(id: unknown): Promise<void> {
  if (validId(id)) await q("DELETE FROM pilot_sessions WHERE id=$1",[id]); // cascades journey events only
}
export async function recordPilotBrowserEvent(id: unknown, event: PilotBrowserEvent, audience: PilotAudience, userId: number | null): Promise<void> {
  const session = await pilotSession(id,userId); if (!session || (event === "upgrade_interest" && !userId)) return;
  await (await getDb()).transaction(async tx => {
    await tx.query("UPDATE pilot_sessions SET audience=$2 WHERE id=$1 AND user_id IS NULL",[session.id,audience]);
    await tx.query("INSERT INTO pilot_events(session_id,event,event_key) SELECT id,$2,$2 FROM pilot_sessions WHERE id=$1 AND expires_at>now() ON CONFLICT DO NOTHING",[session.id,event]);
  });
}
/** Registration is server-confirmed; an existing-account login cannot become signup. */
export async function linkPilotSignup(id: unknown, userId: number, audience: PilotAudience): Promise<void> {
  if (!validId(id)) return;
  await (await getDb()).transaction(async tx => {
    const rows = await tx.query("UPDATE pilot_sessions SET user_id=$2,audience=$3 WHERE id=$1 AND user_id IS NULL AND expires_at>now() RETURNING id",[id,userId,audience]);
    if (rows.length) await tx.query("INSERT INTO pilot_events(session_id,event,event_key) VALUES($1,'signup_complete','signup_complete') ON CONFLICT DO NOTHING",[id]);
  });
}
export async function recordPilotSignupError(id: unknown): Promise<void> {
  if (!validId(id)) return;
  await q("INSERT INTO pilot_events(session_id,event,event_key) SELECT id,'signup_error','signup_error' FROM pilot_sessions WHERE id=$1 AND user_id IS NULL AND expires_at>now() ON CONFLICT DO NOTHING",[id]);
}
export async function linkPilotSearch(id: unknown, userId: number, jobId: number): Promise<void> {
  if (!validId(id)) return;
  await q(`INSERT INTO pilot_events(session_id,event,event_key,job_id) SELECT s.id,'search_started','search_started:'||j.id,j.id
    FROM pilot_sessions s JOIN search_jobs j ON j.user_id=s.user_id WHERE s.id=$1 AND s.user_id=$2 AND j.id=$3
    AND s.expires_at>now() ON CONFLICT DO NOTHING`,[id,userId,jobId]);
}
export async function recordPilotJobEvent(db: {query:(sql:string,params:unknown[])=>Promise<unknown[]>},userId:number,jobId:number,event:"search_results"|"search_empty"|"search_failed"|"opened"|"exported"|"copied"|"saved"):Promise<void> {
  await db.query(`INSERT INTO pilot_events(session_id,event,event_key,job_id)
    SELECT DISTINCT s.id,$3::text,$3::text||':'||$2::text,$2::int FROM pilot_sessions s JOIN pilot_events e ON e.session_id=s.id
    WHERE s.user_id=$1 AND e.job_id=$2::int AND e.event='search_started' AND s.expires_at>now()
    ON CONFLICT DO NOTHING`,[userId,jobId,event]);
}
export async function recordPilotPreview(id:unknown,userId:number|null,success:boolean):Promise<void> {
  const session=await pilotSession(id,userId);if(!session)return;
  const event=success?'preview_loaded':'preview_error';
  await q("INSERT INTO pilot_events(session_id,event,event_key) SELECT id,$2,$2 FROM pilot_sessions WHERE id=$1 AND expires_at>now() ON CONFLICT DO NOTHING",[session.id,event]);
}
/** Analytics must not prevent registration/admission/preview delivery. */
export async function bestEffortPilot(action:()=>Promise<unknown>):Promise<void> {
  try { await action(); } catch { console.error("[pilot] journey recording unavailable"); }
}
export async function cleanupPilotJourneys():Promise<void> {
  await q("DELETE FROM pilot_sessions WHERE created_at<now()-interval '90 days'");
}

/** Savepoint confines optional analytics failures within a customer transaction. */
export async function recordPilotJobEventSafely(db: {query:(sql:string,params:unknown[])=>Promise<unknown[]>},userId:number,jobId:number,event:Parameters<typeof recordPilotJobEvent>[3]):Promise<void>{
  await db.query("SAVEPOINT pilot_record",[]);
  try { await recordPilotJobEvent(db,userId,jobId,event); }
  catch { await db.query("ROLLBACK TO SAVEPOINT pilot_record",[]); console.error("[pilot] journey recording unavailable"); }
  finally { await db.query("RELEASE SAVEPOINT pilot_record",[]); }
}
