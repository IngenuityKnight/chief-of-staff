// TEMPORARY — delete this file after copying GOOGLE_REFRESH_TOKEN to Vercel.

import { NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = "https://chief-of-staff-pied.vercel.app/api/auth/google";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Step 2: Google redirected back with a code — exchange it for tokens
  if (code) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await res.json() as Record<string, string>;

    if (tokens.error) {
      return new Response(
        `<html><body style="font-family:monospace;background:#0f172a;color:#f87171;padding:2rem">
          <h2>Error: ${tokens.error_description ?? tokens.error}</h2>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response(
      `<html><body style="font-family:monospace;background:#0f172a;color:#e2e8f0;padding:2rem;line-height:1.8">
        <h2 style="color:#34d399">✅ Got your refresh token!</h2>
        <p>Add these to <strong>Vercel → Project Settings → Environment Variables</strong>:</p>
        <table style="border-collapse:collapse;width:100%">
          <tr>
            <td style="color:#94a3b8;padding:6px 12px 6px 0;white-space:nowrap">GOOGLE_CLIENT_ID</td>
            <td style="background:#1e293b;padding:6px 12px;border-radius:4px;word-break:break-all">${CLIENT_ID}</td>
          </tr>
          <tr><td colspan="2" style="padding:4px"></td></tr>
          <tr>
            <td style="color:#94a3b8;padding:6px 12px 6px 0;white-space:nowrap">GOOGLE_CLIENT_SECRET</td>
            <td style="background:#1e293b;padding:6px 12px;border-radius:4px;word-break:break-all">${CLIENT_SECRET}</td>
          </tr>
          <tr><td colspan="2" style="padding:4px"></td></tr>
          <tr>
            <td style="color:#94a3b8;padding:6px 12px 6px 0;white-space:nowrap">GOOGLE_REFRESH_TOKEN</td>
            <td style="background:#1e293b;padding:6px 12px;border-radius:4px;word-break:break-all">${tokens.refresh_token}</td>
          </tr>
          <tr><td colspan="2" style="padding:4px"></td></tr>
          <tr>
            <td style="color:#94a3b8;padding:6px 12px 6px 0;white-space:nowrap">GOOGLE_CALENDAR_ID</td>
            <td style="background:#1e293b;padding:6px 12px;border-radius:4px">primary</td>
          </tr>
        </table>
        <p style="color:#f59e0b;margin-top:2rem">⚠️ Delete <code>app/api/auth/google/route.ts</code> from the repo after you've saved these values.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (error) {
    return new Response(`Auth error: ${error}`, { status: 400 });
  }

  // Step 1: No code yet — check credentials then redirect to Google
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(
      `<html><body style="font-family:monospace;background:#0f172a;color:#f87171;padding:2rem">
        <h2>⚠️ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in Vercel yet.</h2>
        <p>Add them to Vercel environment variables first, then redeploy and visit this page again.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
