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
- **AI-personalized messages, two providers** — Groq (llama-3.3-70b-versatile by default) or Claude (Anthropic API) writes a unique message per contact using their business name, category, and notes, in your chosen tone, grounded in your sender identity from Settings. Provider is selectable in Settings; the included "Auto" path uses the instance key, preferring Groq when configured.
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
- **Recipient safeguards** — every real campaign email includes the sender's postal address, a visible opt-out link, and RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post` headers; unsubscribed contacts are skipped forever
- **Conservative email safety check** — before first send, addresses are checked for valid syntax, known disposable providers, and a working domain mail route. Invalid/risky contacts are skipped without pretending a domain check proves that a specific mailbox exists.
- **Simulation mode** — without SMTP configured, the whole pipeline runs but sends are only logged, so you can test safely
- **Multi-user accounts** — email + password sign-up, each account fully isolated (own contacts, campaigns, SMTP/IMAP, API keys, caps); sessions are signed cookies, login attempts are rate-limited; recipient-facing unsubscribe/tracking endpoints stay public
- **Credentials encrypted at rest** — SMTP/IMAP passwords and API keys are stored AES-256-GCM-encrypted (key from `APP_SECRET` env or an auto-generated `data/.secret`) and are never sent back to the browser
- **Hardened public endpoints** — tracking, unsubscribe, and lead-search endpoints are rate-limited; the click tracker only redirects for tokens it actually issued
- **Resilient sending** — SMTP connections have hard timeouts, and transient failures (network, greylisting, rate limits) retry automatically up to 3 times with backoff

## Quick start (local)

```bash
npm install
npm run dev        # or: npm run build && npm start
```

Open http://localhost:3000 and **create your account** (multi-user: every account has its own contacts, campaigns, settings, and inbox polling). Locally, data lives in an embedded Postgres (PGlite) under `data/pg` — no database server needed. If a pre-multi-user `data/outreach.db` exists, the **first** account automatically adopts all of its data.

Then per account:

1. **Settings** → fill in your sender identity, paste your Groq API key (console.groq.com) or Anthropic API key (console.anthropic.com) — env vars `GROQ_API_KEY` / `ANTHROPIC_API_KEY` also work as global fallbacks — and optionally configure SMTP. Without SMTP, sends are simulated.
2. **Contacts** → import your CSV (a template is downloadable on that page).
3. **Campaigns** → create a campaign: describe your offer, pick tone/audience/time/speed, preview a sample email, and schedule it.

The scheduler starts with the server and checks every minute for due campaigns, per user.

## Deploying (production)

```bash
cp .env.example .env      # set POSTGRES_PASSWORD and APP_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

That runs three containers: the app, **Postgres 17** (volume-backed), and a **nightly pg_dump backup** service (kept 14 days in `./backups`). Health check: `GET /api/health`. Put a TLS-terminating reverse proxy (Caddy, nginx, Traefik) in front and set each account's **Public base URL** in Settings to the HTTPS domain so tracking and unsubscribe links work.

Running elsewhere (Railway, Fly, a VPS without Docker): set `DATABASE_URL` to any Postgres and `APP_SECRET` to a stable random value, then `npm run build && npm start`. Run a single app instance — the scheduler takes a Postgres advisory lock so an accidental second instance won't double-send, but one instance is the supported shape.

## CSV format

```csv
email,business_name,category,website,notes
info@joespizza.com,Joe's Pizza,Restaurant,https://joespizza.com,Family-owned since 1985
```

Only `email` is required. Common header aliases (company, industry, url, …) are detected automatically.

## Stack

Next.js (App Router) · Postgres (`pg` in production via `DATABASE_URL`, embedded PGlite for local dev) · multi-user auth (scrypt + HMAC session cookies) · Groq API (`llama-3.3-70b-versatile`, JSON mode) or Anthropic API (`claude-opus-4-8`, structured outputs) · Nodemailer · node-cron

## Responsible use

This tool is built for legitimate business outreach. Keep unsubscribe links working (set the **Public base URL** in Settings), honor opt-outs, send at reasonable rates, and comply with the anti-spam laws that apply to you (CAN-SPAM, GDPR, PECR, etc.).
