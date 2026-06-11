/** @type {import('tailwindcss').Config} */
// ─── HEARTH DESIGN SYSTEM ────────────────────────────────────────────────
// Token names are kept stable (ink, edge, signal-*) so every page in the
// app adopts the new visual language through the token layer alone.
// See docs/DESIGN-BRIEF.md for the rationale behind each value.
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core surfaces — charred oak, dark but warm. The room at night.
        ink: {
          950: "#14100B",
          900: "#191410",
          850: "#1E1813",
          800: "#241D16",
          700: "#2D241B",
          600: "#3A2E22",
          500: "#4A3B2C",
        },
        edge: "#2E261C",
        // State + agent accents — firelight temperatures, never alarm colors
        signal: {
          green: "#97B873",  // sage — the house is well
          amber: "#E8A857",  // ember — needs tending
          red: "#E07856",    // clay — urgent, still warm
          blue: "#7FA5D6",   // dusk — the Chief (the one deliberate cool note)
          purple: "#B59AC6", // heather — Money
          cyan: "#7FBDB0",   // eucalyptus — Schedule
          pink: "#D98E9F",   // rose clay — Roster
        },
        // Warm the entire text ramp: existing pages use text-slate-* heavily,
        // so overriding slate converts cool grays to parchment/umber app-wide.
        slate: {
          50: "#F7F3EB",
          100: "#EFE9DF",
          200: "#E2DACB",
          300: "#CFC5B2",
          400: "#A89C87",
          500: "#857A67",
          600: "#5F5647",
          700: "#463F34",
          800: "#322C24",
          900: "#211D17",
          950: "#14110C",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter-tight)", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        stone: "20px", // pulse surfaces — worn river stone
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "rise 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        breathe: "breathe 6s ease-in-out infinite",
        rise: "rise 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        rise: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
