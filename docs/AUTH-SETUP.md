# Sign-in setup (Supabase Auth)

Magic-link sign-in depends on three settings **in the Supabase dashboard**, not in
this repo. The app code is correct on its own but cannot work until these match.
Getting any one of them wrong fails silently: the link appears to work, lands you
on a page, and you are still signed out.

## 1. URL Configuration

Dashboard → **Authentication → URL Configuration**

| Setting | Value |
|---|---|
| Site URL | `https://hq.cameronburden.com` |
| Redirect URLs | `https://hq.cameronburden.com/**` |

Add `https://chief-of-staff-*.vercel.app/**` as well if you want preview
deployments to be able to sign in.

**Why this matters.** `app/api/auth/magic-link/route.ts` asks Supabase for a
callback at the request's own origin. Supabase checks that against the Redirect
URLs allow-list and, if it is not listed, **silently discards it** and
substitutes the Site URL. There is no error — the call succeeds and the email
sends. You can confirm the allow-list is wrong by asking for a deliberately
bogus redirect and seeing the same answer come back:

```
curl -sS -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/generate_link" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --data '{"type":"magiclink","email":"you@example.com","redirect_to":"https://hq.cameronburden.com/api/auth/callback"}'
```

If `redirect_to` in the returned `action_link` is not the host you asked for,
the allow-list is the problem. A session set on the wrong hostname is invisible
to the right one, so every visit to the real domain starts signed out and
`proxy.ts` bounces you to `/login?next=…`.

## 2. Magic Link email template

Dashboard → **Authentication → Emails → Magic Link**

```html
<a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=email">
  Sign in to Burden House
</a>
```

**Why this matters.** `app/api/auth/callback/route.ts` verifies the sign-in with
`verifyOtp({ token_hash })`, so it needs `token_hash` as a **query parameter**.

Supabase's *default* template uses `{{ .ConfirmationURL }}`, which routes through
`/auth/v1/verify` and returns the session in a **URL fragment**
(`#access_token=…`) pointed at the bare origin. A fragment is never sent to the
server, so the callback never runs, `proxy.ts` sees no session, and you land on
`/login`. The default template cannot work with this app.

## 3. Who is allowed in

`HOUSEHOLD_MEMBER_EMAILS` (Vercel env var) is a comma-separated allow-list.
An email on it joins the household on first sign-in. Anyone else with no
existing `household_memberships` row is signed straight back out to
`/login?auth=not_member`.

## Reading the failure

The `auth` query parameter on `/login` says which stage failed:

| Landing on | Meaning |
|---|---|
| `/login?next=…` with no `auth` | No session in **this browser**. Normal when signed out; if it happens right after clicking a link, the session was set on another hostname or in another browser. |
| `/login?auth=error` | The callback ran without a `token_hash` — almost always the email template (§2). |
| `/login?auth=verify_failed` | `token_hash` present but rejected: already used, expired, or wrong `type`. |
| `/login?auth=not_member` | Verified fine, but no membership and not on the invite list (§3). |
| `/login?auth=not_configured` | Supabase env vars missing on the deployment. |

## One more trap

The session cookie is per-hostname **and** per-browser. Opening the link in a
mail client's in-app browser puts the session in that browser's cookie jar, not
Safari's. Long-press the link and "Open in Safari" to keep one jar.
