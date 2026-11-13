/**
 * Modified script to generate Google OAuth refresh token using localhost callback.
 *
 * Setup:
 * 1. Add http://localhost:3000/callback to Google Cloud Console OAuth redirect URIs
 * 2. Run: GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/get-google-token-localhost.mjs
 */

import http from "http";
import { URL } from "url";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/callback";
const PORT = 3000;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n❌  Missing credentials.\n");
  console.error("Run with:");
  console.error("  GOOGLE_CLIENT_ID=your_id GOOGLE_CLIENT_SECRET=your_secret node scripts/get-google-token-localhost.mjs\n");
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

let server;
let tokenResolved = false;

const server_instance = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (parsedUrl.pathname === "/callback") {
    const code = parsedUrl.searchParams.get("code");
    const error = parsedUrl.searchParams.get("error");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h1>❌ Error</h1><p>${error}</p>`);
      console.error(`\n❌  Google error: ${error}`);
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>❌ No authorization code received</h1>");
      process.exit(1);
    }

    console.log("\n✅ Authorization received! Exchanging code for tokens...\n");

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <h1>✅ Success!</h1>
      <p>Authorization complete. Retrieving tokens...</p>
      <p>You can close this window.</p>
    `);

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

      const tokens = await tokenRes.json();

      if (tokens.error) {
        console.error("\n❌  Error:", tokens.error_description ?? tokens.error);
        process.exit(1);
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅  Success! Add these to Vercel environment variables:\n");
      console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log(`GOOGLE_CALENDAR_ID=primary`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      tokenResolved = true;
      server_instance.close(() => process.exit(0));
    } catch (err) {
      console.error("\n❌  Failed to exchange code:", err.message);
      process.exit(1);
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server_instance.listen(PORT, () => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Step 1 — Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Step 2 — Sign in with cameron.burden@gmail.com");
  console.log("         and click Allow.");
  console.log("\nStep 3 — You'll be redirected back. Tokens will appear below.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});

process.on("SIGINT", () => {
  server_instance.close(() => process.exit(0));
});
