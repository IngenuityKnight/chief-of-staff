import { NextRequest, NextResponse } from "next/server";
import { resetInboxAndTasks } from "@/lib/server/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { target } = body as { target?: string };
    if (target !== "inbox-and-tasks") {
      return NextResponse.json({ ok: false, error: "Unknown reset target." }, { status: 400 });
    }

    const result = await resetInboxAndTasks();

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
