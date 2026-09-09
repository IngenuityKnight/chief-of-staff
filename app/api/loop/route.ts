import { NextRequest, NextResponse } from 'next/server';
import { captureNotice, listCaptures, loopIdentity, getCapture, processCapture, updateCapture, LoopError } from '@/lib/server/household-loop';
import { rateLimit, rateLimitKey } from '@/lib/server/rate-limit';
import type { LoopCommand } from '@/lib/household-loop';

export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }); }
function failure(error: unknown) {
  return reply({ error: error instanceof LoopError ? error.message : 'Unable to process this request. Your original notice has not been deleted.' }, error instanceof LoopError ? error.status : 500);
}
export async function GET() {
  try { const identity = await loopIdentity(); return reply({ captures: await listCaptures(identity), ...identity }); }
  catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    const identity = await loopIdentity();
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) throw new LoopError('Cross-origin request rejected.', 403);
    const limit = rateLimit(rateLimitKey('household-loop', identity.userId, req), { limit: 15, windowMs: 60000 });
    if (!limit.ok) throw new LoopError('Too many requests. Try again in a minute.', 429);
    const raw = await req.text();
    if (raw.length > 100000) throw new LoopError('Request is too large.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new LoopError('Invalid JSON.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new LoopError('Invalid request.');
    if (body.action === 'capture') {
      if (typeof body.text !== 'string' || typeof body.key !== 'string' || !/^[\da-f-]{36}$/i.test(body.key)) throw new LoopError('Invalid capture.');
      return reply({ capture: await captureNotice(identity, { text: body.text, source: 'paste', key: `paste:${body.key}` }) });
    }
    if (typeof body.id !== 'string' || !/^[\da-f-]{36}$/i.test(body.id)) throw new LoopError('Invalid capture ID.');
    if (body.action === 'retry') return reply({ capture: await processCapture(identity, await getCapture(identity, body.id)) });
    if (!Number.isInteger(body.revision) || typeof body.itemId !== 'string' || (body.note !== undefined && typeof body.note !== 'string')) throw new LoopError('Invalid update.');
    return reply({ capture: await updateCapture(identity, body.id, body.revision, body as LoopCommand) });
  } catch (error) { return failure(error); }
}
