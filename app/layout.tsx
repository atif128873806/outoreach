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
    default: "Outreach Studio — AI outreach that finds, writes, and follows up",
    template: "%s · Outreach Studio",
  },
  description:
    "Find business leads with emails included, let AI write personalized email, Instagram, and LinkedIn outreach, and track opens, clicks, and replies — all in one tool.",
  openGraph: {
    title: "Outreach Studio — AI outreach that finds, writes, and follows up",
    description:
      "Find business leads with emails included, let AI write personalized outreach across email, Instagram, and LinkedIn, and track every open, click, and reply.",
    siteName: "Outreach Studio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Outreach Studio — AI outreach that finds, writes, and follows up",
    description:
      "Lead discovery with emails included, AI-written messages, automatic follow-ups, and reply triage — one pipeline.",
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
