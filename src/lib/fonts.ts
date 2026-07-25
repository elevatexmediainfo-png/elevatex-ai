import { Inter, JetBrains_Mono, Noto_Sans_Devanagari } from "next/font/google";

// Section 12.1 — dual-font strategy: Inter (Latin) + Noto Sans Devanagari (Hindi).
// JetBrains Mono covers referral codes, hex values, GST numbers, code snippets.

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = `${inter.variable} ${notoSansDevanagari.variable} ${jetbrainsMono.variable}`;
