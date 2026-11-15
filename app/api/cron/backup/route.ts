// GET /api/cron/backup — the monthly off-site copy.
//
// The whole point is to survive this app and its database being gone, so the
// backup must leave the platform. It is emailed: the household already has an
// inbox, an inbox outlives any hosting account, and a CSV attachment opens in
// a spreadsheet without needing anything from this repo.
//
// Not behind the session wall (nobody is signed in at 9am on the 1st). The
// credential is CRON_SECRET, which Vercel sends as a bearer token on
// scheduled invocations. Without it set this route refuses to run rather than
// running unauthenticated, because it reads the entire household.

import { NextResponse, type NextRequest } from "next/server";
import { exportHousehold } from "@/lib/server/export";
import { getHouseholdForJob } from "@/lib/server/household";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
// The export is several round trips; the default is not generous enough once
// the logs have a few years in them.
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const to = (process.env.BACKUP_EMAIL_TO ?? "").trim();
  const from = (process.env.BACKUP_EMAIL_FROM ?? "").trim();
  if (!apiKey || !to || !from) {
    return NextResponse.json(
      { ok: false, error: "Backup email is not configured: set RESEND_API_KEY, BACKUP_EMAIL_TO and BACKUP_EMAIL_FROM." },
      { status: 503 }
    );
  }

  const householdId = getHouseholdForJob(process.env.WALL_HOUSEHOLD_ID);

  let files;
  try {
    files = await exportHousehold(householdId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  // An empty table still ships its file. A month with nothing in it is a fact
  // worth recording, and a missing attachment reads like a failed backup.
  const stamp = new Date().toISOString().slice(0, 10);
  const attachments = files.map((f) => ({
    filename: `${stamp}-${f.filename}`,
    content: Buffer.from(f.csv, "utf8").toString("base64"),
  }));

  const summary = files.map((f) => `${f.filename.replace(/\.csv$/, "")}: ${f.rows}`).join("\n");
  const total = files.reduce((n, f) => n + f.rows, 0);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Burden House records — ${stamp} (${total} rows)`,
      text:
        `Monthly copy of the household records, one CSV per table.\n\n${summary}\n\n` +
        `Keep this email: it is the copy that survives the site and the database going away.`,
      attachments,
    }),
  });

  if (!res.ok) {
    // Surface the provider's reason: a silent failure here is a backup that
    // only looks like it is running.
    const detail = await res.text().catch(() => "");
    console.error(`[cron/backup] Resend ${res.status}: ${detail.slice(0, 300)}`);
    return NextResponse.json({ ok: false, error: `Email provider returned ${res.status}.` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, files: files.length, rows: total });
}
