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
        // Values live in app/globals.css as CSS variables so the same token
        // can mean "charred oak" at night and "warm paper" by day. Names stay
        // literal to the role, not to the colour: ink-950 is always the
        // furthest-back surface, whichever theme is on.
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          850: "rgb(var(--ink-850) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
        },
        edge: "rgb(var(--edge) / <alpha-value>)",
        signal: {
          green: "rgb(var(--signal-green) / <alpha-value>)",
          amber: "rgb(var(--signal-amber) / <alpha-value>)",
          red: "rgb(var(--signal-red) / <alpha-value>)",
          blue: "rgb(var(--signal-blue) / <alpha-value>)",
          purple: "rgb(var(--signal-purple) / <alpha-value>)",
          cyan: "rgb(var(--signal-cyan) / <alpha-value>)",
          pink: "rgb(var(--signal-pink) / <alpha-value>)",
        },
        // The text ramp. 50 is always the most prominent text and 950 the
        // faintest, so the scale inverts between themes rather than the
        // call sites having to.
        slate: {
          50: "rgb(var(--slate-50) / <alpha-value>)",
          100: "rgb(var(--slate-100) / <alpha-value>)",
          200: "rgb(var(--slate-200) / <alpha-value>)",
          300: "rgb(var(--slate-300) / <alpha-value>)",
          400: "rgb(var(--slate-400) / <alpha-value>)",
          500: "rgb(var(--slate-500) / <alpha-value>)",
          600: "rgb(var(--slate-600) / <alpha-value>)",
          700: "rgb(var(--slate-700) / <alpha-value>)",
          800: "rgb(var(--slate-800) / <alpha-value>)",
          900: "rgb(var(--slate-900) / <alpha-value>)",
          950: "rgb(var(--slate-950) / <alpha-value>)",
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
