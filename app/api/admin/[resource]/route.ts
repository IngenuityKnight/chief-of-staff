import { NextRequest, NextResponse } from "next/server";
import {
  AdminAuthError,
  createAdminResource,
  deleteAdminResource,
  isAdminResource,
  updateAdminResource,
} from "@/lib/server/admin";

function errorResponse(err: unknown) {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unknown error.";
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await params;
    if (!isAdminResource(resource)) {
      return NextResponse.json({ ok: false, error: "Unknown resource." }, { status: 404 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { values } = body as { values?: Record<string, unknown> };
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return NextResponse.json({ ok: false, error: "Missing values object." }, { status: 400 });
    }

    const id = await createAdminResource(resource, values);

    return NextResponse.json(
      { ok: true, id },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await params;
    if (!isAdminResource(resource)) {
      return NextResponse.json({ ok: false, error: "Unknown resource." }, { status: 404 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { id, values } = body as { id?: string; values?: Record<string, unknown> };
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    }
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return NextResponse.json({ ok: false, error: "Missing values object." }, { status: 400 });
    }

    await updateAdminResource(resource, id, values);

    return NextResponse.json(
      { ok: true, id },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await params;
    if (!isAdminResource(resource)) {
      return NextResponse.json({ ok: false, error: "Unknown resource." }, { status: 404 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { id } = body as { id?: string };
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    }

    await deleteAdminResource(resource, id);

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
