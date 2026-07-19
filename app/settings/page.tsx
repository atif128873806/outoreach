"use client";

import { useEffect, useState } from "react";
import {
  Card,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "../components/ui";
import {
  PROVIDER_PRESETS,
  resolvePreset,
  type ProviderPreset,
} from "@/lib/email-providers";

type SettingsMap = Record<string, string>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [imapMsg, setImapMsg] = useState<string | null>(null);
  const [imapTesting, setImapTesting] = useState(false);
  const [wizEmail, setWizEmail] = useState("");
  const [wizBusy, setWizBusy] = useState(false);
  const [wizProvider, setWizProvider] = useState<ProviderPreset | null>(null);
  const [wizMsg, setWizMsg] = useState<string | null>(null);
  const [dnsResult, setDnsResult] = useState<{
    domain: string;
    summary: string;
    checks: { name: string; pass: boolean; detail: string; advice?: string }[];
  } | null>(null);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [dnsChecking, setDnsChecking] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setSmtpConfigured(d.smtpConfigured);
        setAiConfigured(d.aiConfigured);
        setAiProvider(d.aiProvider);
      });
  }, []);

  const set =
    (key: string) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) =>
      setSettings((s) => ({ ...s, [key]: e.target.value }));

  const setToggle = (key: string, value: boolean) =>
    setSettings((s) => ({ ...s, [key]: value ? "true" : "false" }));

  /** Fills every SMTP/IMAP field from a provider preset — user only adds the password. */
  function applyPreset(preset: ProviderPreset, email: string) {
    setWizProvider(preset);
    setWizMsg(null);
    setSettings((s) => ({
      ...s,
      smtp_host: preset.smtp.host,
      smtp_port: preset.smtp.port,
      smtp_secure: preset.smtp.secure,
      smtp_user: email || s.smtp_user || "",
      from_email: email || s.from_email || "",
      imap_host: preset.imap.host,
      imap_port: preset.imap.port,
      imap_user: email || s.imap_user || "",
    }));
  }

  async function detectProvider() {
    setWizBusy(true);
    setWizMsg(null);
    setWizProvider(null);
    try {
      const res = await fetch("/api/settings/detect-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: wizEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detection failed");
      applyPreset(data.provider as ProviderPreset, data.email as string);
    } catch (err) {
      setWizMsg(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setWizBusy(false);
    }
  }

  function pickProvider(id: string) {
    if (!id) return;
    const email = wizEmail.trim().toLowerCase() || settings.from_email || "";
    applyPreset(resolvePreset(PROVIDER_PRESETS[id], email), email);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      // Stamp the warm-up start date the first time it's switched on.
      const payload: Record<string, string> = { ...settings };
      if (payload.warmup_enabled === "true" && !payload.warmup_started_at) {
        payload.warmup_started_at = new Date().toISOString();
      }
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Save failed — try again.");
        return;
      }
      setSettings(data.settings);
      setSmtpConfigured(data.smtpConfigured);
      setAiConfigured(data.aiConfigured);
      setAiProvider(data.aiProvider);
      setMessage("Settings saved.");
    } catch {
      setMessage("Save failed — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      setTestMsg(res.ok ? "Test email sent — check the inbox." : data.error);
    } catch {
      setTestMsg("Test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function testImap() {
    setImapTesting(true);
    setImapMsg(null);
    try {
      const res = await fetch("/api/test-imap", { method: "POST" });
      const data = await res.json();
      setImapMsg(
        res.ok
          ? `Connected ✓ — checked ${data.checked} new message(s): ${data.replies} reply/replies, ${data.bounces} bounce(s) found.`
          : data.error
      );
    } catch {
      setImapMsg("IMAP test failed.");
    } finally {
      setImapTesting(false);
    }
  }

  async function updatePassword() {
    setPwBusy(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: pwCurrent, next: pwNext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setPwCurrent("");
      setPwNext("");
      setPwMsg("Password updated.");
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPwBusy(false);
    }
  }

  async function runDnsCheck() {
    setDnsChecking(true);
    setDnsResult(null);
    setDnsError(null);
    try {
      const res = await fetch("/api/dns-check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setDnsError(data.error || "DNS check failed");
      else setDnsResult(data);
    } catch {
      setDnsError("DNS check failed.");
    } finally {
      setDnsChecking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Sender identity, AI, delivery, and deliverability"
        action={
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save all settings"}
          </button>
        }
      />

      {message && (
        <Card className="mb-4 p-3 text-sm text-zinc-700 bg-zinc-50">{message}</Card>
      )}

      <div className="space-y-6">
        <Card className="p-6">
          <SectionTitle
            title="Sender identity"
            subtitle="The AI uses this to write emails in your voice — who you are and what your company does."
          />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Field label="Your name">
              <input className={inputCls} value={settings.sender_name ?? ""} onChange={set("sender_name")} placeholder="Jane Smith" />
            </Field>
            <Field label="Your role">
              <input className={inputCls} value={settings.sender_role ?? ""} onChange={set("sender_role")} placeholder="Founder" />
            </Field>
            <Field label="Company name">
              <input className={inputCls} value={settings.company_name ?? ""} onChange={set("company_name")} placeholder="Acme Web Studio" />
            </Field>
            <Field label="Signature (sign-off)">
              <input className={inputCls} value={settings.signature ?? ""} onChange={set("signature")} placeholder="Jane Smith · Acme Web Studio · acme.com" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="What does your company do?" hint="One or two sentences. This becomes context for every AI-written email.">
              <textarea className={`${inputCls} min-h-20`} value={settings.company_description ?? ""} onChange={set("company_description")} placeholder="We design and build fast, affordable websites for local businesses…" />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="AI message writer"
            subtitle="AI writing is included free on every account — nothing to set up. Prefer Anthropic's Claude? Add your own key below to switch; otherwise the free AI is used automatically."
            badge={aiConfigured ? (aiProvider === "groq" ? "free AI active" : "Claude active") : "template mode"}
            badgeOk={aiConfigured}
          />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Field label="Model" hint="The free included AI needs no key. Selecting Claude requires your own Anthropic key below.">
              <select className={inputCls} value={settings.ai_provider === "anthropic" ? "anthropic" : "auto"} onChange={set("ai_provider")}>
                <option value="auto">Free AI (included) — recommended</option>
                <option value="anthropic">Anthropic Claude (use my key)</option>
              </select>
            </Field>
            <div />
            <Field label="Anthropic API key (optional)" hint="Only needed if you chose Claude above. Get one at console.anthropic.com.">
              <input type="password" className={inputCls} value={settings.anthropic_api_key ?? ""} onChange={set("anthropic_api_key")} placeholder="sk-ant-…" />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="Lead Finder"
            subtitle="OpenStreetMap works free with no key. Add a Google Places API key to also search official Google Maps data."
            badge={settings.google_places_api_key ? "google enabled" : "osm only"}
            badgeOk={Boolean(settings.google_places_api_key)}
          />
          <div className="mt-4">
            <Field label="Google Places API key (optional)" hint="Create one at console.cloud.google.com — enable the 'Places API (New)'. Free monthly quota covers small lead searches.">
              <input type="password" className={inputCls} value={settings.google_places_api_key ?? ""} onChange={set("google_places_api_key")} placeholder="AIza…" />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="Email delivery (SMTP)"
            subtitle="Optional until you go live — everything works in simulation mode without it. Connect your mailbox when you're ready to send for real."
            badge={smtpConfigured ? "configured" : "simulation mode"}
            badgeOk={smtpConfigured}
          />

          {/* Quick setup wizard: detect the provider from the email's MX records */}
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="text-sm font-medium text-zinc-700">⚡ Quick setup</div>
            <p className="mt-0.5 mb-3 text-xs text-zinc-500">
              Type the email address you&apos;ll send from — we detect your provider and
              fill every field below. You only paste the password.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                className={`${inputCls} max-w-xs`}
                value={wizEmail}
                onChange={(e) => setWizEmail(e.target.value)}
                placeholder="you@yourcompany.com"
              />
              <button
                className={btnPrimary}
                onClick={detectProvider}
                disabled={wizBusy || !wizEmail.trim()}
              >
                {wizBusy ? "Detecting…" : "Detect settings"}
              </button>
              <select
                className={`${inputCls} max-w-[220px]`}
                value={wizProvider?.id ?? ""}
                onChange={(e) => pickProvider(e.target.value)}
              >
                <option value="">…or pick your provider</option>
                {Object.values(PROVIDER_PRESETS).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            {wizMsg && <div className="mt-2 text-sm text-red-500">{wizMsg}</div>}
            {wizProvider && (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    ✓ {wizProvider.label}
                  </span>
                  <span className="text-xs text-zinc-400">
                    — settings filled in below, just add the password and Save
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-zinc-600">
                  {wizProvider.guide.map((g) => (
                    <li key={g} className="flex gap-2">
                      <span className="text-zinc-300">•</span>
                      {g}
                    </li>
                  ))}
                </ul>
                {wizProvider.appPasswordUrl && (
                  <a
                    href={wizProvider.appPasswordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-block rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                  >
                    Open App Password page ↗
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Field label="SMTP host">
              <input className={inputCls} value={settings.smtp_host ?? ""} onChange={set("smtp_host")} placeholder="smtp.gmail.com" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Port">
                <input className={inputCls} value={settings.smtp_port ?? ""} onChange={set("smtp_port")} placeholder="587" />
              </Field>
              <Field label="TLS/SSL">
                <select className={inputCls} value={settings.smtp_secure ?? "false"} onChange={set("smtp_secure")}>
                  <option value="false">STARTTLS (587)</option>
                  <option value="true">SSL (465)</option>
                </select>
              </Field>
            </div>
            <Field label="SMTP username">
              <input className={inputCls} value={settings.smtp_user ?? ""} onChange={set("smtp_user")} placeholder="you@yourdomain.com" />
            </Field>
            <Field label="SMTP password" hint="For Gmail, use an App Password.">
              <input type="password" className={inputCls} value={settings.smtp_pass ?? ""} onChange={set("smtp_pass")} />
            </Field>
            <Field label="From email">
              <input className={inputCls} value={settings.from_email ?? ""} onChange={set("from_email")} placeholder="jane@acme.com" />
            </Field>
            <Field label="From name">
              <input className={inputCls} value={settings.from_name ?? ""} onChange={set("from_name")} placeholder="Jane from Acme" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Public base URL" hint="Used for unsubscribe links AND open/click tracking in outgoing emails. Must be reachable by recipients (e.g. https://outreach.yourdomain.com). On localhost, tracking only works for tests on this machine.">
              <input className={inputCls} value={settings.base_url ?? ""} onChange={set("base_url")} placeholder="http://localhost:3000" />
            </Field>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100">
            <div className="text-sm font-medium text-zinc-600 mb-2">Send a test email</div>
            <div className="flex gap-2 max-w-md">
              <input className={inputCls} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
              <button className={btnSecondary} onClick={sendTest} disabled={testing || !testTo}>
                {testing ? "Sending…" : "Send test"}
              </button>
            </div>
            {testMsg && <div className="text-sm text-zinc-500 mt-2">{testMsg}</div>}
            <div className="text-xs text-zinc-400 mt-2">Save your settings first — the test uses the saved values.</div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="Reply detection (IMAP)"
            subtitle="Polls your inbox every 2 minutes. Replies auto-mark the contact as replied (stopping follow-ups); bounce notices auto-mark the contact as bounced (stopping all sends). Leave the fields blank to reuse your SMTP mailbox."
          />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Field label="IMAP host" hint="cPanel mail: same as your mail domain, e.g. sakodev.com">
              <input className={inputCls} value={settings.imap_host ?? ""} onChange={set("imap_host")} placeholder="(defaults to SMTP host)" />
            </Field>
            <Field label="IMAP port" hint="Usually 993 (SSL).">
              <input className={inputCls} value={settings.imap_port ?? ""} onChange={set("imap_port")} placeholder="993" />
            </Field>
            <Field label="IMAP username">
              <input className={inputCls} value={settings.imap_user ?? ""} onChange={set("imap_user")} placeholder="(defaults to SMTP username)" />
            </Field>
            <Field label="IMAP password">
              <input type="password" className={inputCls} value={settings.imap_pass ?? ""} onChange={set("imap_pass")} placeholder="(defaults to SMTP password)" />
            </Field>
          </div>
          <div className="mt-4">
            <button className={btnSecondary} onClick={testImap} disabled={imapTesting}>
              {imapTesting ? "Connecting…" : "Test IMAP connection"}
            </button>
            {imapMsg && <div className="text-sm text-zinc-500 mt-2">{imapMsg}</div>}
            <div className="text-xs text-zinc-400 mt-2">Save first — the test uses the saved values.</div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="Account security"
            subtitle="Stored credentials — SMTP/IMAP passwords and API keys — are encrypted at rest and shown as •••••••• once saved; type a new value to replace one. Recipient-facing pages (unsubscribe, tracking) stay public by design."
          />
          <div className="grid md:grid-cols-3 gap-4 mt-4 items-end">
            <Field label="Current password">
              <input
                type="password"
                className={inputCls}
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
              />
            </Field>
            <Field label="New password" hint="At least 8 characters.">
              <input
                type="password"
                className={inputCls}
                value={pwNext}
                onChange={(e) => setPwNext(e.target.value)}
              />
            </Field>
            <div className="pb-5">
              <button
                className={btnSecondary}
                onClick={updatePassword}
                disabled={pwBusy || !pwCurrent || pwNext.length < 8}
              >
                {pwBusy ? "Updating…" : "Change password"}
              </button>
            </div>
          </div>
          {pwMsg && <div className="text-sm text-zinc-500 mt-2">{pwMsg}</div>}
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="Deliverability"
            subtitle="Protect your sender reputation so emails land in the inbox, not spam."
          />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Field label="Daily send cap" hint="Max real emails sent per day. New domains: keep this modest (25–50).">
              <input className={inputCls} value={settings.daily_send_cap ?? ""} onChange={set("daily_send_cap")} placeholder="50" />
            </Field>
            <div className="flex items-center pt-7">
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={settings.warmup_enabled === "true"}
                  onChange={(e) => setToggle("warmup_enabled", e.target.checked)}
                />
                Warm-up mode (ramp: 10/day week 1, 25 week 2, 40 week 3, then full cap)
              </label>
            </div>
            <Field
              label="Time zone for send windows"
              hint="Campaign business-hours windows are evaluated in this zone. Empty = server time."
            >
              <input
                className={inputCls}
                list="tz-options"
                value={settings.timezone ?? ""}
                onChange={set("timezone")}
                placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone}
              />
              <datalist id="tz-options">
                {(
                  (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
                    .supportedValuesOf?.("timeZone") ?? []
                ).map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100">
            <div className="text-sm font-medium text-zinc-600 mb-2">DNS deliverability check</div>
            <div className="text-xs text-zinc-400 mb-3">
              Checks SPF, DKIM, and DMARC on your From-email domain — the three records that decide inbox vs. spam.
            </div>
            <button className={btnSecondary} onClick={runDnsCheck} disabled={dnsChecking}>
              {dnsChecking ? "Checking…" : "Run DNS check"}
            </button>
            {dnsError && <div className="text-sm text-red-500 mt-2">{dnsError}</div>}
            {dnsResult && (
              <div className="mt-4">
                <div className="text-sm text-zinc-600 mb-3">
                  Domain <span className="font-medium">{dnsResult.domain}</span> — {dnsResult.summary}
                </div>
                <div className="space-y-2">
                  {dnsResult.checks.map((c) => (
                    <div key={c.name} className="rounded-lg border border-zinc-100 p-3">
                      <div className="flex items-center gap-2">
                        <span className={c.pass ? "text-emerald-600" : "text-red-500"}>
                          {c.pass ? "✓" : "✕"}
                        </span>
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="text-xs text-zinc-400">{c.detail}</span>
                      </div>
                      {c.advice && <div className="text-xs text-amber-600 mt-1 ml-6">{c.advice}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  badge,
  badgeOk,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  badgeOk?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>
      </div>
      {badge && (
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            badgeOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {badge}
        </span>
      )}
    </div>
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
