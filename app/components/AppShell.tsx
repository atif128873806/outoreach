"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

/** Marketing landing and auth screens render full-bleed; everything else gets the app chrome. */
const BARE_PATHS = new Set(["/", "/login", "/signup"]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_PATHS.has(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
