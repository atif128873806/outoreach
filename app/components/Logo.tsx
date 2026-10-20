"use client";
import { useId } from "react";
import { SITE } from "@/lib/site";

/**
 * LeadBoffin discovery mark, retained from the approved dark identity.
 *
 * An open ring with a point extending beyond it on a 45° trajectory.
 * Gradient matches
 * the site's blue→violet accent; reads down to 16px.
 *
 * Keep in sync with app/icon.svg (favicon: same mark on a dark tile).
 */
export function LogoMark({
  className = "h-6 w-6",
  title = SITE.name,
}: {
  className?: string;
  title?: string;
}) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {/* open ring: 290° arc, gap centered on the 45° exit path */}
      <path
        d="M35.13 16.27 A18 18 0 1 0 49.73 30.87"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* trail — sits in the ring's gap, on the exit line */}
      <circle cx="44.73" cy="21.27" r="2.6" fill={`url(#${gradientId})`} opacity="0.45" />
      {/* discovery point */}
      <circle cx="51.8" cy="14.2" r="5.5" fill={`url(#${gradientId})`} />
    </svg>
  );
}

/** The mark on its dark app tile — drop-in replacement for the old "O" square. */
export function LogoTile({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-lg bg-canvas ring-1 ring-line/60 ${className}`}
    >
      <LogoMark className="h-[72%] w-[72%]" />
    </span>
  );
}
