import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getLeadQuota } from "@/lib/usage";
import { planAllowsWatches, watchesUpgradeMessage } from "@/lib/plans";
import {
  checkUserWatches,
  listWatches,
  markSeen,
  registerConfigured,
  unseenDigest,
  unseenTotal,
} from "@/lib/watches";
import { isSystemMailerConfigured } from "@/lib/system-mailer";

export const runtime = "nodejs";
// One register request per watch, plus officer lookups, plus the deliberate
// pause between watches. A dozen watches is seconds; the ceiling is for a
// deployment whose register key is slowed down.
export const maxDuration = 120;

/**
 * What is new in the user's watched searches.
 *
 * GET is read-only and cheap — it reads rows already stored, never the register,
 * so a page load cannot spend the deployment's shared register allowance.
 * POST { action: "check" } asks the register now (the "check for new" button),
 * and POST { action: "seen" } clears the badge once the user has looked.
 */
export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await getLeadQuota(userId);
  if (!planAllowsWatches(quota.plan)) {
    return NextResponse.json({ error: watchesUpgradeMessage(quota.plan) }, { status: 403 });
  }

  const digest = await unseenDigest(userId);
  return NextResponse.json({
    watchCount: digest.length,
    unseen: await unseenTotal(userId),
    registerConfigured: registerConfigured(),
    emailDigest: isSystemMailerConfigured(),
    groups: digest.map(({ watch, companies }) => ({
      watch: { id: watch.id, niche: watch.niche, location: watch.location, lastCheckedAt: watch.last_checked_at },
      companies,
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await getLeadQuota(userId);
  if (!planAllowsWatches(quota.plan)) {
    return NextResponse.json({ error: watchesUpgradeMessage(quota.plan) }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };

  if (body.action === "seen") {
    await markSeen(userId);
    return NextResponse.json({ ok: true, unseen: 0 });
  }

  if (body.action !== "check") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const watches = await listWatches(userId);
  if (watches.length === 0) return NextResponse.json({ ok: true, checked: 0, found: 0, unseen: 0 });

  if (!registerConfigured()) {
    return NextResponse.json(
      { error: "This deployment isn't connected to Companies House, so it can't check for new businesses." },
      { status: 503 }
    );
  }

  const result = await checkUserWatches(userId, { force: true });
  const digest = await unseenDigest(userId);

  return NextResponse.json({
    ok: true,
    checked: result.checked,
    found: result.found,
    unseen: await unseenTotal(userId),
    // A register that refused or rate-limited is reported per watch rather than
    // swallowed: "0 new" and "we could not ask" are different answers.
    errors: result.errors,
    groups: digest.map(({ watch, companies }) => ({
      watch: { id: watch.id, niche: watch.niche, location: watch.location, lastCheckedAt: watch.last_checked_at },
      companies,
    })),
  });
}
