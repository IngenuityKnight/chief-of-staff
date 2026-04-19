import { NextRequest, NextResponse } from "next/server";
import { createAdminResource, requireEditorPassword, type AdminResource } from "@/lib/server/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await params;
    const password = req.headers.get("x-editor-password");
    requireEditorPassword(password);

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { values } = body as { values?: Record<string, unknown> };
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return NextResponse.json({ ok: false, error: "Missing values object." }, { status: 400 });
    }

    const id = await createAdminResource(resource as AdminResource, values);

    return NextResponse.json(
      { ok: true, id },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    const status = message.includes("password") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
