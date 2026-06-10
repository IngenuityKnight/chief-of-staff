/**
 * One-time script to generate a Google OAuth refresh token.
 * No local server needed — paste the auth code manually.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/get-google-token.mjs
 */

import readline from "readline";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n❌  Missing credentials.\n");
  console.error("Run with:");
  console.error("  GOOGLE_CLIENT_ID=your_id GOOGLE_CLIENT_SECRET=your_secret node scripts/get-google-token.mjs\n");
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

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 1 — Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 2 — Sign in with cameron.burden@gmail.com");
console.log("         and click Allow.");
console.log("\nStep 3 — Google will show you a code. Paste it here.");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Paste the authorization code: ", async (code) => {
  rl.close();
  code = code.trim();

  if (!code) {
    console.error("No code entered.");
    process.exit(1);
  }

  console.log("\nExchanging code for tokens...");

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

  const tokens = await res.json();

  if (tokens.error) {
    console.error("\n❌  Error:", tokens.error_description ?? tokens.error);
    process.exit(1);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅  Success! Add these to Vercel environment variables:\n");
  console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`GOOGLE_CALENDAR_ID=primary`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
