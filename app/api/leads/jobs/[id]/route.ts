import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSearchJob, jobResult } from "@/lib/search-jobs";

export const runtime = "nodejs";

/**
 * One search's status — and its leads, once it has finished.
 *
 * Status and payload travel together because the caller wants exactly this:
 * "is it done, and if so what did it find?" The queue list stays light; this
 * route is where a finished search's few hundred kilobytes are actually read.
 *
 * Scoped to the signed-in account, so a job id cannot be walked to read someone
 * else's leads.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "No such search" }, { status: 404 });
  }

  const job = await getSearchJob(userId, jobId);
  if (!job) return NextResponse.json({ error: "No such search" }, { status: 404 });

  // The result is only read once the job is done; a queued or failed job has
  // nothing to hand over, and asking for it anyway would be a wasted query.
  const result = job.status === "done" ? await jobResult(userId, jobId) : null;
  return NextResponse.json({ job, result });
}
