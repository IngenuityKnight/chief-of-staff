"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
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

  async function fetchLinkToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create link token.");
      setLinkToken(data.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  return (
    <div>
      <button
        onClick={fetchLinkToken}
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
