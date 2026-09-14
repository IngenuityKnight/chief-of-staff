// Session wall (audit S4). Every page and API route requires a Supabase
// session except:
//   - /login and /api/auth/*            (how you get a session)
//   - /api/cron/* and /api/jobs/*       (CRON_SECRET bearer, fail-closed in the routes)
//   - /api/intake/email                 (Resend webhook, secret-verified in the route)
//   - /api/sync/calendar                (n8n webhook, secret-verified in the route)
//
// Configuration states:
//   - Supabase entirely unconfigured → demo mode, everything open (mock data only).
//   - Service key set but public key missing → sessions are impossible; allow in
//     development, fail closed with 503 in production (a live database must not
//     sit behind no wall).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/api/auth/", "/api/cron/", "/api/jobs/"];
// Exact paths only — /api/sync/calendar/outbound is browser-called and must
// stay behind the session wall.
const PUBLIC_EXACT = ["/login", "/api/intake/email", "/api/loop/email", "/api/sync/calendar"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Internal cron fan-out (e.g. /api/cron/shopping → /api/shopping/generate)
  // authenticates with the CRON_SECRET bearer instead of a session. The
  // target routes re-verify the header themselves before trusting it.
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    pathname.startsWith("/api/") &&
    req.headers.get("authorization") === `Bearer ${cronSecret}`
  ) {
    return NextResponse.next();
  }

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
