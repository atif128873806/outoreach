---
name: verify
description: How to run and drive Outreach Studio locally to verify changes end-to-end.
---

# Verifying Outreach Studio

## Launch

```bash
npx next dev -p 3123          # PGlite embedded DB in data/pg — no server needed
curl http://localhost:3123/api/health   # 200 when up (~10s)
```

Careful: the user often has their own `next dev` running on :3000 with the
same `data/pg` PGlite dir — don't kill it, and prefer creating fresh test
users over touching existing rows.

## Useful env toggles

- `SYSTEM_SMTP_HOST/PORT/USER/PASS` + `APP_URL` — turns ON transactional email
  and therefore email-verification enforcement. Point at a local sink to
  capture emails (a ~50-line python SMTP sink on :2525 works; advertise
  `250 AUTH PLAIN LOGIN` or nodemailer refuses to authenticate).
- `GROQ_API_KEY` / `ANTHROPIC_API_KEY` — the "global AI key". A fake value is
  enough to test gating: unverified users fall back to templates, verified
  users reach the provider (observable as a 401 from the API).
- No `DATABASE_URL` = PGlite; set it for real Postgres.

## Driving flows (all JSON over cookies)

```bash
curl -c jar -X POST :3123/api/auth/signup -d '{"email":..,"name":..,"password":..}'
curl -b jar :3123/api/auth/me               # emailVerified flag
curl -b jar -X POST :3123/api/campaigns/preview -d '{"description":..,"channel":"email"}'
```

Verification/reset links arrive in the sink as quoted-printable — decode with
python `email` lib (`decode_header` for subjects: spaces become underscores).

## Gotchas

- Login rate limit is 5/15min per IP counting successes too — do rate-limit
  probes last or they block later logins.
- `npm test` = `node --test` on `tests/*.test.ts`, no deps needed (Node ≥23).
- 4 pre-existing `react-hooks/set-state-in-effect` lint errors in
  campaigns/contacts/messages pages — not regressions.
