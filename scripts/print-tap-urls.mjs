#!/usr/bin/env node
// Prints the URL to write onto each NFC sticker.
// Usage: TAP_SECRET=... node --experimental-strip-types scripts/print-tap-urls.mjs [baseUrl]
import { tapToken, MIN_SECRET_LENGTH } from "../lib/tap-token.ts";
import { TAP_TAGS } from "../lib/tap-tags.ts";

const secret = process.env.TAP_SECRET ?? "";
if (secret.length < MIN_SECRET_LENGTH) {
  console.error(`Set TAP_SECRET (at least ${MIN_SECRET_LENGTH} chars) to the same value as in Vercel.`);
  process.exit(1);
}
const base = (process.argv[2] ?? "https://hq.cameronburden.com").replace(/\/$/, "");
for (const [slug, tag] of Object.entries(TAP_TAGS)) {
  const url = `${base}/api/tap?tag=${encodeURIComponent(slug)}&k=${tapToken(slug, secret)}`;
  console.log(`${tag.place.padEnd(18)} ${tag.label.padEnd(28)} ${url}`);
}
