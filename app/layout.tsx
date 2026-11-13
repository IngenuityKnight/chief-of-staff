import "./globals.css";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Spline_Sans_Mono } from "next/font/google";

// Self-hosted via next/font. Variable names match tailwind.config.js.
const displayFont = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-space" });
const bodyFont = Instrument_Sans({ subsets: ["latin"], variable: "--font-inter-tight" });
const monoFont = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Burden House",
  description: "The household wall: schedule, meals, routine and what needs doing.",
  manifest: "/manifest.json",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Burden House" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
