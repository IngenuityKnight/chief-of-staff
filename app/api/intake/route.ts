import { NextRequest, NextResponse } from "next/server";
import { analyzeIntake, forwardIntakeToN8n, persistIntake } from "@/lib/server/intake";
import { isN8nConfigured, isSupabaseConfigured } from "@/lib/server/supabase";
import { isAnthropicConfigured } from "@/lib/server/anthropic";

// ─────────────────────────────────────────────────────────────
// POST /api/intake
//
// This is the intake webhook for the Chief of Staff system.
// Contract (same as n8n webhook, so the HTML form works unchanged):
//   Request:  { "text": "..."  }
//   Response: { ok, analysis, routing: {primary, secondary, category}, proposedTasks, urgency }
//
// For the prototype this is a heuristic router. In production,
// swap the body of `analyzeWithHeuristics` for a fetch() to your
// n8n webhook — or call OpenAI/Anthropic directly.
// ─────────────────────────────────────────────────────────────

const MAX_TEXT_LENGTH = 2_000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonResponse(
        { ok: false, error: "Content-Type must be application/json." },
        415
      );
    }

    const rawBody: unknown = await req.json();
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return jsonResponse(
        { ok: false, error: "Request body must be a JSON object." },
        400
      );
    }

    const textValue = Object.prototype.hasOwnProperty.call(rawBody, "text")
      ? (rawBody as { text?: unknown }).text
      : "";

    if (typeof textValue !== "string") {
      return jsonResponse(
        { ok: false, error: "Field `text` must be a string." },
        400
      );
    }

    const text = textValue.trim();
    const source = typeof (rawBody as { source?: unknown }).source === "string"
      ? (rawBody as { source: string }).source
      : "web";

    if (!text) {
      return jsonResponse(
        { ok: false, error: "Empty text payload." },
        400
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return jsonResponse(
        { ok: false, error: `Text payload exceeds ${MAX_TEXT_LENGTH} characters.` },
        413
      );
    }

    const intake = await analyzeIntake(text, source);
    const persistence = await persistIntake(intake);
    const n8n = await forwardIntakeToN8n(intake);

    return jsonResponse({
      ok: true,
      id: intake.id,
      capturedAt: intake.capturedAt,
      analysis: intake.analysis,
      routing: intake.routing,
      urgency: intake.urgency,
      proposedTasks: intake.proposedTasks,
      backend: {
        supabaseConfigured: isSupabaseConfigured(),
        n8nConfigured: isN8nConfigured(),
        anthropicConfigured: isAnthropicConfigured(),
        persisted: persistence.persisted,
        forwarded: n8n.forwarded,
      },
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "Malformed request." },
      400
    );
  }
}

// Let the dock confirm the endpoint is alive.
export async function GET() {
  return jsonResponse({
    ok: true,
    service: "intake",
    version: "0.1.0",
    backend: {
      supabaseConfigured: isSupabaseConfigured(),
      n8nConfigured: isN8nConfigured(),
      anthropicConfigured: isAnthropicConfigured(),
    },
  });
}
