import type { Metadata } from "next";

import { fontVariables } from "@/lib/fonts";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { BackgroundEngine } from "@/components/background/background-engine";
import { CursorLight } from "@/components/ui/cursor-light";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elevatex AI — AI-Powered Marketing Videos for Indian Businesses",
  description:
    "Create professional, vernacular marketing videos in under 5 minutes. Built for Indian restaurants, salons, clinics, and local businesses — no design skill required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} antialiased`}>
        <SessionProvider>
          <ThemeProvider>
            <TooltipProvider>
              {/* Premium 3D ambient background — fixed, behind all content, pointer-events:none */}
              <BackgroundEngine />
              {/* Cursor light — soft radial follow, <5% opacity, no lag */}
              <CursorLight />
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
