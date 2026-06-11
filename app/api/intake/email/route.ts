// POST /api/intake/email
//
// Inbound-email webhook for Resend. The "to" address is `house-<token>@in.chiefofstaff.app`
// where <token> matches households.inbound_address_token, scoping the capture
// to that household. Signature is verified via the RESEND_WEBHOOK_SECRET header.
//
// Payload (Resend inbound v1, abbreviated):
//   { "type": "email.received", "data": { "from": "...", "to": ["..."],
//     "subject": "...", "text": "...", "html": "...", "attachments": [
//       { "filename": "...", "contentType": "...", "content": "<base64>" }
//     ] } }
//
// Each attachment is run through Claude vision; the final composed capture is
// sent through the standard intake pipeline as source: "email".

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { analyzeIntake, persistIntake, createProposalsFromIntake } from "@/lib/server/intake";
import { extractFromAttachment, ALLOWED_MEDIA } from "@/lib/server/vision";

interface InboundAttachment {
  filename?: string;
  contentType?: string;
  content?: string; // base64
}

interface InboundPayload {
  type?: string;
  data?: {
    from?: string;
    to?: string[] | string;
    subject?: string;
    text?: string;
    html?: string;
    attachments?: InboundAttachment[];
  };
}

function verifySignature(req: NextRequest): boolean {
  const expected = process.env.RESEND_WEBHOOK_SECRET;
  if (!expected) return true; // dev: no secret = allow
  const provided = req.headers.get("x-resend-secret") ?? req.headers.get("authorization");
  return provided === expected || provided === `Bearer ${expected}`;
}

function extractHouseholdToken(addresses: string[] | string | undefined): string | null {
  const list = Array.isArray(addresses) ? addresses : addresses ? [addresses] : [];
  for (const raw of list) {
    const m = raw.toLowerCase().match(/house-([a-z0-9_-]{1,64})@/);
    if (m) return m[1];
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!verifySignature(req)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = (await req.json()) as InboundPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed JSON." }, { status: 400 });
  }

  const data = payload.data;
  if (!data) return NextResponse.json({ ok: false, error: "Missing data envelope." }, { status: 400 });

  const token = extractHouseholdToken(data.to);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Could not parse household token from To address." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });

  const { data: household } = await supabase
    .from("households")
    .select("id")
    .eq("inbound_address_token", token)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ ok: false, error: "Unknown household token." }, { status: 404 });
  }
  const householdId = (household as { id: string }).id;

  const draftInboxId = `inb_${crypto.randomUUID()}`;
  const subject = (data.subject ?? "").trim();
  const text = (data.text ?? "").trim();
  const headerPrefix = subject ? `[Email: ${subject}]\nFrom: ${data.from ?? "unknown"}\n\n` : `[Email]\nFrom: ${data.from ?? "unknown"}\n\n`;

  const attachmentTexts: string[] = [];
  for (const att of (data.attachments ?? []).slice(0, 5)) {
    if (!att.content || !att.contentType) continue;
    if (!ALLOWED_MEDIA.includes(att.contentType as (typeof ALLOWED_MEDIA)[number])) continue;
    const result = await extractFromAttachment({
      base64: att.content,
      mediaType: att.contentType as (typeof ALLOWED_MEDIA)[number],
      userHint: subject || undefined,
      inboxItemId: draftInboxId,
      householdId,
    });
    if (result) attachmentTexts.push(result.text);
  }

  const composed = [headerPrefix + text, ...attachmentTexts].join("\n\n").slice(0, 8000);
  if (!composed.trim()) {
    return NextResponse.json({ ok: false, error: "Email had no extractable content." }, { status: 422 });
  }

  const intake = await analyzeIntake(composed, "email", householdId);
  const persistence = await persistIntake(intake);
  if (!persistence.persisted) {
    return NextResponse.json({ ok: false, error: persistence.error ?? "persist failed" }, { status: 500 });
  }
  const proposals = await createProposalsFromIntake(intake);

  return NextResponse.json({
    ok: true,
    inboxItemId: intake.id,
    proposalsCreated: proposals.length,
    householdId,
  });
}
