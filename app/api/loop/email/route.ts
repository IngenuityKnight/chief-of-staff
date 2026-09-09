import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { captureNotice, LoopError } from '@/lib/server/household-loop';
import { rateLimit } from '@/lib/server/rate-limit';

export const maxDuration = 60;
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function mailbox(value: unknown): string {
  if (typeof value !== 'string') return '';
  return (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase();
}
export async function POST(req: NextRequest) {
  const secret = process.env.LOOP_RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  const userId = process.env.LOOP_OWNER_USER_ID;
  const householdId = process.env.LOOP_HOUSEHOLD_ID;
  const recipient = mailbox(process.env.LOOP_INBOUND_ADDRESS);
  const sender = mailbox(process.env.LOOP_FORWARDER_EMAIL);
  if (!secret || !apiKey || !userId || !householdId || !recipient || !sender) {
    return reply({ error: 'Private email capture is not configured.' }, 503);
  }
  const raw = await req.text();
  if (raw.length > 100000) return reply({ error: 'Webhook too large.' }, 413);
  let event: { type?: string; data?: { email_id?: string } };
  try {
    new Webhook(secret).verify(raw, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    });
    event = JSON.parse(raw);
    if (!event || typeof event !== 'object') throw new Error('Invalid event');
  } catch { return reply({ error: 'Invalid webhook signature.' }, 401); }
  if (event.type !== 'email.received') return reply({ ignored: true });
  const emailId = event.data?.email_id;
  if (!emailId || !/^[\da-f-]{36}$/i.test(emailId)) return reply({ error: 'Missing email ID.' }, 400);
  if (!rateLimit(`loop-email:${householdId}`, { limit: 30, windowMs: 60000 }).ok) return reply({ error: 'Retry later.' }, 429);
  try {
    const db = getSupabaseAdmin();
    if (!db) throw new LoopError('Database unavailable.', 503);
    const { data: member, error: membershipError } = await db.from('household_memberships')
      .select('user_id').eq('user_id', userId).eq('household_id', householdId).eq('role', 'owner').maybeSingle();
    if (membershipError || !member) throw new LoopError('Loop owner configuration is invalid.', 503);
    // Receiving webhooks contain metadata, not the email body. Retrieve from the
    // provider's fixed endpoint after verifying its signature. Never follow URLs in mail.
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new LoopError('Email retrieval failed; provider should retry.', 503);
    const mail = await response.json();
    if (!Array.isArray(mail.to) || !mail.to.some((to: unknown) => mailbox(to) === recipient) || mailbox(mail.from) !== sender) {
      return reply({ ignored: true, reason: 'Not an allowed forwarded household email.' });
    }
    const content = typeof mail.text === 'string' && mail.text.trim() ? mail.text
      : typeof mail.html === 'string' && mail.html.trim() ? `[Original HTML email; displayed as text]\n${mail.html}` : '[No email body available. Open the original email.]';
    const attachments = Array.isArray(mail.attachments) && mail.attachments.length
      ? `\n\n[${mail.attachments.length} attachment(s) not imported. Review attachments in your original email.]` : '';
    const text = `Subject: ${typeof mail.subject === 'string' ? mail.subject : '(no subject)'}\nForwarded from: ${sender}\n\n${content}${attachments}`;
    const capture = await captureNotice({ userId, householdId }, { text, source: 'email', key: `email:${emailId}` });
    return reply({ ok: true, captureId: capture.id });
  } catch (error) {
    return reply({ error: error instanceof LoopError ? error.message : 'Email capture failed; retry required.' }, error instanceof LoopError ? error.status : 503);
  }
}
