// Session wall. Every page and API route requires a Supabase session except:
//   - /login and /api/auth/*   (how you get a session)
//   - /wall and /api/wall/*    (wall iPad; verified by the wall_session cookie)
//   - /api/tap                 (NFC stickers; verified by a signed per-tag token)
//   - the vehicle log form and its POST, when the URL carries a `k` token
//     (NFC car stickers; verified by a signed per-vehicle token)
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

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
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
