import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

// All fonts: SIL Open Font License 1.1 (commercial use OK).
const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
const body = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Echoes — a connected timeline of world history", template: "%s · Echoes" },
  description: "Explore 5,000 years of world events on one zoomable timeline and map: see what happened at the same time, how events are connected, and which patterns repeat. Built from open data (Wikidata, Wikipedia).",
};
export const viewport: Viewport = { themeColor: "#07080c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
