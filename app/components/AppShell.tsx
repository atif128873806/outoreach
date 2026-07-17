"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import VerifyEmailBanner from "./VerifyEmailBanner";

/** Marketing, legal, and auth screens render full-bleed; everything else gets the app chrome. */
const BARE_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/features",
  "/docs",
  "/tools/spam-checker",
  "/tools/dns-checker",
  "/pricing",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/contact",
]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_PATHS.has(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">
          <VerifyEmailBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
