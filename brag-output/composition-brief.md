# Hyperframes Composition Brief: Outreach Studio

## Objective
Create a short, premium launch film for Outreach Studio that shows the real product pipeline — find leads → AI writes → sends safely → replies triaged — in the product's own UI language, for the website hero and LinkedIn.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22s

## Source Material
- Project root: `/home/kashi/Projects/automationn_outreach`
- Primary files read: `app/page.tsx` (landing hero/FAQ), `app/features/page.tsx` (pipeline + UI vignettes), `app/leads/page.tsx` (Lead Finder UI), `app/campaigns/[id]/page.tsx`, `app/components/{Logo,ActivityChart}.tsx`, `app/globals.css`, `app/layout.tsx`, `lib/plans.ts`
- Product name: Outreach Studio
- Tagline / strongest claim: "Outreach that finds the leads, writes the words, and follows up" — closing line for this film: **"Every email different. Every one from you."**
- Key UI moments to recreate (real surfaces, real copy): Lead Finder search row + result rows with email badges; AI email preview with highlighted personalization + "0 spam-filter flags"; campaign progress with throttle/send-window + follow-up "stopped — replied ✓"; reply triage with "● interested" + "✨ Suggested reply"; dashboard KPI tiles.
- Copy that must appear verbatim:
  - `dentists` / `Austin, TX` (Lead Finder query)
  - `18 found · 14 with email · 11 with Instagram`
  - `Bright Smile Dental`, `Lakeway Family Dentistry`, `Austin Ortho Group`
  - `✓ 0 spam-filter flags`
  - `Written by AI · 96 words`
  - `112 of 180 sent`, `12 / hour`, `09:00–17:00`
  - `stopped — replied ✓`
  - `interested`
  - `✨ Suggested reply`
  - `Every email different. Every one from you.`
  - `outreach.sakodev.com`

## Creative Direction
- Tone preset: `polished`
- Creative direction: quiet premium product film — a real tool doing real work, no hype
- Interpretation: restraint. Four product beats + outro, slow confident reveals, generous whitespace, mixed-case medium-weight type, crossfades not slams. Motion only to direct the eye to product truth.
- Angle: Four words, four screens — Find. Write. Send. Listen. The video *is* the pipeline, shown in real UI in order; the proof is that every screen is a real product surface with real copy.
- Hook: a search field types `dentists` · `Austin, TX` and clicks Find — instantly legible input, makes the viewer want the output.
- Outro / punchline: KPI tiles (51% open · 13% reply · 0 templates used) → logo mark + wordmark + "Every email different. Every one from you." → URL.
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals (particles, 3D blobs, stock imagery)
  - Redesigning the product's look — use its real palette, font, and component shapes
  - Any invented metric presented as a company stat (the KPI tile numbers are illustrative campaign figures, consistent with the product's own sample UI)

## Visual Identity
- Background: `#f7f7f8` app canvas; `#ffffff` cards; `#09090b` for the closing card
- Text: `#18181b` primary, `#71717a` secondary, `#a1a1aa` muted
- Accent: gradient `#2563eb` → `#7c3aed`; support emerald `#0e9f6e`, amber `#d97706`
- Display font: Geist (loaded via Google Fonts; fallback Inter/system-ui)
- Body font: Geist; Geist Mono for data/badges
- Visual references from the project: rounded 12–16px cards with `#e4e4e7`-ish hairline borders and soft shadows; pill badges; the open-ring logo mark with the escaping message dot; the dark CTA band

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. **Hook: the query** — 3.5s — search row types `dentists` / `Austin, TX`, cursor clicks `Find leads`
2. **The leads land** — 5s — meta line `18 found · 14 with email…` + three result rows arrive one by one with green email badges (one `★ owner found`, one `WordPress` chip)
3. **The AI writes it** — 5.5s — subject `Fewer no-shows for Bright Smile`, body types in with two blue-highlighted personalization phrases, then `✓ 0 spam-filter flags` + `Written by AI · 96 words` chips snap in
4. **Sends safely, replies sorted** — 5s — campaign progress to 62% with `12 / hour` + `09:00–17:00`, follow-up flips to `stopped — replied ✓`, then reply card with `● interested` + `✨ Suggested reply`
5. **Numbers, then the name** — 3s — three KPI tiles snap in, crossfade to dark closing card: logo mark, wordmark, tagline, URL

## Audio
- Audio role: warm professional bed with sparse, motion-matched accents
- Audio arc: bed enters low under the typed hook → natural lift as leads land → steady through the AI beat → resolves under the reply → final lift on the KPI tiles → fades to near-silence for the closing line
- Music: `assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (114.84 BPM), volume ~0.22, 0.4s fade-in, fade out across the final ~1.2s
- Music cue guidance (timing hints only, readability wins): strong cues at **4.23s** (first lead row), **10.54s** (spam-flag chip), **16.34s** (KPI tiles); beat grid ~0.53s for the three-row sequence (`5.28 / 5.80 / 6.34`)
- Audio-reactive treatment: subtle at most — no waveforms, no pulsing, nothing that harms readability
- SFX (already copied into `assets/`): `sfx/keyboard/keypress-001|003|005.wav` (typing), `sfx/interface/click_001.ogg` (Find click), `sfx/interface/switch_002.ogg` or `drop_002.ogg` (lead-row ticks), `sfx/interface/select_008.ogg` or `bong_001.ogg` (spam-flag chip), one soft accent on the reply pill. Volumes low (0.2–0.35).
- Audio-coupled moments: typed query, Find click, three lead rows arriving, spam-flag chip, KPI tiles
- Restraint rule: no whooshes/risers/impacts on text; nothing on the logo (silence is the outro). If a sound doesn't map to a real on-screen interaction, it doesn't exist.

## Technical constraints (from hyperframes-core)
- Standalone root in `<body>`, no `<template>`; root `data-composition-id="main"` with `data-start`, `data-width="1920"`, `data-height="1080"`, `data-duration="22"`
- Exactly one `gsap.timeline({ paused: true })` registered at `window.__timelines["main"]`, built synchronously
- Scene sections use `class="clip"` with `data-start` / `data-duration` / `data-track-index`; never `gsap.set` a clip element at load — use `tl.set(...)` at/after that clip's `data-start`
- Animate only the allowlist (opacity, x, y, scale, rotation, color, backgroundColor, borderRadius, transforms); no `display`/raw `visibility` tweens
- Full-bleed scene fills go on an absolute inset child, never the root; unique ids page-wide; no `<br>` in body text; transformed elements block-level + sized; no `repeat: -1`
- Tailwind v4 browser runtime is scaffolded — theme via `@theme` in a `text/tailwindcss` block, no v3 config file
- Gate: `npx hyperframes check` → 0 findings before render
