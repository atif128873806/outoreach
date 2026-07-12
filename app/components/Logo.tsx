/**
 * Outreach Studio brand mark — "the O that reaches out".
 *
 * An open ring (the O) with a message-dot escaping through the gap on a 45°
 * trajectory, trail behind it: the name, the action (a message leaving), and
 * the loop (follow-ups & listening) in one geometric mark. Gradient matches
 * the site's blue→violet accent; reads down to 16px.
 *
 * Keep in sync with app/icon.svg (favicon: same mark on a dark tile).
 */
export function LogoMark({
  className = "h-6 w-6",
  title = "Outreach Studio",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id="os-mark-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {/* open ring: 290° arc, gap centered on the 45° exit path */}
      <path
        d="M35.13 16.27 A18 18 0 1 0 49.73 30.87"
        fill="none"
        stroke="url(#os-mark-grad)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* trail — sits in the ring's gap, on the exit line */}
      <circle cx="44.73" cy="21.27" r="2.6" fill="url(#os-mark-grad)" opacity="0.45" />
      {/* the message, leaving */}
      <circle cx="51.8" cy="14.2" r="5.5" fill="url(#os-mark-grad)" />
    </svg>
  );
}

/** The mark on its dark app tile — drop-in replacement for the old "O" square. */
export function LogoTile({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-lg bg-zinc-950 ring-1 ring-zinc-800/60 ${className}`}
    >
      <LogoMark className="h-[72%] w-[72%]" />
    </span>
  );
}
