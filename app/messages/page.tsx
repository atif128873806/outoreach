"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  btnPrimary,
  btnSecondary,
  fmtDate,
} from "../components/ui";

interface Draft {
  id: number;
  body: string;
  via: string;
  created_at: string;
  campaign_id: number;
  step: number;
  contact_id: number;
  channel: string;
  business_name: string;
  instagram: string;
  linkedin: string;
  contact_email: string;
  category: string;
  campaign_name: string;
  followup_count: number;
}

interface Reply {
  id: number;
  from_email: string;
  subject: string;
  snippet: string;
  classification: string;
  suggested_reply: string;
  handled: number;
  created_at: string;
  business_name: string;
  category: string;
}

const CLASS_STYLES: Record<string, { cls: string; label: string }> = {
  interested: { cls: "bg-emerald-100 text-emerald-700", label: "interested" },
  question: { cls: "bg-sky-100 text-sky-700", label: "question" },
  not_interested: { cls: "bg-zinc-200 text-zinc-600", label: "not interested" },
  out_of_office: { cls: "bg-amber-100 text-amber-700", label: "out of office" },
  other: { cls: "bg-zinc-100 text-zinc-500", label: "other" },
};

function profileUrl(d: Draft): string | null {
  if (d.channel === "instagram" && d.instagram) return `https://instagram.com/${d.instagram}`;
  if (d.channel === "linkedin" && d.linkedin) return `https://www.linkedin.com/${d.linkedin}`;
  return null;
}

export default function MessagesPage() {
  const [tab, setTab] = useState<"drafts" | "replies">("drafts");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dRes, rRes] = await Promise.all([
      fetch("/api/messages"),
      fetch("/api/replies"),
    ]);
    const dData = await dRes.json();
    const rData = await rRes.json();
    setDrafts(dData.drafts);
    setReplies(rData.replies);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const t = setInterval(load, 10_000);
    return () => {
      clearTimeout(initial);
      clearInterval(t);
    };
  }, [load]);

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId((v) => (v === key ? null : v)), 2000);
  }

  async function act(id: number, action: "mark_sent" | "skip" | "got_reply") {
    await fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await load();
  }

  async function markHandled(id: number) {
    await fetch("/api/replies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mark_handled" }),
    });
    await load();
  }

  const unhandled = replies.filter((r) => !r.handled).length;

  return (
    <div>
      <PageHeader
        title="Message Center"
        subtitle="DM drafts ready to send, and inbound replies triaged by AI"
      />

      <div className="flex gap-2 mb-6">
        <TabButton active={tab === "drafts"} onClick={() => setTab("drafts")}>
          Drafts {drafts.length > 0 && <Count n={drafts.length} />}
        </TabButton>
        <TabButton active={tab === "replies"} onClick={() => setTab("replies")}>
          Replies {unhandled > 0 && <Count n={unhandled} accent />}
        </TabButton>
      </div>

      {tab === "drafts" && (
        <>
          <Card className="mb-6 p-4 text-sm text-zinc-600 bg-blue-50 border-blue-200">
            <span className="font-medium text-blue-900">How this works:</span>{" "}
            Instagram and LinkedIn ban automated cold DMs, so drafts are prepared
            here for one-click manual sending — <em>copy</em> the message,{" "}
            <em>open</em> the profile, paste it, then <em>mark sent</em>. Marking
            sent queues the next follow-up automatically; when someone answers,
            hit <em>got a reply</em> and their sequence stops.
          </Card>

          {!loaded ? (
            <div className="text-zinc-400 text-sm py-20 text-center">Loading…</div>
          ) : drafts.length === 0 ? (
            <Card className="p-12 text-center text-sm text-zinc-400">
              No drafts waiting. Create an{" "}
              <Link href="/campaigns" className="underline">
                Instagram or LinkedIn campaign
              </Link>{" "}
              and drafts will appear here as they&apos;re generated.
            </Card>
          ) : (
            <div className="space-y-4">
              {drafts.map((d) => {
                const url = profileUrl(d);
                const isConnectionNote = d.channel === "linkedin" && d.step === 1;
                const chars = d.body.length;
                return (
                  <Card key={d.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          {d.business_name || d.contact_email}{" "}
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${
                                d.channel === "linkedin" ? "text-sky-700" : "text-pink-600"
                              } hover:underline font-normal`}
                            >
                              {d.channel === "linkedin"
                                ? `in/${d.linkedin.split("/")[1] ?? d.linkedin}`
                                : `@${d.instagram}`}
                            </a>
                          )}
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            {isConnectionNote
                              ? "connection note"
                              : d.step === 1
                                ? "first message"
                                : `follow-up ${d.step - 1}`}
                          </span>
                          {isConnectionNote && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                chars <= 200
                                  ? "bg-emerald-100 text-emerald-700"
                                  : chars <= 300
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                              title="LinkedIn caps connection notes at 200–300 characters depending on account type"
                            >
                              {chars} chars
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {d.category && `${d.category} · `}
                          <Link href={`/campaigns/${d.campaign_id}`} className="hover:underline">
                            {d.campaign_name}
                          </Link>{" "}
                          · drafted {fmtDate(d.created_at)}
                          {d.via.includes("template") && " · template"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-4 text-sm whitespace-pre-wrap mb-4">
                      {d.body}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button className={btnSecondary} onClick={() => copyText(`d${d.id}`, d.body)}>
                        {copiedId === `d${d.id}` ? "✓ Copied!" : "Copy message"}
                      </button>
                      {url && (
                        <a className={btnSecondary} href={url} target="_blank" rel="noopener noreferrer">
                          Open {d.channel === "linkedin" ? "LinkedIn" : "Instagram"} ↗
                        </a>
                      )}
                      <button className={btnPrimary} onClick={() => act(d.id, "mark_sent")}>
                        ✓ Mark sent
                      </button>
                      {d.step > 1 && (
                        <button
                          className={`${btnSecondary} text-emerald-700`}
                          onClick={() => act(d.id, "got_reply")}
                          title="They answered — stop this contact's sequence"
                        >
                          💬 Got a reply
                        </button>
                      )}
                      <button
                        className={`${btnSecondary} text-zinc-400`}
                        onClick={() => act(d.id, "skip")}
                      >
                        Skip
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "replies" && (
        <>
          {!loaded ? (
            <div className="text-zinc-400 text-sm py-20 text-center">Loading…</div>
          ) : replies.length === 0 ? (
            <Card className="p-12 text-center text-sm text-zinc-400">
              No replies captured yet. When someone answers one of your campaign
              emails, it appears here — classified by AI, with a suggested response.
              (Requires IMAP to be configured in Settings.)
            </Card>
          ) : (
            <div className="space-y-4">
              {replies.map((r) => {
                const style = CLASS_STYLES[r.classification] ?? CLASS_STYLES.other;
                return (
                  <Card key={r.id} className={`p-5 ${r.handled ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {r.business_name || r.from_email}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.cls}`}>
                            {style.label}
                          </span>
                          {Boolean(r.handled) && (
                            <span className="text-xs text-zinc-400">handled</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {r.from_email} · {r.subject || "(no subject)"} · {fmtDate(r.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-4 text-sm whitespace-pre-wrap mb-3">
                      {r.snippet}
                    </div>

                    {r.suggested_reply && (
                      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 mb-4">
                        <div className="text-xs font-medium text-violet-700 mb-1.5">
                          ✨ AI-suggested response
                        </div>
                        <div className="text-sm whitespace-pre-wrap text-zinc-700">
                          {r.suggested_reply}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {r.suggested_reply && (
                        <>
                          <button
                            className={btnSecondary}
                            onClick={() => copyText(`r${r.id}`, r.suggested_reply)}
                          >
                            {copiedId === `r${r.id}` ? "✓ Copied!" : "Copy response"}
                          </button>
                          <a
                            className={btnPrimary}
                            href={`mailto:${r.from_email}?subject=${encodeURIComponent(
                              r.subject.startsWith("Re:") ? r.subject : `Re: ${r.subject}`
                            )}&body=${encodeURIComponent(r.suggested_reply)}`}
                          >
                            Reply in mail app ↗
                          </a>
                        </>
                      )}
                      {!r.handled && (
                        <button
                          className={`${btnSecondary} text-zinc-400`}
                          onClick={() => markHandled(r.id)}
                        >
                          Mark handled
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white"
          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n, accent = false }: { n: number; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
        accent ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-700"
      }`}
    >
      {n}
    </span>
  );
}
