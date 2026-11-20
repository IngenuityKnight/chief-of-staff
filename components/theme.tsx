"use client";

// Light and dark, remembered.
//
// The preference lives in localStorage rather than the database on purpose:
// it belongs to the device, not the person. The iPad on the nightstand wants
// dark at 6am; the phone in a sunlit kitchen does not, and syncing them would
// make both wrong half the time.

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export const THEME_KEY = "cos_theme";

/**
 * Runs before first paint, inlined in <head>. Without it the document renders
 * with the default theme and repaints once React hydrates — a white flash on
 * a dark page, at the exact hour you least want one.
 *
 * Stringified rather than imported because it has to execute before any
 * bundle loads.
 */
export const THEME_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});
if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}
document.documentElement.setAttribute("data-theme",t);
}catch(e){}})();`;

function current(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function useTheme(): [Theme, () => void] {
  // Starts dark and corrects on mount: the server cannot know what the device
  // chose, and guessing would cause a hydration mismatch.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => setTheme(current()), []);

  const toggle = useCallback(() => {
    const next: Theme = current() === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing, or storage full. The theme still applies for this
      // visit; it just will not be remembered, which is survivable.
    }
    setTheme(next);
  }, []);

  return [theme, toggle];
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, toggle] = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`grid h-11 w-11 place-items-center rounded-xl border border-edge text-slate-400 transition hover:text-slate-100 ${className}`}
    >
      {theme === "light" ? (
        // Moon — tapping this goes dark
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      ) : (
        // Sun — tapping this goes light
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

// ── Night dimming ─────────────────────────────────────────────
// The wall dims itself overnight. Some rooms want that, some do not (a
// hallway with the lights on at 11pm), so it can be switched off — per
// device, for the same reason as the theme.

export const DIM_KEY = "cos_night_dim";
const DIM_EVENT = "cos-night-dim";

function readDim(): boolean {
  try {
    return localStorage.getItem(DIM_KEY) !== "off";
  } catch {
    return true;
  }
}

/** [enabled, toggle]. On by default; stays in sync across components. */
export function useNightDim(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readDim());
    const sync = () => setEnabled(readDim());
    window.addEventListener(DIM_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DIM_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !readDim();
    try {
      localStorage.setItem(DIM_KEY, next ? "on" : "off");
    } catch {
      // Not remembered, but still applies until the page reloads.
    }
    setEnabled(next);
    window.dispatchEvent(new Event(DIM_EVENT));
  }, []);

  return [enabled, toggle];
}
