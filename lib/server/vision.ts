// Claude vision passthrough — extracts text + entities from an image (or PDF
// page) using a single LLM call, returning a normalized text capture that the
// chief can then route.
//
// Used by /api/intake when multipart files are present.

import { getAnthropicClient } from "@/lib/server/anthropic";
import { logAgentRun } from "@/lib/server/agents/agent-runs";

const MODEL = "claude-haiku-4-5-20251001";

type MediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "application/pdf";
export const ALLOWED_MEDIA: MediaType[] = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];

export interface VisionResult {
  text: string;          // normalized text capture for the chief
  rawExtraction: string; // model's verbatim transcription
  entities: {
    dates?: string[];
    amounts?: string[];
    people?: string[];
    vendors?: string[];
  };
}

export async function extractFromAttachment(opts: {
  base64: string;
  mediaType: MediaType;
  userHint?: string;
  inboxItemId: string;
  householdId: string;
}): Promise<VisionResult | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const prompt = `Transcribe this document. Then extract structured entities and return ONLY JSON:
{
  "transcription": "<verbatim text from the document>",
  "summary": "<1-2 sentence summary of what this document is and what the household needs to do>",
  "entities": {
    "dates": ["YYYY-MM-DD or ISO datetime if present"],
    "amounts": ["$amount" if any prices/fees],
    "people": ["names mentioned"],
    "vendors": ["business/organization names"]
  }
}

${opts.userHint ? `User context: ${opts.userHint}` : ""}`.trim();

  // Anthropic SDK expects image OR document content blocks
  const isPdf = opts.mediaType === "application/pdf";
  const t0 = Date.now();

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: [
          isPdf
            ? {
                type: "document" as const,
                source: { type: "base64" as const, media_type: "application/pdf" as const, data: opts.base64 },
              }
            : {
                type: "image" as const,
                source: { type: "base64" as const, media_type: opts.mediaType as Exclude<MediaType, "application/pdf">, data: opts.base64 },
              },
          { type: "text" as const, text: prompt },
        ],
      }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      void logAgentRun({ agent: "vision", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs: Date.now() - t0, inputSummary: `attachment ${opts.mediaType}`, output: null, ok: false, error: "non-text response", householdId: opts.householdId });
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      const m = content.text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no JSON");
      parsed = JSON.parse(m[0]);
    } catch {
      void logAgentRun({ agent: "vision", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs: Date.now() - t0, inputSummary: `attachment ${opts.mediaType}`, output: { raw: content.text }, ok: false, error: "parse failed", householdId: opts.householdId });
      return null;
    }

    void logAgentRun({ agent: "vision", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs: Date.now() - t0, inputSummary: `attachment ${opts.mediaType}`, output: parsed, ok: true, householdId: opts.householdId });

    const transcription = typeof parsed.transcription === "string" ? parsed.transcription : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    const entities = (parsed.entities as VisionResult["entities"] | undefined) ?? {};

    return {
      text: [opts.userHint, summary, transcription].filter(Boolean).join("\n\n"),
      rawExtraction: transcription,
      entities,
    };
  } catch (err) {
    void logAgentRun({ agent: "vision", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - t0, inputSummary: `attachment ${opts.mediaType}`, output: null, ok: false, error: err instanceof Error ? err.message : String(err), householdId: opts.householdId });
    return null;
  }
}
