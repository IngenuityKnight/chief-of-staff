import { NextRequest, NextResponse } from "next/server";
import type { AdminResource } from "@/lib/server/admin";
import { requireEditorPassword, updateAdminResource } from "@/lib/server/admin";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const { resource, id } = await params;
    requireEditorPassword(req.headers.get("x-editor-password"));

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ ok: false, error: "Body must be a JSON object." }, 400);
    }

    const values = (body as { values?: unknown }).values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return response({ ok: false, error: "Field `values` must be an object." }, 400);
    }

    await updateAdminResource(resource as AdminResource, decodeURIComponent(id), values as Record<string, unknown>);
    return response({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    const status = message === "Invalid editor password." ? 401 : 400;
    return response({ ok: false, error: message }, status);
  }
}
