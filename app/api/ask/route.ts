// POST /api/ask
//
// Body: { "question": "..." }
// Response: { ok, answer, citations: [{ table, id, label }] }
//
// Claude tool-use loop: model picks tools, we run parameterized queries scoped
// to the current household, feed results back, and the model synthesizes a
// grounded answer with citations. Honest "no record yet" fallback when tools
// return zero rows — the UI then offers to turn it into a capture.

import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/server/anthropic";
import { getCurrentHousehold } from "@/lib/server/household";
import { logAgentRun } from "@/lib/server/agents/agent-runs";
import { TOOL_DEFS, dispatchTool } from "@/lib/server/ask-tools";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TURNS = 4;

interface AskBody {
  question?: string;
}

interface Citation {
  table: string;
  id: string;
  label: string;
}

export async function POST(req: NextRequest) {
  let body: AskBody;
  try { body = (await req.json()) as AskBody; } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question || question.length > 500) {
    return NextResponse.json({ ok: false, error: "Provide a question under 500 chars." }, { status: 400 });
  }

  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return NextResponse.json({ ok: false, error: "Anthropic not configured." }, { status: 503 });
  }

  const householdId = await getCurrentHousehold();
  const t0 = Date.now();

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: question },
  ];

  const allCitations: Citation[] = [];
  let totalIn = 0, totalOut = 0;
  let finalAnswer = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: "You are the Chief of Staff for a household. Answer the user's question using ONLY facts returned by your tools. If tools return nothing relevant, say so honestly and offer to add a record. Cite specifics (dates, amounts, names). Keep answers under 4 sentences.",
      tools: TOOL_DEFS as unknown as Parameters<typeof anthropic.messages.create>[0]["tools"],
      messages: messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
    });

    totalIn += response.usage.input_tokens;
    totalOut += response.usage.output_tokens;

    // Collect any tool_use blocks; run them; feed back tool_result blocks
    const toolUses = response.content.filter((b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use");
    const textBlocks = response.content.filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text");

    if (toolUses.length === 0) {
      finalAnswer = textBlocks.map((t) => t.text).join("\n").trim();
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const tu of toolUses) {
      const result = await dispatchTool(tu.name, tu.input as Record<string, unknown>, householdId);
      for (const cite of result.citations) allCitations.push(cite);
      toolResults.push({
        type: "tool_result" as const,
        tool_use_id: tu.id,
        content: JSON.stringify({ rows: result.rows, error: result.error ?? null }),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  if (!finalAnswer) finalAnswer = "I'm not sure how to answer that from the household record. Want to add the information?";

  // Dedupe citations by id+table
  const seen = new Set<string>();
  const dedupedCitations = allCitations.filter((c) => {
    const k = `${c.table}:${c.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  void logAgentRun({
    agent: "chief", trigger: "ask", inboxItemId: null,
    model: MODEL, promptTokens: totalIn, completionTokens: totalOut,
    latencyMs: Date.now() - t0, inputSummary: question.slice(0, 200),
    output: { answer: finalAnswer, citations: dedupedCitations }, ok: true,
    householdId,
  });

  return NextResponse.json({
    ok: true,
    answer: finalAnswer,
    citations: dedupedCitations,
  }, { headers: { "Cache-Control": "no-store" } });
}
