# Outreach Studio — Growth Playbook

Written 2026-07-12, at MVP launch. Solo founder, ~$0 budget, product live at
outreach.sakodev.com. This is the marketing plan: channels ranked by
expected payoff for THIS product, each with concrete first actions.

**The strategy in one line:** sell a cold-outreach tool by doing great cold
outreach with it, give away two free tools you already built to farm SEO
signups, and turn the founder story into content while launch platforms
deliver the first spike.

**ICP (who we sell to):** freelancers and small agencies (web design, SEO,
marketing, dev shops) and solo B2B founders who need clients but can't afford
$40–100/mo for Instantly/Smartlead/Apollo stacks — or the time to learn them.
Message: "Find leads, let AI write, send safely — one tool, $9."

---

## Channel 1 — Dogfood: use Outreach Studio to sell Outreach Studio ⭐

The highest-leverage channel. Your ICP is *exactly* what your Lead Finder
finds. And the pitch writes itself — the meta angle has unusually high reply
rates:

> "This email was found, written, and sent by a tool I built. It found your
> agency, read what you do, and wrote this in my voice. If it worked on you,
> it'll work for your clients. It's $9/mo."

**Setup (do it right — protect the main domain):**
1. Buy a separate sending domain (~$10): e.g. `outreachstudio.co` or
   `tryoutreach.co`. NEVER cold-email from sakodev.com — the product domain's
   reputation must stay pristine for transactional mail.
2. Set up a mailbox on it + SPF/DKIM/DMARC (use the product's own DNS checker).
3. Turn ON the built-in warm-up ramp (10/day → full over 4 weeks). Yes, it's
   slow. Slow is what works.
4. Campaigns: one niche at a time ("web agencies in \<city>"), 25–50/day max
   once warmed. Track which niches reply; double down.

**Why this channel is mandatory even if replies were zero:** every campaign
you run is product QA, produces screenshots/numbers for content ("I sent 400
cold emails with my own tool — here's the open rate"), and makes you your own
best case study.

## Channel 2 — Free tools = SEO + signups (the code already exists!) ⭐

Two features in the codebase are giveaway-grade lead magnets:

1. **Free Email Spam Checker** — `lib/spamcheck.ts` already lints subject/body
   for spam triggers. Expose it as a public page `/tools/spam-checker`:
   paste subject+body → instant flags → "Sign up to send it." No login needed
   for the check itself.
2. **Free SPF/DKIM/DMARC Checker** — `app/api/dns-check` already does this.
   Public page `/tools/email-deliverability-checker`: enter a domain →
   pass/fail + f