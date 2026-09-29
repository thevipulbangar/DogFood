import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Fonts ship with the app (geist package) — no runtime font CDN, works offline.

export const metadata: Metadata = {
  title: { default: "Dogfood 2026 — Build the platform that will judge you", template: "%s · Dogfood 2026" },
  description: "Open-source, self-hostable hackathon submission and judging platform.",
};

export const viewport: Viewport = { themeColor: "#0a0a0b", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only z-[100] rounded-sm bg-accent px-3 py-2 font-mono text-xs text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
