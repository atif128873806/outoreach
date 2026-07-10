import { NextRequest, NextResponse } from "next/server";
import { improveBrief } from "@/lib/ai";

export const runtime = "nodejs";

/** AI assistant: turns a rough campaign idea into a crisp brief + name. */
export async function POST(req: NextRequest) {
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
      body.tone?.trim() || "professional"
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI assistant failed" },
      { status: 500 }
    );
  }
}
