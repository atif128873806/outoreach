/** Search follow-through, linked to the owned job. One timestamp per action,
 * not click counts. Seven-day job retention also bounds these analytics. */
export type SearchAction = "opened" | "exported" | "copied" | "saved";
const COLUMNS: Record<SearchAction, string> = {
  opened: "opened_at", exported: "exported_at", copied: "copied_at", saved: "saved_at",
};

export function isSearchAction(value: unknown): value is SearchAction {
  return typeof value === "string" && Object.hasOwn(COLUMNS, value);
}

export async function recordSearchAction(userId: number, jobId: number, action: SearchAction,
  tx?: { query: (sql: string, params: unknown[]) => Promise<unknown[]> }): Promise<boolean> {
  if (!Number.isSafeInteger(jobId) || jobId <= 0 || !isSearchAction(action)) return false;
  const column = COLUMNS[action]; // identifier comes only from the allowlist
  const { getDb } = await import("./db");
  const record = async (db: {query:(sql:string,params:unknown[])=>Promise<unknown[]>}) => {
    const rows = await db.query(`UPDATE search_jobs SET ${column} = COALESCE(${column}, now())
      WHERE id = $1 AND user_id = $2 AND status = 'done' RETURNING id`, [jobId, userId]);
    if (!rows.length) return false;
    if (action !== "opened") await db.query(`INSERT INTO search_extractions
      (job_id,user_id,niche,location,source,action,lead_count)
      SELECT id,user_id,niche,location,source,$3,lead_count FROM search_jobs WHERE id=$1 AND user_id=$2
      ON CONFLICT(job_id,action) DO NOTHING`,[jobId,userId,action]);
    return true;
  };
  return tx ? record(tx) : (await getDb()).transaction(record);
}

export async function searchFollowThrough() {
  const { q1 } = await import("./db");
  return q1<{ queued: number; active: number; failed: number; completed: number;
    with_results: number; opened: number; exported: number; copied: number; saved: number; no_action: number }>(
    `SELECT COUNT(*)::int queued,
      COUNT(*) FILTER (WHERE status IN ('queued','running'))::int active,
      COUNT(*) FILTER (WHERE status = 'failed')::int failed,
      COUNT(*) FILTER (WHERE status = 'done')::int completed,
      COUNT(*) FILTER (WHERE status = 'done' AND lead_count > 0)::int with_results,
      COUNT(*) FILTER (WHERE status = 'done' AND opened_at IS NOT NULL)::int opened,
      COUNT(*) FILTER (WHERE exported_at IS NOT NULL)::int exported,
      COUNT(*) FILTER (WHERE copied_at IS NOT NULL)::int copied,
      COUNT(*) FILTER (WHERE saved_at IS NOT NULL)::int saved,
      COUNT(*) FILTER (WHERE status = 'done' AND lead_count > 0 AND
        exported_at IS NULL AND copied_at IS NULL AND saved_at IS NULL)::int no_action
     FROM search_jobs WHERE created_at >= now() - interval '7 days'`);
}
