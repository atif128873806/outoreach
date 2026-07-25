"use client";

import { useRef, useState } from "react";

/**
 * Hero launch film: muted autoplay loop (the only kind browsers allow), with a
 * sound toggle so visitors can turn the music on. The toggle is the only
 * chrome — no control bar, so the film reads as product, not as a video player.
 */
export default function HeroFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound() {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    // Unmuting is a user gesture — safe to (re)start playback if autoplay was blocked.
    if (!next) void v.play().catch(() => {});
  }

  return (
    <div className="group relative">
      <video
        ref={videoRef}
        className="relative block aspect-video w-full rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10"
        poster="/launch-film.jpg"
        preload="metadata"
        autoPlay
        muted
        loop
        playsInline
        aria-label="Outreach Studio in 22 seconds: finding leads with emails, AI writing a personal email, sending at a human pace, and replies arriving sorted"
      >
        <source src="/launch-film.mp4" type="video/mp4" />
      </video>

      <button
        type="button"
        onClick={toggleSound}
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        aria-pressed={!muted}
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/85 px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-lg shadow-zinc-900/10 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl"
      >
        {muted ? (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              <path d="M17 9l4 6M21 9l-4 6" />
            </svg>
            Sound on
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 010 7M18.5 6a8 8 0 010 12" />
            </svg>
            Sound off
          </>
        )}
      </button>
    </div>
  );
}
