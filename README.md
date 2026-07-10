# Outreach Studio

AI-powered business outreach automation. Import a CSV of business contacts, describe what you're offering, pick a send time — and an AI agent writes a personalized message for every contact and delivers them on schedule at a human-looking pace, across **email and Instagram DM**.

## Features

- **CMS dashboard** — stats, recent activity, upcoming campaigns, setup checklist
- **Lead Finder** — discover businesses by niche + location and pick how many leads you want. Three sources: **Web search (AI)** (semantic company search via Exa's free MCP endpoint — often returns emails, phones, and addresses directly; free, no key), **OpenStreetMap** (free, no key), or the official **Google Places API** (add a key in Settings). Web-search results also carry **company intel** (what the business does, size, founding year) straight into the contact's notes, giving the AI real material to personalize with. Each lead's website is then visited automatically to extract its **email address and Instagram handle** — with **Jina Reader** (r.jina.ai) as a fallback renderer for JS-heavy sites a plain fetch can't read (set `JINA_API_KEY` for higher rate limits; works without one). Results can be downloaded as CSV or imported straight into Contacts, ready for a campaign. (Web-scraping approach adapted from [agent-reach](https://github.com/Panniantong/agent-reach).)
- **CSV contact import** — flexible header detection (`email`, `business name`/`company`, `category`/`industry`, `website`, `instagram`/`ig`, `phone`, `notes`); Instagram URLs/@handles auto-normalized; deduplicates by email; manual add form too
- **Three channels per campaign**
  - **Email** — sent automatically on schedule via SMTP
  - **Instagram DM** — AI drafts a personalized DM per contact; the **Message Center** gives you one-click *copy → open profile → mark sent*. (Instagram bans automated cold DMs, so drafts are sent manually — compliant and ban-safe.)
  - **LinkedIn** — AI drafts a personalized LinkedIn message per contact (professional register, ≤90 words), sent the same compliant way from the Message Center; LinkedIn profiles are captured automatically by the Lead Finder (web search + website scan) and from CSV imports
- **AI-personalized messages, two providers** — Groq (llama-3.3-70b-versatile by default) or Claude (Anthropic API) writes a unique message per contact using their business name, category, and notes, in your chosen tone, grounded in your sender identity from Settings. Provider is selectable in Settings; "Auto" prefers Anthropic when its key exists, otherwise Groq.
- **Template engine (no API key needed)** — without any AI key, a built-in engine with rotating, tone-aware variants writes the messages instead, so no two emails in a batch are identical
- **Follow-up sequences** — up to 3 automatic follow-ups, N days apart, that stop as soon as a contact replies
- **Reply & bounce detection (IMAP)** — polls your inbox every 2 minutes: a reply auto-marks the contact as *replied* (stopping their follow-ups), and a bounce notice auto-marks them *bounced* (excluding them from all future sends to protect your reputation)
- **AI reply triage** — each reply's text is read, classified (*interested / question / not interested / out of office*), and answered with an **AI-drafted suggested response** in your voice — copy it or open it pre-filled in your mail app from the Message Center's Replies tab
- **AI campaign assistant** — "✨ Improve with AI" turns a rough one-line idea into a crisp campaign brief (and names the campaign for you)
- **Decision-maker finder** — one click per lead searches LinkedIn (via Exa people search) for the owner/founder behind the business; attach a person and their name, role, and profile flow into the contact's notes for personalization
- **A/B subject-line testing** — email campaigns can alternate two AI subject strategies (benefit statement vs. curiosity question); per-arm open rates and the leading arm show on the campaign page
- **Dashboard analytics** — a 14-day sent/opened/replied chart with hover details on the dashboard
- **Deliverability check on previews** — every sample email is linted against spam-filter red flags (trigger phrases, caps, punctuation, link count) before you schedule
- **Email me this preview** — send the generated sample to your own inbox to see exactly what recipients will get
- **Open & click tracking** — every email carries a tracking pixel and wrapped links, so campaigns report open rate, click rate, and reply rate (shown on the dashboard, campaign list, and per-email log)
- **Deliverability protection** — daily send cap, a warm-up ramp for new senders (10/day → 25 → 40 → full over the first weeks), and a one-click SPF/DKIM/DMARC DNS checker for your sending domain
- **Send windows** — restrict sending to business hours (e.g. 09:00–17:00)
- **Goal presets** — one-click campaign briefs (book a call, promote an offer, partnership, event invite)
- **Sample preview** — see exactly what will be written before scheduling
- **Scheduled sending** — pick a date/time; a background scheduler (checks every minute) starts the campaign automatically
- **Throttled delivery** — configurable messages/hour to protect sender reputation
- **Campaign controls** — pause, resume, start now, cancel; live progress and a full per-message log with follow-up steps
- **Unsubscribe handling** — every email carries a one-click unsubscribe link (plus `List-Unsubscribe` header); unsubscribed contacts are skipped forever
- **Simulation mode** — without SMTP configured, the whole pipeline runs but sends are only logged, so you can test safely
- **Login protection** — set an app password in Settings and the whole dashboard requires sign-in (recipient-facing unsubscribe/tracking endpoints stay public); sessions are signed cookies, login attempts are rate-limited
- **Credentials encrypted at rest** — SMTP/IMAP passwords and API keys are stored AES-256-GCM-encrypted (key from `APP_SECRET` env or an auto-generated `data/.secret`) and are never sent back to the browser
- **Hardened public endpoints** — tracking, unsubscribe, and lead-search endpoints are rate-limited; the click tracker only redirects for tokens it actually issued
- **Resilient sending** — SMTP connections have hard timeouts, and transient failures (network, greylisting, rate limits) retry automatically up to 3 times with backoff

## Quick start

```bash
npm install
npm run dev        # or: npm run build && npm start
```

Open http://localhost:3000, then:

1. **Settings** → fill in your sender identity, paste your Groq API key (console.groq.com) or Anthropic API key (console.anthropic.com) — env vars `GROQ_API_KEY` / `ANTHROPIC_API_KEY` also work — and optionally configure SMTP. Without SMTP, sends are simulated.
2. **Contacts** → import your CSV (a template is downloadable on that page).
3. **Campaigns** → create a campaign: describe your offer, pick tone/audience/time/speed, preview a sample email, and schedule it.

The scheduler starts with the server and checks every minute for due campaigns.

## CSV format

```csv
email,business_name,category,website,notes
info@joespizza.com,Joe's Pizza,Restaurant,https://joespizza.com,Family-owned since 1985
```

Only `email` is required. Common header aliases (company, industry, url, …) are detected automatically.

## Stack

Next.js (App Router) · SQLite (better-sqlite3, stored in `data/outreach.db`) · Groq API (`llama-3.3-70b-versatile`, JSON mode) or Anthropic API (`claude-opus-4-8`, structured outputs) · Nodemailer · node-cron

## Responsible use

This tool is built for legitimate business outreach. Keep unsubscribe links working (set the **Public base URL** in Settings), honor opt-outs, send at reasonable rates, and comply with the anti-spam laws that apply to you (CAN-SPAM, GDPR, PECR, etc.).
