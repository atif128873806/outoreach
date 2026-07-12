# Outreach Studio — Launch & Marketing Copy Kit

Ready-to-paste copy for directories, launch platforms, social posts, and ads.
Rule of thumb: never edit facts (prices, limits, features) without checking
`lib/plans.ts` and the live site first. Everything below is true as of July 2026.

**Live URLs**
- Product: https://outreach.sakodev.com
- Product tour: https://outreach.sakodev.com/features
- Pricing: https://outreach.sakodev.com/pricing
- Free tool #1: https://outreach.sakodev.com/tools/spam-checker
- Free tool #2: https://outreach.sakodev.com/tools/dns-checker

---

## 1. Taglines (pick per context)

- **Outreach that finds the leads, writes the words, and follows up.** ← primary
- Cold outreach on autopilot — replies land in your inbox.
- From "dentists in Austin" to booked calls, on one pipeline.
- The outreach tool that writes a different email for every contact.
- Find. Write. Send. Listen. Learn. One pipeline.

## 2. Descriptions by length

### Micro (≤60 characters — directory name fields, PH tagline)
> AI finds leads, writes personal cold emails, and follows up

### Short (~160 characters — meta descriptions, BetaList, tweet bio)
> Outreach Studio finds business leads with emails included, has AI write a
> personal message to each one, sends at a human pace, and triages the replies.
> Free plan included.

### Medium (1 paragraph — most directory "about" fields)
> Outreach Studio is an all-in-one outreach platform for freelancers, agencies,
> and small B2B teams. Type a niche and a city — "dentists in Austin" — and the
> Lead Finder returns real businesses with emails, socials, and company intel
> attached. AI then writes a genuinely personal message for every contact (no
> mail-merge brackets), sends them through your own mailbox at a human pace with
> follow-ups that stop the moment someone replies, and classifies every answer —
> with a suggested response drafted in your voice. Deliverability is built in:
> warm-up ramps, daily caps, send windows, spam-filter lint, and a one-click
> SPF/DKIM/DMARC checker. Free plan with AI writing included; paid plans from
> $9/month.

### Long (G2 / Capterra / AlternativeTo full description)
> **What it is** — Outreach Studio automates the full outreach pipeline that
> freelancers and agencies usually stitch together from 4–5 tools: lead
> discovery, AI copywriting, scheduled sending, reply handling, and analytics.
>
> **Find** — Search any niche in any city. Three sources (AI web search,
> OpenStreetMap, Google Places) return businesses with emails, Instagram, and
> LinkedIn already extracted, plus company intel for personalization. One click
> finds the owner or founder behind each business. Or import your own CSV.
>
> **Write** — No templates with {{first_name}} brackets. AI reads what each
> business actually does and writes a unique, under-150-word email in your
> voice and tone. A/B subject testing, spam-filter lint on every preview, and a
> built-in template engine as a no-API fallback. AI writing is included free
> (150 generations/day on the free plan) — or bring your own Groq/Anthropic key
> for unlimited use with zero per-message markup.
>
> **Send** — Through your own SMTP mailbox, throttled to a human pace, inside
> business-hours send windows, with a 4-week warm-up ramp for new domains. Up
> to 3 automatic follow-ups written in context — a reply stops the sequence
> instantly, a bounce stops everything for that contact.
>
> **Listen** — Your inbox is polled over IMAP; every reply is classified
> (interested / question / not interested / out of office) and answered with an
> AI-drafted response ready to send. Bounces auto-protect your sender
> reputation.
>
> **Learn** — Open, click, and reply rates per campaign and per A/B arm, a
> 14-day activity chart, and a full per-message log.
>
> **Compliance by design** — Every email carries one-click unsubscribe +
> List-Unsubscribe headers, opt-outs are enforced permanently, and Instagram/
> LinkedIn messages are drafted for manual sending (automated DMs get accounts
> banned — Outreach Studio never fakes them).
>
> **Pricing** — Free forever plan (150 leads/mo, 50 emails/day, 150 AI
> writes/day). Starter $9/mo. Pro $29/mo with unlimited AI writing. Your data
> stays in your own Postgres; SMTP passwords and API keys are encrypted at rest.

## 3. Product Hunt kit

- **Name:** Outreach Studio
- **Tagline (60 chars):** AI finds leads, writes personal cold emails & follows up
- **Topics:** Sales, Marketing, Email Marketing, Artificial Intelligence, SaaS
- **Description:** use the Medium description above.
- **First (maker) comment draft:**
> Hey PH 👋 I'm Atif, a solo founder from Pakistan.
>
> I built Outreach Studio because doing outreach as a freelancer meant juggling
> a scraper, a spreadsheet, a mail-merge tool, and my inbox — and the results
> still looked like spam.
>
> Outreach Studio is the whole pipeline in one place: type "dentists in Austin",
> get real businesses with emails attached, and AI writes a *different* email
> for each one — my rule was no {{first_name}} brackets, ever. It sends through
> your own mailbox at a human pace, follows up until someone replies, then
> classifies the reply and drafts your answer.
>
> Two things I'm proud of:
> 1. Deliverability is a first-class feature — warm-up ramps, caps, send
>    windows, spam lint, and a free SPF/DKIM/DMARC checker (try it, no signup:
>    outreach.sakodev.com/tools/dns-checker).
> 2. It never fake-automates Instagram/LinkedIn DMs (that gets accounts
>    banned) — it drafts them and you send with one click. Honest automation.
>
> Free plan with AI included — no card, no trial timer. I'd love your feedback,
> and I'll be here all day answering questions.

## 4. Social posts

### LinkedIn launch post
> I just launched Outreach Studio 🚀
>
> As a freelancer, outreach meant: scrape leads in one tool, clean them in a
> spreadsheet, mail-merge in another tool, then lose replies in my inbox.
>
> So I built the whole pipeline into one product:
> → Type "dentists in Austin" — get businesses with emails attached
> → AI writes a *different* email for every contact (no {{brackets}})
> → Sends from your own mailbox, at a human pace, with follow-ups
> → Replies get classified + answered with an AI draft
>
> Deliverability is built in: warm-up, daily caps, spam lint, DNS checks.
>
> Free plan with AI writing included. Link in comments — and if you do any
> kind of outreach, I'd genuinely love your feedback.

### X/Twitter (short)
> Shipped: Outreach Studio 🛠
> "dentists in Austin" → real leads with emails → AI writes each one a
> personal email → sent at a human pace → replies triaged for you.
> Free plan, AI included: outreach.sakodev.com

### Free-tool post (works on LinkedIn, X, Reddit-adjacent)
> I made a free email spam checker — no signup, runs entirely in your browser.
> Paste your cold email, see exactly which spam-filter flags you're tripping
> (trigger words, caps, links, punctuation).
> outreach.sakodev.com/tools/spam-checker
> (It's the same lint my outreach tool runs before every campaign.)

## 5. Free tools — separate directory listings

Many directories accept free tools as standalone entries. Submit both:

**Email Spam Checker** (micro: "Free spam-filter check for cold emails — no signup")
> Paste a subject line and body, get an instant read on what spam filters will
> think: trigger phrases, ALL-CAPS, punctuation abuse, link count, subject
> length. Runs entirely in the browser — nothing you type is uploaded. Free, by
> Outreach Studio.

**SPF/DKIM/DMARC Checker** (micro: "Check the 3 DNS records that decide inbox vs spam")
> Enter any domain (or just your email address) and instantly see whether SPF,
> DKIM, and DMARC are set up — with copy-paste fix instructions for whatever is
> missing. Free, no signup, by Outreach Studio.

## 6. Elevator pitches

- **10 seconds:** "Outreach Studio finds business leads with their emails, has
  AI write each one a personal message, and follows up until they reply — all
  from your own mailbox."
- **30 seconds:** add — "It's built for freelancers and small agencies: a free
  plan with AI included, deliverability protection so you don't burn your
  domain, and reply triage so hot leads get answered in minutes. Paid plans are
  $9 and $29 a month — a fraction of Instantly or Smartlead, with lead finding
  included."

## 7. Audience & positioning (for "who is it for" fields)

- **For:** freelancers, web/design/marketing agencies, consultants, indie SaaS
  founders, lead-gen VAs — anyone selling B2B services to local businesses.
- **Against competitors:** Instantly/Smartlead start at ~$37/mo and need a
  separate lead database; Outreach Studio includes lead finding + AI writing
  from $0. Apollo has the data but is built for sales teams, not solo operators.
- **Differentiators (bullet list for forms):**
  - Lead Finder with emails/socials/company intel included (3 sources)
  - AI writes per-contact — not mail-merge templates
  - Free plan with AI writing included; BYO key = zero markup, ever
  - Deliverability suite: warm-up, caps, windows, spam lint, DNS checker
  - Reply triage with AI-suggested answers
  - Ban-safe Instagram/LinkedIn drafting (never fake automation)
  - Your mailbox, your data (own SMTP, own Postgres, encrypted credentials)

## 8. SEO keyword targets (for blog + page titles)

cold email software for freelancers · instantly alternative cheap · lead finder
with emails · AI cold email writer · email spam checker free · SPF DKIM DMARC
checker · cold email templates for [dentists/real estate/agencies/…] · how to
warm up email domain · cold outreach for web design clients

## 9. Boilerplate (press/footer)

> Outreach Studio is an AI-powered outreach platform that finds business leads,
> writes personalized messages, and manages replies — built by SakoDev.
> Free at outreach.sakodev.com.
