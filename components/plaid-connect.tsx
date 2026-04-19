"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { getPassword, setPassword } from "@/lib/client/editor-password";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

interface PlaidConnectProps {
  onSuccess?: (institutionName: string, accountCount: number) => void;
}

export function PlaidConnect({ onSuccess }: PlaidConnectProps) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPasswordState] = useState<string>("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  async function fetchLinkToken(pw: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "x-editor-password": pw },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create link token.");
      setPassword(pw);
      setLinkToken(data.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  function handleConnectClick() {
    const saved = getPassword();
    if (saved) {
      fetchLinkToken(saved);
    } else {
      setShowPasswordPrompt(true);
    }
  }

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      const pw = getPassword();
      if (!pw) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-editor-password": pw,
          },
          body: JSON.stringify({ publicToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to connect account.");
        router.refresh();
        onSuccess?.(data.institutionName ?? "Bank", data.accountCount ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    [router, onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: (public_token) => onPlaidSuccess(public_token),
    onExit: () => setLinkToken(null),
  });

  // Open Link automatically once we have a token
  if (linkToken && ready) {
    open();
  }

  if (showPasswordPrompt) {
    return (
      <div className="rounded-lg border border-edge bg-ink-900/60 p-4">
        <p className="mb-3 text-sm text-slate-300">Enter editor password to connect a bank account:</p>
        <div className="flex gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPasswordState(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setShowPasswordPrompt(false);
                fetchLinkToken(password);
              }
            }}
            placeholder="Editor password"
            className="flex-1 rounded-md border border-edge bg-ink-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
            autoFocus
          />
          <button
            onClick={() => {
              setShowPasswordPrompt(false);
              fetchLinkToken(password);
            }}
            className="rounded-md bg-signal-blue/20 px-3 py-1.5 text-sm font-medium text-signal-blue hover:bg-signal-blue/30"
          >
            Connect
          </button>
          <button
            onClick={() => setShowPasswordPrompt(false)}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleConnectClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-md border border-edge bg-ink-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-signal-blue/40 hover:bg-ink-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <Building2 className="h-4 w-4 text-slate-400" />
        )}
        Connect Bank Account
      </button>
      {error && <p className="mt-1.5 text-xs text-signal-red">{error}</p>}
    </div>
  );
}
