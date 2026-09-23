import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Product demo — Outreach Studio",
  description:
    "Watch Outreach Studio find leads with emails included, write a personal cold email, send at a human pace, and sort replies — no signup needed.",
};

export default function DemoPage() {
  return (
    <PublicShell
      title="See it in action"
      subtitle="See the complete outreach pipeline in 22 seconds. No signup required."
      wide
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-lg font-semibold tracking-tight">
          Outreach Studio in 22 seconds
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          From finding the right lead to a sorted reply. Sound on if you like.
        </p>
        <video
          className="mt-5 block aspect-video w-full rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10"
          poster="/launch-film.jpg"
          preload="none"
          controls
          playsInline
          aria-label="Outreach Studio in 22 seconds: finding leads with emails, AI writing a personal email, sending at a human pace, and replies arriving sorted"
        >
          <source src="/launch-film.mp4" type="video/mp4" />
        </video>
        <p className="mt-5 text-center text-sm text-zinc-500">
          Prefer a step-by-step explanation? Explore the{" "}
          <Link
            href="/features"
            className="font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
          >
            guided product tour
          </Link>
          .
        </p>
      </div>

      <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">Liked what you saw?</div>
          <p className="mt-1 text-sm text-zinc-400">
            The real thing is free to start — 50 audited leads a month, no card and nothing to connect.
          </p>
        </div>
        <Link
          href="/signup"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
        >
          Start free
        </Link>
      </div>
    </PublicShell>
  );
}
