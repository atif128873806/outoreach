"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/leads", label: "Lead Finder", icon: "⌕" },
  { href: "/contacts", label: "Contacts", icon: "☰" },
  { href: "/campaigns", label: "Campaigns", icon: "✉" },
  { href: "/messages", label: "Message Center", icon: "◎" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();

  if (pathname === "/login") return null; // login screen is full-width

  return (
    <aside className="w-60 shrink-0 bg-zinc-950 text-zinc-300 flex flex-col">
      <div className="px-6 py-6 border-b border-zinc-800">
        <div className="text-white font-semibold text-lg tracking-tight">
          Outreach Studio
        </div>
        <div className="text-xs text-zinc-500 mt-1">AI outreach automation</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
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
      </nav>
      <div className="px-6 py-4 border-t border-zinc-800 text-xs text-zinc-600">
        Scheduler runs every minute
      </div>
    </aside>
  );
}
