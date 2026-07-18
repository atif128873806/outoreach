import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "../components/PublicShell";

export const metadata: Metadata = {
  title: "Interactive demo — Outreach Studio",
  description:
    "Click through Outreach Studio yourself: find leads with emails included, watch the AI write a personal cold email, and see replies triaged — no signup needed.",
};

const DEMO_SRC = "https://usemirage.io/demo/q4u68ibw5yck0000?embed=1&accent=%232563eb";

export default function DemoPage() {
  return (
    <PublicShell
      title="See it in action"
      subtitle="A real click-through of the product — you drive. No signup, takes about two minutes."
      wide
    >
      <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-900/10">
        <iframe
          src={DEMO_SRC}
          title="Outreach Studio interactive demo"
          className="block h-[70vh] min-h-[520px] w-full border-0"
          allow="fullscreen"
          loading="lazy"
        />
      </div>
      <p className="mt-3 text-center text-xs text-zinc-400">
        Demo not loading?{" "}
        <a
          href={DEMO_SRC}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-600"
        >
          Open it in a new tab
        </a>{" "}
        — or read the{" "}
        <Link href="/features" className="underline hover:text-zinc-600">
          guided tour
        </Link>
        .
      </p>

      <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-6 py-5">
        <div>
          <div className="font-semibold text-white">Liked what you clicked?</div>
          <p className="mt-1 text-sm text-zinc-400">
            The real thing is free to start — simulation mode until you connect a mailbox.
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
