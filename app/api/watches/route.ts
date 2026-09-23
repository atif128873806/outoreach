import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getLeadQuota } from "@/lib/usage";
import { planAllowsWatches, watchesUpgradeMessage } from "@/lib/plans";
import { addWatch, listWatches, registerConfigured, removeWatch, unseenTotal } from "@/lib/watches";
import { isSystemMailerConfigured } from "@/lib/system-mailer";

export const runtime = "nodejs";

/**
 * Saved searches — the ones that report what is new.
 *
 * All three verbs answer with the same shape, so the page can render from one
 * response and never has to guess what a create or a delete did.
 */
function respond(userId: number) {
  return (async () => {
    const watches = await listWatches(userId);
    return NextResponse.json({
      watches: watches.map((w) => ({
        id: w.id,
        niche: w.niche,
        location: w.location,
        lastCheckedAt: w.last_checked_at,
        unseen: Number(w.unseen_count ?? 0),
        lastError: w.last_error || "",
      })),
      unseen: await unseenTotal(userId),
      // The digest is built from the UK register, so a deployment without that
      // key cannot run it at all. Saying so beats an empty list that looks like
      // "nothing happened this week".
      registerConfigured: registerConfigured(),
      // Whether the weekly email can actually be delivered. Without a system
      // mailer the digest still runs and stores everything, so the page has to
      // stop promising an email that will never arrive.
      emailDigest: isSystemMailerConfigured(),
    });
  })();
}

export async function GET() {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return respond(userId);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await getLeadQuota(userId);
  if (!planAllowsWatches(quota.plan)) {
    return NextResponse.json({ error: watchesUpgradeMessage(quota.plan) }, { status: 403 });
  }
  if (!registerConfigured()) {
    return NextResponse.json(
      { error: "This deployment isn't connected to Companies House, so it can't watch for new businesses yet." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { niche?: string; location?: string };
  const niche = body.niche?.trim() ?? "";
  const location = body.location?.trim() ?? "";
  if (!niche || !location) {
    return NextResponse.json({ error: "A niche and a place are both required" }, { status: 400 });
  }
  if (niche.length > 80 || location.length > 80) {
    return NextResponse.json({ error: "Keep the niche and place short" }, { status: 400 });
  }

  const watches = await listWatches(userId);
  if (watches.length >= 10) {
    return NextResponse.json(
      { error: "That's the most searches one account can watch (10). Remove one to add another." },
      { status: 400 }
    );
  }

  const created = await addWatch(userId, niche, location);
  if (!created) {
    return NextResponse.json({ error: "That search is already being watched" }, { status: 400 });
  }
  return respond(userId);
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Which search?" }, { status: 400 });
  }
  await removeWatch(userId, id);
  return respond(userId);
}
