import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { listSearchJobs, MAX_ACTIVE_JOBS_PER_USER } from "@/lib/search-jobs";

export const runtime = "nodejs";

/**
 * This account's recent searches, newest first.
 *
 * The UI polls this while anything is queued or running, which is why the
 * payload carries no leads: a finished search's payload is the largest thing in
 * the database, and fetching every one of them every two seconds would cost more
 * than the searches did. `GET /api/leads/jobs/{id}` returns one job's leads when
 * the user actually opens it.
 *
 * `cap` travels with the list because the client has to say what the queue holds
 * *before* the server would refuse: a disabled button explains itself, a 429 does
 * not. The number belongs to the server — the browser is told it rather than
 * guessing, so raising the cap later changes the UI without a change here.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
  const jobs = await listSearchJobs(userId, Number.isFinite(limit) ? limit : 20);
  return NextResponse.json({ jobs, cap: MAX_ACTIVE_JOBS_PER_USER });
}
