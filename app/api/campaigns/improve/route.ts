import { NextRequest, NextResponse } from "next/server";
import { improveBrief } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { getUserId } from "@/lib/auth";
import { friendlyProviderError } from "@/lib/friendly-error";

export const runtime = "nodejs";

/** AI assistant: turns a rough campaign idea into a crisp brief + name. */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { description?: string; tone?: string };
  if (!body.description?.trim()) {
    return NextResponse.json(
      { error: "Write a rough idea first — even one sentence is enough" },
      { status: 400 }
    );
  }
  try {
    const result = await improveBrief(
      body.description.trim(),
      body.tone?.trim() || "professional",
      await getSettings(userId),
      userId
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err, "ai") }, { status: 500 });
  }
}
