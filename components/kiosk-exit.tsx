"use client";

// A way off the kiosk views that is not on the kiosk views.
//
// /wall and /today are meant to be looked at, not operated, so a visible
// "home" button is clutter on a screen whose whole job is to show one thing
// well. But the iPad running them is also just an iPad, and sometimes you
// want the rest of the app.
//
// Long-press rather than a tap or a double-tap: a wall gets brushed, wiped,
// and prodded by a toddler, and 650ms of deliberate contact is the cheapest
// thing that none of those produce. A drag cancels it, so scrolling the
// schedule never opens this by accident.
//
// The press target is invisible but the links are not hidden from assistive
// technology — there is a focusable skip-link for anyone who cannot long
// press, because an affordance only reachable by gesture is unreachable by
// keyboard.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNightDim, useTheme } from "@/components/theme";

const HOLD_MS = 650;
const AUTO_CLOSE_MS = 12_000;
/** A press that wanders this far is a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 10;

interface Exit {
  href: string;
  label: string;
  hint: string;
}

const EXITS: Exit[] = [
  { href: "/", label: "House", hint: "To-dos, dinners, upkeep, cars" },
  { href: "/dash", label: "Command centre", hint: "Your three, goals, journal" },
  { href: "/today", label: "Bedside", hint: "The day, close up" },
  { href: "/wall", label: "Wall", hint: "The day, across the room" },
];

export default function KioskExit({
  children,
  from,
  className = "",
}: {
  children: React.ReactNode;
  /** The view doing the asking, so it is not offered as a destination. */
  from: "/wall" | "/today";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [dimEnabled, toggleDim] = useNightDim();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    origin.current = null;
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  // Opened and then forgotten is the normal case on a wall, so it closes
  // itself rather than sitting there as a menu nobody meant to leave open.
  useEffect(() => {
    if (!open) return;
    closeTimer.current = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open]);

  function onPointerDown(e: React.PointerEvent) {
    origin.current = { x: e.clientX, y: e.clientY };
    holdTimer.current = setTimeout(() => setOpen(true), HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = origin.current;
    if (!start) return;
    if (
      Math.abs(e.clientX - start.x) > MOVE_TOLERANCE_PX ||
      Math.abs(e.clientY - start.y) > MOVE_TOLERANCE_PX
    ) {
      clearHold();
    }
  }

  const destinations = EXITS.filter((e) => e.href !== from);

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onPointerMove={onPointerMove}
        // Long-press on iOS otherwise raises the text-selection callout.
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
        className={className}
      >
        {children}
      </div>

      {/* Visible only to keyboard and assistive tech: the gesture above is
          unreachable without a pointer, and a hidden exit should not also be
          an inaccessible one. */}
      <a
        href="/"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:border focus:border-edge focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-slate-100"
      >
        Leave this view
      </a>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-6 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Go somewhere else"
        >
          <div
            className="w-full max-w-sm rounded-stone border border-edge bg-ink-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Go to
            </h2>
            <ul className="space-y-1">
              {destinations.map((d) => (
                <li key={d.href}>
                  <a
                    href={d.href}
                    className="flex min-h-14 flex-col justify-center rounded-xl px-3 transition hover:bg-ink-800"
                  >
                    <span className="text-lg text-slate-100">{d.label}</span>
                    <span className="text-sm text-slate-500">{d.hint}</span>
                  </a>
                </li>
              ))}
            </ul>
            {/* Light and dark live here rather than on the face of the
                view: same reasoning as the exits. The choice is remembered
                per device, so the nightstand and the hallway can differ. */}
            <button
              onClick={toggleTheme}
              className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-edge px-3 text-slate-100 transition hover:bg-ink-800"
            >
              <span>{theme === "light" ? "Switch to dark" : "Switch to light"}</span>
              <span className="text-sm text-slate-500">{theme === "light" ? "Light" : "Dark"} now</span>
            </button>
            {/* Only the wall dims overnight, so only the wall offers this. */}
            {from === "/wall" && (
              <button
                onClick={toggleDim}
                className="mt-2 flex min-h-12 w-full items-center justify-between rounded-xl border border-edge px-3 text-slate-100 transition hover:bg-ink-800"
              >
                <span>{dimEnabled ? "Turn off night dimming" : "Turn on night dimming"}</span>
                <span className="text-sm text-slate-500">10pm–6am · {dimEnabled ? "On" : "Off"}</span>
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="mt-2 min-h-12 w-full rounded-xl border border-edge text-slate-400"
            >
              Stay here
            </button>
            <p className="mt-3 text-center text-xs text-slate-600">
              House and the command centre need you signed in on this device.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
