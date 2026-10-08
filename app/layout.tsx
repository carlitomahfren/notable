import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { AppSplash } from "@/components/splash/app-splash";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme/theme-bootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Notable",
  description: "A personal notebook and workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The bootstrap script mutates these attributes before React hydrates, so
    // the mismatch is intentional and must not be reported.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Applies the stored theme before first paint. It must stay inline and
          synchronous: deferring it would reintroduce the flash of default
          colors that Phase 7 removes.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* The entrance overlay mounts once per full document load; soft
            navigation keeps the layout mounted and spares a second run. */}
        <AppSplash />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
