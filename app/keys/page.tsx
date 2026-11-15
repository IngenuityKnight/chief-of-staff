// /keys — the physical chips that can sign in as you.
//
// A freshly minted token is shown once, in the URL to write onto the chip,
// and then never again: only its hash is stored. Behind the session wall.

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { createKey, listKeys, revokeKey } from "@/lib/server/keys";

export const dynamic = "force-dynamic";

// The freshly minted token has to survive one redirect to be shown once. It
// travels in a cookie rather than the query string: a query string is written
// into the platform's request log and the browser's history, and this token is
// a sign-in credential, not an identifier.
const FRESH_COOKIE = "cos_fresh_key";

const card = "rounded-stone border border-edge bg-ink-900 p-4";
const ghost = "rounded-lg border border-edge px-3 py-2 text-sm text-slate-300";
const primary = "rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-ink-950";
const input =
  "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-blue/50 focus:outline-none";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

async function create(formData: FormData) {
  "use server";
  const hh = await getCurrentHousehold();
  const user = await getSessionUser();
  if (!hh || !user) return;
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  if (!label) return;
  const { token } = await createKey(hh, user.id, label);

  const jar = await cookies();
  jar.set(FRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/keys",
    maxAge: 120,
  });

  revalidatePath("/keys");
  redirect("/keys");
}

async function dismissFresh() {
  "use server";
  const jar = await cookies();
  jar.delete(FRESH_COOKIE);
  revalidatePath("/keys");
}

async function revoke(formData: FormData) {
  "use server";
  const hh = await getCurrentHousehold();
  if (!hh) return;
  const id = String(formData.get("id") ?? "");
  if (id) await revokeKey(hh, id);
  revalidatePath("/keys");
}

export default async function KeysPage() {
  const hh = await getCurrentHousehold();
  if (!hh) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-display text-2xl">No household for this login</h1>
      </main>
    );
  }

  // A server component can read a cookie but not write one, so the token is
  // cleared by the button below rather than by rendering the page. That is
  // also the better bargain: it stays until you say you have written it,
  // instead of disappearing on a stray reload mid-write. The cookie's own
  // two-minute lifetime is the backstop if the tab is simply abandoned.
  const jar = await cookies();
  const fresh = jar.get(FRESH_COOKIE)?.value;

  const keys = await listKeys(hh);
  const live = keys.filter((k) => !k.revokedAt);

  return (
    <main className="mx-auto max-w-xl px-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <h1 className="font-display text-2xl font-semibold">Keys</h1>
        <a href="/" className={ghost}>
          Home
        </a>
      </header>

      {fresh && (
        <section className="mb-4 rounded-stone border border-signal-amber/30 bg-signal-amber/5 p-4">
          <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-signal-amber">
            Write this onto the chip now
          </h2>
          <p className="mt-2 break-all rounded-lg border border-edge bg-ink-950 p-3 font-mono text-xs text-slate-100">
            {`/api/key?k=${fresh}`}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Prefix it with your site address. Only the hash is stored, so once this is dismissed it
            cannot be shown again — lose it before it reaches a chip and you revoke this key and
            mint another.
          </p>
          <form action={dismissFresh} className="mt-3">
            <button className={ghost}>Done — written to the chip</button>
          </form>
        </section>
      )}

      <section className={`${card} mb-4`}>
        <h2 className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">New key</h2>
        <p className="mb-3 text-sm text-slate-500">
          Name it after where the chip lives, so you know which one you are revoking.
        </p>
        <form action={create} className="flex flex-wrap gap-2">
          <input name="label" required maxLength={60} placeholder="e.g. Nightstand chip" aria-label="Key name" className={`${input} min-w-0 flex-1 basis-48`} />
          <button className={primary}>Create</button>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Keys {live.length > 0 && <span className="text-slate-500">· {live.length} active</span>}
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Anyone holding one of these chips can sign in as you. Keep them inside the house, and
          revoke one the moment you cannot find it.
        </p>

        {keys.length === 0 ? (
          <p className="text-sm text-slate-500">No keys yet.</p>
        ) : (
          <ul className="divide-y divide-edge">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${k.revokedAt ? "text-slate-500 line-through" : "text-slate-100"}`}>
                    {k.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    Added {when(k.createdAt)}
                    {k.revokedAt
                      ? ` · revoked ${when(k.revokedAt)}`
                      : k.lastUsedAt
                        ? ` · last used ${when(k.lastUsedAt)}`
                        : " · never used"}
                  </p>
                </div>
                {!k.revokedAt && (
                  <form action={revoke}>
                    <input type="hidden" name="id" value={k.id} />
                    <button className={`${ghost} text-signal-red`}>Revoke</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
