// NFC tag endpoint. Each sticker holds a URL like
//   https://hq.cameronburden.com/api/tap?tag=hvac-filter&k=<token>
// Tapping it with any phone opens this URL, which logs a tap_events row and
// shows a tiny confirmation page. The per-tag HMAC token is the credential.
//
// GET has a side effect on purpose (NFC tags can only open URLs). Mitigations:
// signed token, rate limit, and a 2-minute dedupe so link previews or a
// double-tap don't log twice.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { wallHouseholdId } from "@/lib/server/wall";
import { TAP_TAGS, isTapSlug } from "@/lib/tap-tags";
import { verifyTapToken } from "@/lib/tap-token";

export const dynamic = "force-dynamic";

const DEDUPE_MS = 2 * 60_000;

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14100B;color:#EFE9DF;font:18px/1.4 system-ui,sans-serif;text-align:center}
h1{font-size:28px;margin:0 0 8px}p{color:#A89C87;margin:0}
</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function GET(req: NextRequest) {
  const secret = (process.env.TAP_SECRET ?? "").trim();
  const slug = req.nextUrl.searchParams.get("tag") ?? "";
  const token = req.nextUrl.searchParams.get("k") ?? "";

  const limit = rateLimit(rateLimitKey("tap", null, req), { limit: 30, windowMs: 10 * 60_000 });
  if (!limit.ok) return page("Slow down", "Too many taps. Try again in a few minutes.", 429);

  if (!isTapSlug(slug) || !verifyTapToken(slug, token, secret)) {
    return page("Unknown tag", "This tag isn't recognized.", 404);
  }

  const tag = TAP_TAGS[slug];
  const supabase = getSupabaseAdmin();
  if (!supabase) return page("Not saved", "The household database isn't configured.", 503);

  const householdId = wallHouseholdId();
  const since = new Date(Date.now() - DEDUPE_MS).toISOString();

  try {
    const { data: recent, error: readErr } = await supabase
      .from("tap_events")
      .select("id")
      .eq("household_id", householdId)
      .eq("slug", slug)
      .gte("created_at", since)
      .limit(1);
    if (readErr) throw readErr;

    if (!recent?.length) {
      const { error } = await supabase
        .from("tap_events")
        .insert({ household_id: householdId, slug, label: tag.label });
      if (error) throw error;
    }
  } catch {
    return page("Not saved", "Couldn't reach the household database. Try again shortly.", 503);
  }

  return page("Logged ✓", escapeHtml(tag.label));
}
