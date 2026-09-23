import { NextResponse } from "next/server";
import { getUserId, getUser, changePassword, isVerificationEnforced } from "@/lib/auth";
import { NextRequest } from "next/server";
import { isOutreachEnabled } from "@/lib/product";
import {
  PLANS,
  FILTER_LABELS,
  FILTER_ORDER,
  normalizePlan,
  planForFilter,
} from "@/lib/plans";
import { offeredSources } from "@/lib/sources";

export const runtime = "nodejs";

export async function GET() {
  const uid = await getUserId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUser(uid);
  const plan = PLANS[normalizePlan(user?.plan)];
  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: Boolean(user.is_admin),
          emailVerified: Boolean(user.email_verified) || !isVerificationEnforced(),
          plan: user.plan,
        }
      : null,
    // Lead Finder filter gating: which filter is unlocked, and which plan
    // unlocks the rest. Server-owned so the pricing ladder has exactly one home
    // and the client never restates it.
    planName: plan.name,
    leadFilters: FILTER_ORDER.map((id) => ({ id, label: FILTER_LABELS[id] })).map((f) => ({
      ...f,
      unlocked: plan.filters.includes(f.id),
      requires: plan.filters.includes(f.id) ? null : PLANS[planForFilter(f.id)].name,
    })),
    // Which lead sources this deployment can actually run, by id, in picker
    // order. Server-owned because one of them (Companies House) runs on the
    // deployment's own key, which the client bundle cannot know: a source that
    // is not configured here is not offered, instead of being offered and then
    // failing on submit.
    sources: offeredSources().map((s) => s.id),
    // Drives which half of the app the shell renders. Server-owned so it can't
    // be frozen into the client bundle at build time.
    outreachEnabled: isOutreachEnabled(),
  });
}

/** Change password: { current, next } */
export async function POST(req: NextRequest) {
  const uid = await getUserId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { current, next } = (await req.json()) as { current?: string; next?: string };
  if (!current || !next) {
    return NextResponse.json({ error: "Both passwords are required" }, { status: 400 });
  }
  const error = await changePassword(uid, current, next);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
