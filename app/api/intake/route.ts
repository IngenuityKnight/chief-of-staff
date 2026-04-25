import { NextRequest, NextResponse } from "next/server";
import { analyzeIntake, createTasksFromIntake, persistIntake } from "@/lib/server/intake";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { isAnthropicConfigured } from "@/lib/server/anthropic";

// POST /api/intake
//
// Analyzes freeform household input, routes it to the right agent,
// persists an inbox item, and immediately creates the proposed tasks.
//
// Request:  { "text": "...", "source"?: "web" | "email" | ... }
// Response: { ok, id, analysis, routing, urgency, proposedTasks, createdTasks }

const MAX_TEXT_LENGTH = 2_000;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return json({ ok: false, error: "Content-Type must be application/json." }, 415);
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, error: "Request body must be a JSON object." }, 400);
    }

    const textValue = (body as Record<string, unknown>).text;
    if (typeof textValue !== "string") {
      return json({ ok: false, error: "Field `text` must be a string." }, 400);
    }

    const text = textValue.trim();
    if (!text) return json({ ok: false, error: "Empty text payload." }, 400);
    if (text.length > MAX_TEXT_LENGTH) {
      return json({ ok: false, error: `Text exceeds ${MAX_TEXT_LENGTH} characters.` }, 413);
    }

    const source = typeof (body as Record<string, unknown>).source === "string"
      ? String((body as Record<string, unknown>).source)
      : "web";

    const intake = await analyzeIntake(text, source);

    // Persist inbox item and create tasks in parallel
    const [persistence, createdTasks] = await Promise.all([
      persistIntake(intake),
      createTasksFromIntake(intake),
    ]);

    return json({
      ok: true,
      id: intake.id,
      capturedAt: intake.capturedAt,
      analysis: intake.analysis,
      routing: intake.routing,
      urgency: intake.urgency,
      proposedTasks: intake.proposedTasks,
      createdTasks,
      meta: {
        supabaseConfigured: isSupabaseConfigured(),
        anthropicConfigured: isAnthropicConfigured(),
        persisted: persistence.persisted,
        tasksCreated: createdTasks.length,
      },
    });
  } catch {
    return json({ ok: false, error: "Malformed request." }, 400);
  }
}

export async function GET() {
  return json({
    ok: true,
    service: "intake",
    version: "0.2.0",
    meta: {
      supabaseConfigured: isSupabaseConfigured(),
      anthropicConfigured: isAnthropicConfigured(),
    },
  });
}
