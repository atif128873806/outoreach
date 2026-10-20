import type { Metadata } from "next";
import { IBM_Plex_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "./components/AppShell";
import PilotAnalytics from "./components/PilotAnalytics";
import { SITE } from "@/lib/site";

const plexSans = IBM_Plex_Sans({
  variable: "--font-product-sans",
  weight: ["400", "500", "600"],
  display: "swap",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — London business shortlists with evidence`,
    template: `%s · ${SITE.name}`,
  },
  description:
    "Find London businesses using public sources and fresh cached data. Review available website evidence, then save or export your shortlist.",
  openGraph: {
    title: `${SITE.name} — London business shortlists with evidence`,
    description:
      "London business discovery for agencies, accountants and local sales teams, with public details and available website findings.",
    siteName: SITE.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — London business shortlists with evidence`,
    description:
      "Build a London business shortlist with public-source details, available website findings and clear freshness.",
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
      data-scroll-behavior="smooth"
      className={`${plexSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <PilotAnalytics />
      </body>
    </html>
  );
}
