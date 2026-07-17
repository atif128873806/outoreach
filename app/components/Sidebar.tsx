"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/leads", label: "Lead Finder", icon: "⌕" },
  { href: "/contacts", label: "Contacts", icon: "☰" },
  { href: "/campaigns", label: "Campaigns", icon: "✉" },
  { href: "/messages", label: "Message Center", icon: "◎" },
  { href: "/billing", label: "Plan & Usage", icon: "◇" },
  { href: "/settings", label: "Settings", icon: "⚙" },
  { href: "/docs", label: "Help & Docs", icon: "?" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const onAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (onAuthPage) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setEmail(d?.user?.email ?? null);
        setIsAdmin(Boolean(d?.user?.isAdmin));
      })
      .catch(() => {});
  }, [onAuthPage, pathname]);

  if (onAuthPage) return null; // auth screens are full-width

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="w-60 shrink-0 bg-zinc-950 text-zinc-300 flex flex-col">
      <div className="px-6 py-6 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7 shrink-0" />
          <div>
            <div className="text-white font-semibold text-lg tracking-tight leading-tight">
              Outreach Studio
            </div>
            <div className="text-xs text-zinc-500">AI outreach automation</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-zinc-800 text-white font-medium"
                  : "hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/admin")
                ? "bg-zinc-800 text-white font-medium"
                : "hover:bg-zinc-900 hover:text-white"
            }`}
          >
            <span className="w-5 text-center">★</span>
            Admin
          </Link>
        )}
      </nav>
      <div className="px-6 py-4 border-t border-zinc-800">
        {email && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="truncate text-xs text-zinc-400" title={email}>
              {email}
            </span>
            {isAdmin && (
              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                owner
              </span>
            )}
          </div>
        )}
        <button
          onClick={signOut}
          className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
