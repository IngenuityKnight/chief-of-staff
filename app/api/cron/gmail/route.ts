import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/server/google-calendar";
import { analyzeIntake, persistIntake } from "@/lib/server/intake";

// GET /api/cron/gmail
//
// Polls Gmail for unread inbox messages, runs each through the intake
// pipeline, then marks them as read to avoid reprocessing.
//
// Invoked every 10 minutes by Vercel Cron. Secured with CRON_SECRET.

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow all (dev mode)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const auth = getOAuthClient();
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN." },
      { status: 503 }
    );
  }

  const gmail = google.gmail({ version: "v1", auth });

  const { data: listData } = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread label:inbox",
    maxResults: 20,
  });

  const messages = listData.messages ?? [];

  if (messages.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, errors: 0 });
  }

  const processed: string[] = [];
  const errors: string[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;

    try {
      const { data: fullMsg } = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["Subject", "From"],
      });

      const headers = fullMsg.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
      const snippet = fullMsg.snippet ?? "";

      // Build text for intake: "Subject: snippet..."
      const text = `${subject}: ${snippet.slice(0, 500)}`.trim();

      const intake = await analyzeIntake(text, "email");
      await persistIntake(intake);

      // Mark as read so we don't reprocess it next run
      await gmail.users.messages.modify({
        userId: "me",
        id: msg.id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });

      processed.push(msg.id);
    } catch (err) {
      console.error(`[cron/gmail] Failed to process message ${msg.id}:`, err);
      errors.push(msg.id!);
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    errors: errors.length,
  });
}
