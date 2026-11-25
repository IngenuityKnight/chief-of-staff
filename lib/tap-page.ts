// The tiny page a phone shows after an NFC tap or an undo. Plain HTML rather
// than a React route: it has to render instantly on whatever phone touched
// the chip, signed in or not.

import { NextResponse } from "next/server";
import { UNDO_WINDOW_MS } from "@/lib/tap-token";

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
}

/** title and body must already be escaped. */
export function tapPage(title: string, body: string, opts: { status?: number; undo?: string } = {}) {
  const seconds = Math.round(UNDO_WINDOW_MS / 1000);
  // The button counts down and then removes itself, so what the page offers
  // matches what the server will still accept. The server checks the expiry
  // regardless; this only keeps the page honest.
  const undo = opts.undo
    ? `<form id="undo" method="post" action="/api/tap/undo">
<input type="hidden" name="u" value="${escapeHtml(opts.undo)}">
<button aria-label="Undo">Undo <span id="n" aria-hidden="true">${seconds}</span>s</button></form>
<script>(()=>{let n=${seconds};const e=document.getElementById("n"),f=document.getElementById("undo");
const t=setInterval(()=>{n--;if(n<=0){clearInterval(t);f.remove()}else e.textContent=n},1000)})()</script>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14100B;color:#EFE9DF;font:18px/1.4 system-ui,sans-serif;text-align:center}
h1{font-size:28px;margin:0 0 8px}p{color:#A89C87;margin:0}
form{margin-top:28px}
button{font:inherit;font-size:16px;color:#EFE9DF;background:transparent;border:1px solid #3A3127;border-radius:12px;padding:12px 22px;min-width:140px}
button:active{background:#241D16}
</style></head><body><main><h1>${title}</h1><p>${body}</p>${undo}</main></body></html>`;
  return new NextResponse(html, {
    status: opts.status ?? 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
