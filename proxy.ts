// Session wall (Next 16 renamed this convention from middleware to proxy; it
// runs on the Node.js runtime, which is what the Supabase SSR client wants).
//
// Every page and API route requires a Supabase session except:
//   - /login and /api/auth/*   (how you get a session)
//   - /wall and /api/wall/*    (wall iPad; verified by the wall_session cookie)
//   - /api/tap                 (NFC stickers; verified by a signed per-tag token)
//   - the vehicle log form and its POST, when the URL carries a `k` token
//     (NFC car stickers; verified by a signed per-vehicle token)
//
// Two rules run before that check, because both fix sign-in links that arrive
// slightly wrong and would otherwise fail silently. See docs/AUTH-SETUP.md.
//
// As with /wall, being listed here only gets the request past the session
// check — the page and route handler still verify their own credential.
//
// Configuration states:
//   - Supabase entirely unconfigured → local preview with sample data.
//   - Service key set but public key missing → sessions are impossible; allow in
//     development, fail closed with 503 in production.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/api/auth/", "/api/wall/"];
const PUBLIC_EXACT = ["/login", "/wall", "/api/tap"];

// The vehicle sticker opens the form, which posts to the logs endpoint. Both
// only bypass the session check while a `k` token is present to verify.
const VEHICLE_TAP_PAGE = /^\/vehicles\/[0-9a-f-]{36}\/log$/i;
const VEHICLE_TAP_API = /^\/api\/vehicles\/[0-9a-f-]{36}\/logs$/i;

function isPublic(pathname: string, params: URLSearchParams): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (params.has("k")) {
    return VEHICLE_TAP_PAGE.test(pathname) || VEHICLE_TAP_API.test(pathname);
  }
  return false;
}

const CALLBACK = "/api/auth/callback";

// Supabase sends the sign-in token to whatever its dashboard's Site URL and
// email template say, which this repo cannot hold and cannot validate. Both
// have been wrong in practice, and both fail the same quiet way: the link
// works, a session is created, and it lands somewhere the real domain cannot
// read — so every later visit is signed out and bounces to /login.
//
// Rather than depend on that configuration being exact, accept the token
// wherever it arrives and route it ourselves.

// A session cookie belongs to one hostname. When the sign-in link points at a
// deployment alias instead of the domain the household actually uses, the
// session is set on the alias and the domain stays signed out forever. Send
// every production request to the canonical host first, carrying the token
// along, so there is only ever one cookie jar.
//
// Only in production: preview deployments each have their own hostname and
// must keep serving themselves. A no-op when CANONICAL_HOST is unset.
function canonicalRedirect(req: NextRequest): NextResponse | null {
  const canonical = process.env.CANONICAL_HOST;
  if (!canonical) return null;
  if (process.env.VERCEL_ENV !== "production") return null;

  const host = req.headers.get("host") ?? req.nextUrl.host;
  if (!host || host === canonical) return null;

  const target = new URL(req.nextUrl.toString());
  target.host = canonical;
  target.protocol = "https:";
  target.port = "";
  // 308 keeps the method, so a POST that lands on the alias is not silently
  // turned into a GET.
  return NextResponse.redirect(target, 308);
}

// The email template decides which path the token lands on. Point it at the
// callback and this never fires; point it at "/" (or anywhere else) and the
// token is still delivered rather than dropped on a page that cannot read it.
function callbackRedirect(req: NextRequest): NextResponse | null {
  const { pathname, searchParams } = req.nextUrl;
  if (pathname === CALLBACK) return null;
  const tokenHash = searchParams.get("token_hash");
  if (!tokenHash) return null;

  const target = new URL(CALLBACK, req.nextUrl.origin);
  target.searchParams.set("token_hash", tokenHash);
  target.searchParams.set("type", searchParams.get("type") ?? "email");
  return NextResponse.redirect(target);
}

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  const toCanonical = canonicalRedirect(req);
  if (toCanonical) return toCanonical;

  const toCallback = callbackRedirect(req);
  if (toCallback) return toCallback;

  if (isPublic(pathname, searchParams)) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasDatabase = Boolean(url && process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !publicKey) {
    if (!hasDatabase) return NextResponse.next(); // pure demo mode
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return NextResponse.json(
      {
        ok: false,
        error:
          "Auth is not configured: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY so sessions can be enforced.",
      },
      { status: 503 }
    );
  }

  // Refresh the session if needed and carry any rotated cookies forward.
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return res;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|apple-touch-icon).*)",
  ],
};
