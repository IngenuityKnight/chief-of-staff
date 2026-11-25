#!/usr/bin/env bash
# Run the app against the local Supabase (supabase start) instead of production.
#
# Process env beats .env.local in Next.js, so this overrides only the database
# and the secrets that sign things, and leaves `npm run dev` exactly as it was.
# Sign in as dev@local.test; the magic link lands in Mailpit, not a real inbox.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! status="$(supabase status -o env 2>/dev/null)"; then
  echo "Local Supabase isn't running. Start it with: supabase start" >&2
  exit 1
fi
eval "$(grep -E '^(API_URL|ANON_KEY|PUBLISHABLE_KEY|SERVICE_ROLE_KEY|MAILPIT_URL|STUDIO_URL)=' <<<"$status")"

export SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
# Local-only signing secrets: a URL made here can never work against production.
export TAP_SECRET="local-tap-secret-not-for-production"
export WALL_TOKEN="local-wall-token-not-for-production"
export CRON_SECRET="local-cron-secret"
export WALL_HOUSEHOLD_ID="00000000-0000-0000-0000-000000000001"
export DEFAULT_HOUSEHOLD_ID="00000000-0000-0000-0000-000000000001"
export HOUSEHOLD_MEMBER_EMAILS="dev@local.test"
# No real email leaves a local run: the backup would otherwise send to you.
unset RESEND_API_KEY BACKUP_EMAIL_TO BACKUP_EMAIL_FROM CANONICAL_HOST

echo "Local database: $API_URL   Studio: $STUDIO_URL   Mail: $MAILPIT_URL"
exec npx next dev "$@"
