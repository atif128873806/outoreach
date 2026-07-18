"use client";

import { useState } from "react";
import { LogoMark } from "../components/Logo";

/**
 * The Mirage embed with a branded loading state (the third-party iframe can
 * take a few seconds) and a container sized to the demo's aspect ratio so
 * there's no dead space below it.
 */
export default function DemoEmbed({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-video max-h-[78vh] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-zinc-950">
          <LogoMark className="h-12 w-12" />
          <div className="flex items-center gap-2.5 text-sm text-zinc-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
            Loading the interactive demo…
          </div>
          <p className="text-xs text-zinc-600">usually just a few seconds</p>
        </div>
      )}
      <iframe
        src={src}
        title="Outreach Studio interactive demo"
        className="h-full w-full border-0"
        allow="fullscreen"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
