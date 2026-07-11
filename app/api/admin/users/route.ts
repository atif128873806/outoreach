import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getUserId, isAdmin } from "@/lib/auth";
import { isSystemMailerConfigured } from "@/lib/system-mailer";
import { getAiConfig } from "@/lib/settings";

export const runtime = "nodejs";

/** Admin-only: all accounts with basic usage counts, plus instance status. */
export async function GET() {
  const uid = await getUserId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(uid))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const users = await q(
    `SELECT u.id, u.email, u.name, u.is_admin, u.created_at,
        (SELECT COUNT(*) FROM contacts c WHERE c.user_id = u.id)::int AS contacts,
        (SELECT COUNT(*) FROM campaigns cp WHERE cp.user_id = u.id)::int AS campaigns,
        (SELECT COUNT(*) FROM emails e WHERE e.user_id = u.id AND e.status = 'sent')::int AS sent
     FROM users u
     ORDER BY u.id`
  );

  // AI is provided instance-wide when a global key is set (env), regardless of per-user settings.
  const globalAi = getAiConfig({
    ai_provider: "",
    anthropic_api_key: "",
    groq_api_key: "",
    groq_model: "",
  } as never);

  return NextResponse.json({
    users,
    instance: {
      signupsDisabled: process.env.SIGNUPS_DISABLED === "true",
      systemMailer: isSystemMailerConfigured(),
      globalAi: globalAi ? globalAi.provider : null,
    },
  });
}
