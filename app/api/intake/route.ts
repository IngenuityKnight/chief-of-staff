import { NextRequest, NextResponse } from "next/server";
import { analyzeIntake, applyIntakeChanges, createProposalsFromIntake, persistIntake } from "@/lib/server/intake";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { isAnthropicConfigured } from "@/lib/server/anthropic";
import { extractFromAttachment, ALLOWED_MEDIA } from "@/lib/server/vision";

// POST /api/intake
//
// Accepts:
//   - application/json:        { "text": "...", "source"?: "web"|"email"|... }
//   - multipart/form-data:     fields `text?` + one or more `files` (image/pdf)
//
// On multipart, image/PDF attachments are run through Claude vision (one call
// per file) to extract a normalized text capture, which is then routed through
// the chief → specialists pipeline like any text intake.

const MAX_TEXT_LENGTH = 2_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per the brief
const MAX_FILES = 5;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

async function handleJson(req: NextRequest) {
  const body: unknown = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Request body must be a JSON object." }, 400);
  }

  const textValue = (body as Record<string, unknown>).text;
  if (typeof textValue !== "string") return json({ ok: false, error: "Field `text` must be a string." }, 400);
  const text = textValue.trim();
  if (!text) return json({ ok: false, error: "Empty text payload." }, 400);
  if (text.length > MAX_TEXT_LENGTH) {
    return json({ ok: false, error: `Text exceeds ${MAX_TEXT_LENGTH} characters.` }, 413);
  }

  const source = typeof (body as Record<string, unknown>).source === "string"
    ? String((body as Record<string, unknown>).source) : "web";

  return runIntakePipeline(text, source);
}

async function handleMultipart(req: NextRequest) {
  const form = await req.formData();
  const userText = ((form.get("text") as string | null) ?? "").trim().slice(0, MAX_TEXT_LENGTH);
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (!userText && files.length === 0) {
    return json({ ok: false, error: "Provide text or at least one file." }, 400);
  }
  if (files.length > MAX_FILES) {
    return json({ ok: false, error: `Maximum ${MAX_FILES} files per capture.` }, 413);
  }

  // We need a draft inbox id before calling vision, so the vision runs are
  // logged against the same agent_runs.inbox_item_id once the inbox row exists.
  // We generate the id here and reuse it for the analysis below.
  const draftInboxId = `inb_${crypto.randomUUID()}`;
  const { getCurrentHousehold } = await import("@/lib/server/household");
  const householdId = await getCurrentHousehold();

  const extractions: string[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return json({ ok: false, error: `File ${file.name} exceeds 10MB.` }, 413);
    }
    if (!ALLOWED_MEDIA.includes(file.type as (typeof ALLOWED_MEDIA)[number])) {
      return json({ ok: false, error: `Unsupported type ${file.type}. Allowed: ${ALLOWED_MEDIA.join(", ")}` }, 415);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractFromAttachment({
      base64: buffer.toString("base64"),
      mediaType: file.type as (typeof ALLOWED_MEDIA)[number],
      userHint: userText || undefined,
      inboxItemId: draftInboxId,
      householdId,
    });
    if (result) extractions.push(result.text);
  }

  const composed = [userText, ...extractions].filter(Boolean).join("\n\n");
  if (!composed) return json({ ok: false, error: "Vision extraction produced no text." }, 422);

  return runIntakePipeline(composed.slice(0, MAX_TEXT_LENGTH * 4), "upload", householdId);
}

async function runIntakePipeline(text: string, source: string, householdIdOverride?: string) {
  const intake = await analyzeIntake(text, source, householdIdOverride);

  const persistence = await persistIntake(intake);
  if (!persistence.persisted) {
    return json(
      {
        ok: false,
        error: persistence.error ?? "Supabase is not configured.",
        meta: {
          supabaseConfigured: isSupabaseConfigured(),
          anthropicConfigured: isAnthropicConfigured(),
          persisted: false,
          tasksCreated: 0,
        },
      },
      isSupabaseConfigured() ? 500 : 503
    );
  }

  const [proposals, appliedChanges] = await Promise.all([
    createProposalsFromIntake(intake),
    applyIntakeChanges(intake),
  ]);

  const autoExecuted = proposals.filter((p) => p.gateDecision === "auto").length;
  const waitingOnYou = proposals.filter((p) => p.gateDecision === "ask").length;

  return json({
    ok: true,
    id: intake.id,
    capturedAt: intake.capturedAt,
    analysis: intake.analysis,
    routing: intake.routing,
    urgency: intake.urgency,
    proposedTasks: intake.proposedTasks,
    proposals,
    appliedChanges,
    meta: {
      supabaseConfigured: isSupabaseConfigured(),
      anthropicConfigured: isAnthropicConfigured(),
      persisted: persistence.persisted,
      proposalsCreated: proposals.length,
      autoExecuted,
      waitingOnYou,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type")?.toLowerCase() ?? "";
    if (ct.includes("multipart/form-data")) return await handleMultipart(req);
    if (ct.includes("application/json")) return await handleJson(req);
    return json({ ok: false, error: "Content-Type must be application/json or multipart/form-data." }, 415);
  } catch {
    return json({ ok: false, error: "Malformed request." }, 400);
  }
}

export async function GET() {
  return json({
    ok: true,
    service: "intake",
    version: "0.3.0",
    meta: {
      supabaseConfigured: isSupabaseConfigured(),
      anthropicConfigured: isAnthropicConfigured(),
    },
  });
}
