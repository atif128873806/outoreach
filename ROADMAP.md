# Outreach Studio — Product Roadmap

Written 2026-07-12, right after MVP launch. This is the build plan for taking the
product from "launched MVP" to "complete, self-sustaining SaaS." Each item says
**what**, **why**, **how** (with file pointers into this codebase), and a rough
effort estimate — so any developer or AI session can pick one up and execute it
without re-deriving context.

Work through phases in order. Inside a phase, items are sorted by value.

---

## Where the product stands today (done, live at outreach.sakodev.com)

- Full pipeline: Lead Finder (3 sources + owner search) → AI writing (global key
  or BYO) → throttled/windowed sending with warm-up → follow-ups that stop on
  reply → IMAP reply triage with AI-suggested answers → open/click/reply stats.
- Auth complete: signup, login, password reset, email verification (gates real
  sending + included AI). Rate limiting is DB-backed.
- Plans enforced: Free / Starter $9 / Pro $29 (`lib/plans.ts` is the single
  source of truth; metering in `lib/usage.ts` + `lib/ai-usage.ts`).
- Public site: landing, /features product tour, /pricing, /terms, /privacy,
  /refund-policy, /contact. Email fully authenticated (SPF/DKIM/DMARC/MX).
- Deploy: Docker Compose on Hostinger VPS, nginx + certbot, nightly pg_dump.
  Redeploy flow: `git archive HEAD` → scp → extract in /opt/outreach-studio →
  `docker compose up -d --build` (rebuild is REQUIRED for code changes).
- Tests: `npm test` (node --test, tests/*.test.ts). Verify recipe:
  `.claude/skills/verify/SKILL.md`.

---

## Phase 1 — Money loop

> **2026-07-12 UPDATE — Paddle REJECTED the domain** under their AUP
> ("facilitation of unsolicited outbound marketing" + "enriching marketing
> lists"). This is a *category* rejection — cold-outreach tools and lead
> enrichment are outside Paddle's acceptable use, so rewording the site won't
> fix it. Lemon Squeezy has equivalent restrictions. **Never misrepresent the
> product to a processor** — approval-then-termination freezes funds.

### 1.0 Payments strategy (revised)
- **Now:** manual billing. Invoice via Payoneer/Wise/bank (JazzCash/Easypaisa
  locally), activate plans via the /admin dropdown. /billing already routes
  upgrade requests to the support email.
- **Dodo Payments: DEAD END (tried 2026-07-12)** — account creation does not
  support Pakistan-region merchants, despite their marketing about Pakistan
  payouts. Don't retry unless they announce Pakistan onboarding.
- **Candidates still open:** 2Checkout/Verifone (historically onboards
  Pakistani merchants — check their AUP for outreach tools and apply
  honestly); regional options (Payoneer checkout, local PSPs) for
  Pakistan-market customers.
- **The real answer, when revenue justifies it:** US LLC (Wyoming, via
  Firstbase/doola, ~$300–500 setup + ~$200/yr) + Mercury bank + **Stripe** —
  the route the major cold-email SaaS products use. Never misrepresent the
  product to any processor; category-fit honestly or don't apply.

### 1.1 Checkout + webhook → automatic plan activation  ⭐ the #1 gap
The integration shape below was written for Paddle but applies to ANY provider
(Dodo Payments has equivalent webhooks; Stripe likewise):
- Create products matching `lib/plans.ts` exactly
  (Starter $9/mo · $90/yr, Pro $29/mo · $290/yr).
- New route `app/api/billing/webhook/route.ts`: verify the provider's webhook
  signature (secret in env), handle subscription activated/updated/canceled
  → `UPDATE users SET plan=... ` (map via customer email; store
  `billing_customer_id`/`billing_subscription_id` columns on `users` —
  add via migration in `lib/db.ts` `init()`).
- Add the webhook path to `PUBLIC_PREFIXES` in `proxy.ts`.
- Upgrade buttons: provider's overlay/hosted checkout on `/billing` and
  `/pricing`, passing the signed-in user's email.
- Downgrade/cancel: webhook sets plan back to `free` at period end.
- Keep the admin dropdown (`/admin`, PATCH `/api/admin/users`) as the manual
  fallback — it already works.
**Effort:** 1–2 days including sandbox testing.

### 1.2 Dunning + plan-state emails
**Why:** failed renewals silently downgrade paying users → churn + support pain.
**How:** on webhook `past_due`/`payment_failed`, send a system email
(`lib/system-mailer.ts` — add `sendBillingEmail`) and show a banner (pattern:
`app/components/VerifyEmailBanner.tsx`). **Effort:** half a day.

---

## Phase 2 — Complete the product loop (no external blockers — start any time)

### 2.1 Reply from inside the app  ⭐ best pure-product win
**Why:** the AI already drafts the answer, but users must copy it into Gmail.
Sending it in-app closes the loop: find → write → send → reply — never leave.
**How:** `POST /api/replies/[id]/send` → load reply + contact, send via the
user's SMTP (`lib/mailer.ts` `sendMail` — add a `noTracking` variant; subject
`Re: <original>`), mark reply `handled=1`. Button in
`app/messages/page.tsx` next to the existing Copy button. Store outbound in
`emails` with `via='reply'` for the log. **Effort:** 1 day.

### 2.2 Approval mode ("review every email before it sends")
**Why:** the #1 anxiety blocker for new users of any sending tool. An
"approve each email" toggle converts skeptics.
**How:** campaign flag `approval_required` (migration in `lib/db.ts`); in
`lib/runner.ts` the email channel branch sets status `ready` instead of sending
(mirror the existing instagram/linkedin draft path); Message Center gets
Approve & send / Edit / Skip actions (`app/api/messages` PATCH). Editing the
draft before approving = also solves "let me tweak the AI's text."
**Effort:** 1–2 days.

### 2.3 Contact tags + campaign targeting by tag
**Why:** `category_filter` is the only targeting today. Tags ("hot", "webinar-list")
are how real users segment.
**How:** `tags TEXT` column on contacts (comma list is fine at this scale),
tag chips in `app/contacts/page.tsx`, tag filter joined into the campaign
creation query (`app/api/campaigns/route.ts` builds the pending-emails set).
**Effort:** 1 day.

### 2.4 Custom tracking domain (CNAME)
**Why:** open/click links currently use the app domain; serious senders want
`links.theirdomain.com`. Big deliverability + trust win for Pro.
**How:** per-user setting `tracking_domain` (add to `SETTING_KEYS`,
`lib/settings.ts`); `lib/mailer.ts` uses it as `base` when set; docs page
telling users to CNAME to outreach.sakodev.com; nginx must answer for arbitrary
hosts on /api/t/* (wildcard server block). Gate to Pro (`lib/plans.ts` flag).
**Effort:** 1–2 days incl. nginx.

---

## Phase 3 — Scale & retention

- **3.1 Weekly digest email** — "last 7 days: X sent, Y opens, Z replies —
  3 people are waiting on you." Brings users back. Cron in `lib/scheduler.ts`
  (it already runs node-cron), render via system mailer. Effort: 1 day.
- **3.2 Multi-mailbox rotation** — Pro feature; N SMTP accounts round-robin per
  campaign to multiply safe volume. Schema: `mailboxes` table per user;
  `lib/runner.ts` picks the mailbox with remaining daily budget. Effort: 2–3 days.
- **3.3 Team seats (Pro+/new tier)** — `workspace_id` on users; everything else
  already keys on user_id, so scope carefully — this is the biggest refactor
  listed here. Do it only when a real customer asks. Effort: 1 week.
- **3.4 CSV export everywhere** (contacts w/ status, campaign results). Cheap
  and often requested. Effort: half a day.
- **3.5 Zapier/webhook out** — fire `reply.received`, `campaign.completed` to a
  user-set URL. Effort: 1 day.

## Phase 4 — Growth (marketing site, not app)

- Programmatic SEO pages: "/cold-email-for-dentists" style templates off one
  component (the copy engine you already have could draft these).
- Blog: deliverability guides — ranks well, matches buyer intent.
- Affiliate program (Paddle supports this natively — free money post-1.1).
- Public status page + /changelog — trust signals that cost an hour each.

## Deliberately NOT building (yet)

- **Automated Instagram/LinkedIn sending** — ban-risk; the manual-draft model is
  a *selling point* (see /features). Revisit never, probably.
- **Email warm-up network** (fake inbox pinging) — gray-hat, providers punish it.
- **Multi-region/k8s anything** — one VPS is fine until well past 1k users.
- **Native mobile app** — the web app is responsive; no demand signal.

## Standing operational debt (do alongside features)

1. Rotate VPS root + mailbox passwords (were shared in chat); move to SSH keys.
2. Test one pg_dump restore end-to-end, once.
3. Push the repo to a private GitHub + enable CI (`npm test` + `next build`).
4. Error visibility: at minimum a daily `docker logs --since 24h | grep -iE "error|failed"`
   cron that emails the admin; Sentry if volume grows.
5. `p=none → p=quarantine` on DMARC after ~2 clean weeks.

## How to work on this repo with AI

- `CLAUDE.md` → `AGENTS.md`: **read `node_modules/next/dist/docs/` before Next
  code — this Next version has breaking changes.**
- `.claude/skills/verify/SKILL.md`: how to run + drive the app locally.
- Plans/limits: change `lib/plans.ts` only — pages and enforcement follow it.
- Deploy: see "Redeploy flow" at top; config lives in `/opt/outreach-studio/.env`
  on the VPS (never bake it into the image — `.dockerignore` guards this).
