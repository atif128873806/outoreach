"use client";

import { useState } from "react";
import { LogoMark } from "../components/Logo";
import { SITE } from "@/lib/site";

/**
 * The Mirage embed with a branded loading state (the third-party iframe can
 * take a few seconds) and a container sized to the demo's aspect ratio so
 * there's no dead space below it.
 */
export default function DemoEmbed({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-video max-h-[78vh] w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-black/10 sm:aspect-[2/1]">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas">
          <LogoMark className="h-12 w-12" />
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-field border-t-blue-500" />
            Loading the interactive demo…
          </div>
          <p className="text-xs text-muted">usually just a few seconds</p>
        </div>
      )}
      <iframe
        src={src}
        title={`${SITE.name} interactive demo`}
        className="h-full w-full border-0"
        allow="fullscreen"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
