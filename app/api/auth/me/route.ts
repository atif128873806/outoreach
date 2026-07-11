import { NextResponse } from "next/server";
import { getUserId, getUser, changePassword } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const uid = await getUserId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUser(uid);
  return NextResponse.json({
    user: user
      ? { id: user.id, email: user.email, name: user.name, isAdmin: Boolean(user.is_admin) }
      : null,
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
