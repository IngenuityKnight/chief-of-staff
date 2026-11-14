// Where to send someone once they have signed in.
//
// proxy.ts puts the page you were refused on into /login?next=<path>. That has
// to survive a round trip through an email, so it rides in a short-lived
// cookie set when the link is requested rather than on the magic link itself:
// appending a query string to emailRedirectTo can fail Supabase's Redirect
// URLs allow-list, and a login that cannot complete is worse than a login that
// lands on the wrong page.
//
// The value originates in a query string, so it is attacker-controlled and is
// only ever allowed to be a same-origin path.

export const NEXT_COOKIE = "cos_next";
export const NEXT_COOKIE_MAX_AGE = 15 * 60; // seconds; a link is used quickly or not at all

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (raw.length > 512) return null;

  // Must be a rooted path on this origin.
  if (raw[0] !== "/") return null;

  // "//evil.com" and "/\evil.com" are protocol-relative URLs to browsers, and
  // would send a freshly signed-in member straight off the site.
  if (raw[1] === "/" || raw[1] === "\\") return null;

  // No scheme smuggled in, and no control characters or newlines that could
  // split a header.
  if (raw.includes("://")) return null;
  if (/[\x00-\x1f\x7f]/.test(raw)) return null;

  // Bouncing back to /login would loop.
  if (raw === "/login" || raw.startsWith("/login?") || raw.startsWith("/login#")) return null;

  return raw;
}
