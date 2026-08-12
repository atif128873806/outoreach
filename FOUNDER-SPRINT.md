# Outreach Studio — First 5 Paying Customers Sprint

This is the operating plan for validating the business before adding another
large feature. The goal is not signups. The goal is five agencies that pay,
launch a real campaign, and tell us whether the product helped create a sales
conversation.

## 1. Narrow customer profile

For this sprint, sell only to small web-design and SEO agencies that:

- have 1–10 people;
- sell to local businesses;
- have a clear offer worth at least $500;
- are currently using referrals, manual prospecting, or no repeatable outbound;
- can connect a separate outreach domain and mailbox.

Avoid enterprise sales teams, high-volume lead-generation agencies, consumer
marketers, and anyone asking to blast thousands of emails. They need a different
product and create unnecessary deliverability risk at this stage.

## 2. Founder offer

> I will personally set up your first Outreach Studio campaign, find 100 local
> businesses that visibly need your service, help you approve the messaging,
> and launch a safe pilot. Founder price: $29 for the first month. If the product
> is not useful after the pilot, I will refund it under the published policy.

What is included:

- a 30-minute onboarding call;
- niche, city, and offer selection;
- prospect review and removal of poor-fit contacts;
- mailbox/DNS safety review;
- a ten-email test batch before the remaining campaign;
- a results review after 7–14 days.

Do not promise meetings or revenue. Promise setup, a working campaign, honest
measurement, and responsive founder support.

## 3. Acquisition campaign

Use a separate outreach domain, not the product or SakoDev primary domain. Start
at 10 messages per day and target one agency niche and city at a time.

### First email

Subject: a prospecting workflow for {{agency}}

Hi {{name}},

I built a client-acquisition tool for small web and SEO agencies. It finds local
businesses with missing or outdated websites, records the specific problems it
sees, and uses those facts to draft a personal outreach message.

I am personally onboarding five agencies and helping each launch the first
100-prospect campaign. Would it be useful if I showed you the actual prospects
it finds for {{city/vertical}}?

— Atif

### Follow-up 1 — three business days later

Hi {{name}},

The useful part is not another generic AI email writer. It is finding businesses
with concrete sales signals—no mobile viewport, no HTTPS, an old site, or ad
tracking pointed at a weak landing experience—and carrying those facts into the
message.

Happy to prepare a small sample for {{agency}} before you decide anything.

— Atif

### Follow-up 2 — five business days later

Hi {{name}},

I will close the loop after this. If finding and contacting local businesses is
not a priority, no problem. If it is, reply with one niche and city and I will
send back a small prospect sample.

— Atif

Every real message must use Outreach Studio's postal-address and unsubscribe
safeguards. Stop immediately on opt-out or negative reply.

## 4. Discovery call

Ask these questions and write down the answers verbatim:

1. How do you get clients today?
2. When did you last run outbound, and what happened?
3. How do you currently find local-business prospects?
4. What makes a prospect clearly worth contacting?
5. What worries you most about cold email?
6. Which setup step feels confusing or risky?
7. What result would make $29/month an obvious purchase?
8. What would make you run a second campaign next week?

Do not demo every feature. Demonstrate the shortest route from their service to
ten approved prospects and messages.

## 5. Customer success checklist

For every design partner, record:

- account created and email verified;
- sender identity and postal address completed;
- separate sending domain authenticated with SPF, DKIM, and DMARC;
- SMTP and IMAP verified;
- first 100 prospects reviewed;
- invalid/risky domains removed by the safety check;
- ten-email test batch approved;
- full pilot launched at 10–15 messages/hour and no more than the plan's daily cap;
- bounce, reply, positive-reply, meeting, and second-campaign outcomes.

## 6. Weekly scoreboard

Use [`DESIGN-PARTNER-SCOREBOARD.md`](./DESIGN-PARTNER-SCOREBOARD.md) as the
single operating record. Track one row per customer:

| Customer | Paid | SMTP connected | First 10 sent | Total sent | Bounces | Replies | Positive replies | Meetings | Second campaign |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|

Sprint-level metrics:

- prospects contacted by the founder;
- positive founder replies;
- calls booked;
- paid design partners;
- median time from signup to first real send;
- customers who launch a second campaign within 14 days;
- customer campaign bounce rate;
- customer positive-reply rate.

## 7. Decision rules after five customers

- If fewer than two of five launch: fix onboarding before acquisition.
- If they launch but receive no replies: investigate targeting, data quality,
  deliverability, and offer before adding product features.
- If at least three launch a second campaign: activation is promising; automate
  the repeated onboarding steps.
- If customers request higher volume: build mailbox rotation before raising
  single-mailbox caps.
- If customers repeatedly ask to edit/approve messages: prioritize approval
  mode.
- If they will not pay $29 even with concierge help: revisit the ICP and value
  proposition before lowering the price.

The founder reviews this scoreboard every Friday. Customer evidence decides the
next roadmap item.

## 8. Brand decision before a broad launch

Do not rename production impulsively, but resolve the existing OutreachStudio
name collision before investing in directories, backlinks, or paid acquisition.
The owner should shortlist names that:

- have an available primary domain and social handles;
- are not descriptive clones of Outreach, Instantly, or Smartlead;
- can grow beyond cold email while still sounding credible to agencies;
- pass basic web, company-name, and trademark searches in target markets;
- are easy to say, spell, and remember after one hearing.

Keep the current name during the five-customer sprint unless counsel identifies
an urgent conflict. Decide and migrate once, before the public growth launch.
