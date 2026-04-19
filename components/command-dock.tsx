"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, Sparkles, Radio } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  role: "user" | "chief";
  text: string;
  routing?: { primary: string; secondary: string[]; category: string };
  proposedTasks?: string[];
};

export function CommandDock() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "seed",
      role: "chief",
      text: "Ready when you are. Just dump whatever's on your mind — I'll figure out which agent should handle it.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("cos:open-dock", onOpen);
    // Cmd/Ctrl-K to open
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("cos:open-dock", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      const reply: Msg = {
        id: crypto.randomUUID(),
        role: "chief",
        text: data.analysis ?? "Captured. Routing now.",
        routing: data.routing,
        proposedTasks: data.proposedTasks,
      };
      setMessages((m) => [...m, reply]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "chief", text: "Couldn't reach the intake endpoint. Captured locally." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating launcher when closed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-signal-blue to-signal-purple px-4 py-3 text-sm font-semibold text-ink-950 shadow-2xl shadow-signal-blue/30 transition hover:scale-105"
        >
          <Radio className="h-4 w-4" />
          Brief the Chief
          <span className="kbd !text-ink-950/60 !border-ink-950/20 !bg-white/20">⌘K</span>
        </button>
      )}

      {/* Dock */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[420px] flex-col overflow-hidden rounded-xl border border-edge bg-ink-900 shadow-2xl shadow-black/50 animate-slide-up">
          <div className="flex items-center justify-between border-b border-edge px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-signal-blue to-signal-purple">
                <Sparkles className="h-3.5 w-3.5 text-ink-950" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Chief of Staff</div>
                <div className="text-2xs uppercase tracking-wider text-slate-500">Triage · Routing · Coord</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-ink-800 hover:text-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-signal-blue text-ink-950 font-medium"
                      : "bg-ink-800 text-slate-200 ring-1 ring-inset ring-white/5"
                  )}
                >
                  <div>{m.text}</div>
                  {m.routing && (
                    <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-2xs uppercase tracking-wider text-slate-500">Routing</span>
                        <span className={AGENTS[m.routing.primary as keyof typeof AGENTS]?.pillClass ?? "pill-ghost"}>
                          {AGENTS[m.routing.primary as keyof typeof AGENTS]?.shortName ?? m.routing.primary}
                        </span>
                        {m.routing.secondary.map((s) => (
                          <span key={s} className={AGENTS[s as keyof typeof AGENTS]?.pillClass ?? "pill-ghost"}>
                            +{AGENTS[s as keyof typeof AGENTS]?.shortName ?? s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.proposedTasks && m.proposedTasks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-2xs uppercase tracking-wider text-slate-500">Proposed tasks</div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {m.proposedTasks.map((t, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-blue" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-ink-800 px-3.5 py-2.5 ring-1 ring-inset ring-white/5">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-edge p-3">
            <div className="flex items-end gap-2 rounded-lg border border-edge bg-ink-950 px-3 py-2 focus-within:border-signal-blue/50">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="What's on your mind?"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="grid h-7 w-7 place-items-center rounded-md bg-signal-blue text-ink-950 transition hover:bg-signal-blue/80 disabled:opacity-30"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-600">
              <span>Enter to send · Shift+Enter newline</span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-signal-green" />
                intake live
              </span>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
