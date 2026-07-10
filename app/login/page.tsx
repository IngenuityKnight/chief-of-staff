"use client";

// Magic-link sign-in. Renders as a full-screen layer above the app shell so
// the (empty, zero-count) rail behind it never reads as the product.

import { useState } from "react";
import { Sparkles, MailCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "sending") return;
    setState("sending");
    setError(null);

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "Could not send the link.");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
      setState("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-950 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-signal-blue to-signal-purple shadow-lg shadow-signal-blue/20">
            <Sparkles className="h-6 w-6 text-ink-950" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">Burden House</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in with your email — we&rsquo;ll send you a magic link.
          </p>
        </div>

        {state === "sent" ? (
          <div
            className="rounded-xl border border-signal-green/25 bg-signal-green/5 px-5 py-6 text-center"
            role="status"
            aria-live="polite"
          >
            <MailCheck className="mx-auto h-6 w-6 text-signal-green" />
            <p className="mt-2 text-sm font-semibold text-signal-green">Check your email</p>
            <p className="mt-1 text-xs text-slate-400">
              A sign-in link is on its way to {email}. It expires in about an hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="login-email" className="block text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-edge bg-ink-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-signal-blue/40 focus:outline-none focus:ring-2 focus:ring-signal-blue/20"
            />
            <button
              type="submit"
              disabled={state === "sending" || !email.trim()}
              className="w-full rounded-xl bg-signal-blue px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-signal-blue/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-blue disabled:opacity-40"
            >
              {state === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && (
              <p className="text-xs text-signal-red" role="alert">
                {error}
              </p>
            )}
          </form>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          First time here? Signing in creates your household automatically.
        </p>
      </div>
    </div>
  );
}
