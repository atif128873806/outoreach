"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  ChannelBadge,
  PageHeader,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
  fmtDate,
} from "../components/ui";

interface CampaignRow {
  id: number;
  name: string;
  channel: string;
  category_filter: string;
  scheduled_at: string | null;
  throttle_per_hour: number;
  followup_count: number;
  status: string;
  total: number;
  sent: number;
  ready: number;
  failed: number;
  skipped: number;
  pending: number;
  opened: number;
  clicked: number;
  replied: number;
}

const TONES = ["professional", "friendly", "casual", "enthusiastic", "formal"];

const PRESETS: { label: string; text: string }[] = [
  {
    label: "Book a call",
    text: "We help businesses like theirs with [your service]. Typical result: [benefit with a number]. Goal: book a free 15-minute intro call this week.",
  },
  {
    label: "Promote an offer",
    text: "We're running a limited offer: [describe the offer and discount]. It's a great fit for their kind of business because [reason]. Goal: get them to reply for the details.",
  },
  {
    label: "Partnership",
    text: "We'd like to explore a partnership: [what you'd do together and why it benefits both sides]. Goal: a short exploratory conversation.",
  },
  {
    label: "Event invite",
    text: "We're hosting [event name] on [date] about [topic] — relevant to their business because [reason]. Goal: get them to register (free).",
  },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const [cRes, ctRes] = await Promise.all([
      fetch("/api/campaigns"),
      fetch("/api/contacts"),
    ]);
    const cData = await cRes.json();
    const ctData = await ctRes.json();
    setCampaigns(cData.campaigns);
    setCategories(ctData.categories);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Schedule AI-written outreach across email, Instagram, and LinkedIn"
        action={
          <button className={btnPrimary} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "+ New campaign"}
          </button>
        }
      />

      {showForm && (
        <NewCampaignForm
          categories={categories}
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {campaigns.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-400">
          No campaigns yet. Create one to start reaching out.
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const done = c.sent + c.ready + c.failed + c.skipped;
            const pct = c.total ? Math.round((done / c.total) * 100) : 0;
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="block">
                <Card className="p-5 hover:border-zinc-300 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium truncate">{c.name}</span>
                        <ChannelBadge channel={c.channel} />
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        {c.category_filter ? `Audience: ${c.category_filter}` : "All contacts"} ·{" "}
                        {fmtDate(c.scheduled_at)} · {c.throttle_per_hour}/hr
                        {c.followup_count > 0 && ` · ${c.followup_count} follow-up${c.followup_count > 1 ? "s" : ""}`}
                      </div>
                      {c.channel === "email" && c.sent > 0 && (
                        <div className="text-xs text-zinc-500 mt-1.5">
                          {Math.round((c.opened / c.sent) * 100)}% opened · {Math.round((c.clicked / c.sent) * 100)}% clicked ·{" "}
                          <span className="text-emerald-600 font-medium">{c.replied} replied</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm tabular-nums">
                        <span className="text-emerald-600 font-medium">{c.sent}</span>
                        <span className="text-zinc-400"> / {c.total} sent</span>
                        {c.ready > 0 && (
                          <span className="text-purple-600"> · {c.ready} drafts</span>
                        )}
                        {c.failed > 0 && (
                          <span className="text-red-500"> · {c.failed} failed</span>
                        )}
                      </div>
                      <div className="w-40 h-1.5 bg-zinc-100 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-zinc-900 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCampaignForm({
  categories,
  onCreated,
}: {
  categories: string[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("professional");
  const [channel, setChannel] = useState<"email" | "instagram" | "linkedin">("email");
  const [category, setCategory] = useState("");
  const [when, setWhen] = useState<"now" | "later">("later");
  const [scheduledAt, setScheduledAt] = useState("");
  const [throttle, setThrottle] = useState(60);
  const [followups, setFollowups] = useState(0);
  const [followupDays, setFollowupDays] = useState(3);
  const [abTest, setAbTest] = useState(false);
  const [testBatch, setTestBatch] = useState(0);
  const [windowEnabled, setWindowEnabled] = useState(false);
  const [windowStart, setWindowStart] = useState(9);
  const [windowEnd, setWindowEnd] = useState(17);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [preview, setPreview] = useState<{
    subject: string;
    body: string;
    contact: { email: string; business_name: string; category: string; instagram: string };
    note?: string;
    spamWarnings?: string[];
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [improving, setImproving] = useState(false);
  const [sendingPreview, setSendingPreview] = useState(false);
  const [previewSentMsg, setPreviewSentMsg] = useState<string | null>(null);

  const channelNoun =
    channel === "instagram" ? "DM" : channel === "linkedin" ? "LinkedIn message" : "email";

  async function improve() {
    setImproving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI assistant failed");
      setDescription(data.description);
      if (data.name && !name.trim()) setName(data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI assistant failed");
    } finally {
      setImproving(false);
    }
  }

  async function emailMePreview() {
    if (!preview) return;
    setSendingPreview(true);
    setPreviewSentMsg(null);
    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: preview.subject, body: preview.body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setPreviewSentMsg(`Sent to ${data.to} — check your inbox.`);
    } catch (err) {
      setPreviewSentMsg(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingPreview(false);
    }
  }

  async function doPreview() {
    setPreviewing(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, tone, channel, category_filter: category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          tone,
          channel,
          category_filter: category,
          send_now: when === "now",
          scheduled_at:
            when === "later" && scheduledAt
              ? new Date(scheduledAt).toISOString()
              : undefined,
          throttle_per_hour: throttle,
          followup_count: channel === "email" ? followups : 0,
          followup_interval_days: followupDays,
          ab_test: channel === "email" && abTest,
          test_batch: testBatch,
          send_window_start: windowEnabled ? windowStart : null,
          send_window_end: windowEnabled ? windowEnd : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create campaign");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign");
    } finally {
      setBusy(false);
    }
  }

  const hourOptions = Array.from({ length: 24 }, (_, h) => (
    <option key={h} value={h}>
      {h.toString().padStart(2, "0")}:00
    </option>
  ));

  return (
    <Card className="p-6 mb-6">
      <h2 className="font-medium mb-4">New campaign</h2>

      <div className="mb-4">
        <div className="text-sm font-medium text-zinc-600 mb-1.5">Channel</div>
        <div className="flex gap-2">
          <ChannelOption
            active={channel === "email"}
            onClick={() => setChannel("email")}
            title="✉ Email"
            desc="Sent automatically on schedule via SMTP"
          />
          <ChannelOption
            active={channel === "instagram"}
            onClick={() => setChannel("instagram")}
            title="◎ Instagram DM"
            desc="AI drafts DMs; you send them from the Message Center"
          />
          <ChannelOption
            active={channel === "linkedin"}
            onClick={() => setChannel("linkedin")}
            title="in LinkedIn"
            desc="AI drafts messages; send them from the Message Center"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="Campaign name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring promo — restaurants"
            />
          </Field>

          <Field
            label="What are you offering?"
            hint="Every message is written from this. Be specific: what you sell, the benefit, and what you want them to do."
          >
            <div className="flex gap-1.5 flex-wrap mb-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDescription(p.text)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-400"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              className={`${inputCls} min-h-28`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. We build fast, affordable websites for local restaurants. Sites launch in 2 weeks and typically increase online orders by 30%. Goal: book a free 15-minute consultation."
            />
            <button
              type="button"
              onClick={improve}
              disabled={improving || !description.trim()}
              className="mt-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:border-violet-400 disabled:opacity-50"
            >
              {improving ? "Improving…" : "✨ Improve with AI"}
            </button>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tone">
              <select className={inputCls} value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Audience">
              <select
                className={inputCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All contacts</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="When to start">
              <select
                className={inputCls}
                value={when}
                onChange={(e) => setWhen(e.target.value as "now" | "later")}
              >
                <option value="later">Schedule for later</option>
                <option value="now">Start now</option>
              </select>
            </Field>
            {when === "later" && (
              <Field label="Start at">
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </Field>
            )}
          </div>

          {channel === "email" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Follow-ups" hint="Sent automatically to contacts who don't reply. Mark contacts as replied to stop their sequence.">
                <select
                  className={inputCls}
                  value={followups}
                  onChange={(e) => setFollowups(Number(e.target.value))}
                >
                  <option value={0}>None</option>
                  <option value={1}>1 follow-up</option>
                  <option value={2}>2 follow-ups</option>
                  <option value={3}>3 follow-ups</option>
                </select>
              </Field>
              {followups > 0 && (
                <Field label="Days between emails">
                  <select
                    className={inputCls}
                    value={followupDays}
                    onChange={(e) => setFollowupDays(Number(e.target.value))}
                  >
                    {[2, 3, 4, 5, 7, 10, 14].map((d) => (
                      <option key={d} value={d}>{d} days</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}

          <Field
            label={`${channel !== "email" ? "Drafting" : "Sending"} speed: ${throttle}/hour`}
            hint={channel === "email" ? "Slower sending looks more human and protects your sender reputation." : undefined}
          >
            <input
              type="range"
              min={6}
              max={300}
              step={6}
              value={throttle}
              onChange={(e) => setThrottle(Number(e.target.value))}
              className="w-full"
            />
          </Field>

          {channel === "email" && (
            <div>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={abTest}
                  onChange={(e) => setAbTest(e.target.checked)}
                />
                A/B test subject lines
              </label>
              <div className="text-xs text-zinc-400 mt-1 ml-6">
                Half the contacts get a benefit-statement subject (A), half a curiosity-question subject (B) — open rates per arm show on the campaign page.
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={testBatch > 0}
                onChange={(e) => setTestBatch(e.target.checked ? 5 : 0)}
              />
              Start with a test batch
            </label>
            <div className="text-xs text-zinc-400 mt-1 ml-6">
              {channel === "email"
                ? "Sends only the first few emails, then pauses automatically so you can check the results before the rest goes out."
                : "Drafts only the first few messages, then pauses so you can review the AI's writing before the rest are generated."}
            </div>
            {testBatch > 0 && (
              <div className="mt-2 ml-6 flex items-center gap-2 text-sm text-zinc-600">
                Batch size:
                {[5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTestBatch(n)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      testBatch === n
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={windowEnabled}
                onChange={(e) => setWindowEnabled(e.target.checked)}
              />
              Only send during business hours
            </label>
            {windowEnabled && (
              <div className="flex items-center gap-2 mt-2">
                <select
                  className={inputCls}
                  value={windowStart}
                  onChange={(e) => setWindowStart(Number(e.target.value))}
                >
                  {hourOptions}
                </select>
                <span className="text-sm text-zinc-400">to</span>
                <select
                  className={inputCls}
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(Number(e.target.value))}
                >
                  {hourOptions}
                </select>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-zinc-600 mb-2">
            Sample {channelNoun}
          </div>
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 min-h-64">
            {preview ? (
              <div>
                <div className="text-xs text-zinc-400 mb-2">
                  Preview for {preview.contact.business_name || preview.contact.email}
                  {preview.contact.instagram && ` (@${preview.contact.instagram})`}
                  {!preview.contact.instagram && preview.contact.category && ` (${preview.contact.category})`}
                </div>
                {preview.note && (
                  <div className="text-xs text-amber-600 mb-2">{preview.note}</div>
                )}
                {preview.subject && (
                  <div className="text-sm font-medium mb-2">{preview.subject}</div>
                )}
                <div className="text-sm whitespace-pre-wrap text-zinc-700">{preview.body}</div>
                {preview.spamWarnings && preview.spamWarnings.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-medium text-amber-800 mb-1">
                      Deliverability check — {preview.spamWarnings.length} warning{preview.spamWarnings.length > 1 ? "s" : ""}
                    </div>
                    <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                      {preview.spamWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  channel === "email" && (
                    <div className="mt-3 text-xs text-emerald-600">
                      ✓ Deliverability check passed — no spam-filter red flags
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center pt-20">
                {previewing
                  ? "Writing a sample…"
                  : "Fill in the description, then generate a sample to see what will be written."}
              </p>
            )}
          </div>
          <button
            className={`${btnSecondary} mt-3 w-full justify-center`}
            onClick={doPreview}
            disabled={previewing || !description.trim()}
          >
            {previewing ? "Generating…" : `Generate sample ${channelNoun}`}
          </button>
          {preview && channel === "email" && (
            <button
              className={`${btnSecondary} mt-2 w-full justify-center`}
              onClick={emailMePreview}
              disabled={sendingPreview}
            >
              {sendingPreview ? "Sending…" : "📥 Email me this preview"}
            </button>
          )}
          {previewSentMsg && (
            <div className="text-xs text-zinc-500 mt-2 text-center">{previewSentMsg}</div>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-500 mt-4">{error}</div>}

      <div className="mt-5 flex justify-end">
        <button className={btnPrimary} onClick={submit} disabled={busy}>
          {busy
            ? "Creating…"
            : when === "now"
              ? "Create & start"
              : "Create & schedule"}
        </button>
      </div>
    </Card>
  );
}

function ChannelOption({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
          : "border-zinc-200 hover:border-zinc-400"
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{desc}</div>
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-zinc-600 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-xs text-zinc-400 mt-1">{hint}</div>}
    </label>
  );
}
