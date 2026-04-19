import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandDock } from "@/components/command-dock";

export const metadata: Metadata = {
  title: "Chief of Staff — Home Command",
  description: "A general-purpose Chief of Staff platform for the home. Coordinates meals, maintenance, money, and schedule.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chief of Staff",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <Topbar />
            <main className="flex-1 px-6 py-6 md:px-10 md:py-8">
              {children}
            </main>
          </div>
        </div>
        <CommandDock />
      </body>
    </html>
  );
}
