#!/usr/bin/env node
// Prints the URL to write onto each NFC sticker.
//
// Usage: TAP_SECRET=... npm run tap:urls -- [baseUrl] [vehicleId...]
//
// Any argument that looks like a URL overrides the base; any that looks like a
// UUID is treated as a vehicle and gets a fuel-log sticker URL. For example:
//   npm run tap:urls -- https://hq.cameronburden.com 232e2bdb-c90b-4805-b45e-186b8de5b0bc
import { tapToken, vehicleLogToken, MIN_SECRET_LENGTH } from "../lib/tap-token.ts";
import { TAP_TAGS } from "../lib/tap-tags.ts";

const secret = (process.env.TAP_SECRET ?? "").trim();
if (secret.length < MIN_SECRET_LENGTH) {
  console.error(`Set TAP_SECRET (at least ${MIN_SECRET_LENGTH} chars) to the same value as in Vercel.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "https://hq.cameronburden.com").replace(/\/$/, "");
const vehicleIds = args.filter((a) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a));

for (const [slug, tag] of Object.entries(TAP_TAGS)) {
  const url = `${base}/api/tap?tag=${encodeURIComponent(slug)}&k=${tapToken(slug, secret)}`;
  console.log(`${tag.place.padEnd(18)} ${tag.label.padEnd(28)} ${url}`);
}

for (const id of vehicleIds) {
  const url = `${base}/vehicles/${id}/log?k=${vehicleLogToken(id, secret)}`;
  console.log(`${"Car".padEnd(18)} ${`Fuel log ${id.slice(0, 8)}`.padEnd(28)} ${url}`);
}
