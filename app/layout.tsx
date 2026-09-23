import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "./components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Outreach Studio — find businesses that need you, with the proof",
    template: "%s · Outreach Studio",
  },
  description:
    "Search a niche and a city and get real businesses pulled live from the web — each one with its website audited, a score, and the specific problems worth pitching against.",
  openGraph: {
    title: "Outreach Studio — find businesses that need you, with the proof",
    description:
      "Real businesses pulled live from the web, each one audited: what's wrong with its site, what it scores, and the exact reason to reach out.",
    siteName: "Outreach Studio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Outreach Studio — find businesses that need you, with the proof",
    description:
      "Find local businesses with no website, or one that's outdated and broken — with the evidence attached to every lead.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
