// Check-offs from the wall iPad. Authorised by the wall_session cookie (the
// same credential that lets the wall be read), and deliberately narrow: the
// wall can complete or reopen a task, mark upkeep done, and mark a bill paid.
// It cannot create, edit or delete anything.

import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { markBillPaid, markUpkeepDone, setTaskDone } from "@/lib/server/store";
import { wallHouseholdId, wallToday } from "@/lib/server/wall";
import { WALL_COOKIE, verifyWallSession } from "@/lib/wall-auth";

export const dynamic = "force-dynamic";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

export async function POST(req: NextRequest) {
  if (!verifyWallSession(req.cookies.get(WALL_COOKIE)?.value)) return json({ ok: false }, 404);

  const limit = rateLimit(rateLimitKey("wall-action", null, req), { limit: 60, windowMs: 5 * 60_000 });
  if (!limit.ok) return json({ ok: false, error: "Too many changes. Try again in a few minutes." }, 429);

  let body: { kind?: unknown; id?: unknown; done?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Bad request." }, 400);
  }
  const { kind, id } = body;
  if (typeof id !== "string" || !id || id.length > 64) return json({ ok: false, error: "Bad request." }, 400);

  const hh = wallHouseholdId();
  try {
    if (kind === "task") {
      await setTaskDone(hh, id, body.done !== false);
    } else if (kind === "upkeep") {
      await markUpkeepDone(hh, id, (await wallToday(hh)).today);
    } else if (kind === "bill") {
      await markBillPaid(hh, id, (await wallToday(hh)).today);
    } else {
      return json({ ok: false, error: "Bad request." }, 400);
    }
  } catch {
    return json({ ok: false, error: "Couldn't save that. Try again." }, 503);
  }
  return json({ ok: true });
}
