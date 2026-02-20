# LCDB Top-Notch Agent Playbook

## Purpose

Use this file as the default operating contract for this project so work stays consistent, fast, and on-track.

## Latest Session Context (2026-02-20)

- Article page related section (`You might like`) is intentionally disabled for now in `src/pages/[slug].astro`.
- Home article build limits were normalized to avoid accidental 50-item fallback:
- default fallback now aligns to high-cap flow (`6000`) across article/page builders.
- Homepage image source handling no longer forces square `-500x500` variants.
- Hero slider image behavior:
- slider cards use `object-cover` to avoid top empty strips.
- Home recipe grid (`D&eacute;couvrez mes recettes`) now uses progressive hydration:
- initial SSR render count is limited (`HOME_INITIAL_RENDER_COUNT`, default 48),
- remaining cards are appended client-side from `/search-index.json`,
- pagination/filter state recalculates after hydration.
- Suggested recipes section (`Ces recettes pourrez vous int&eacute;resser`) now uses same progressive hydration model:
- initial SSR render count (`SUGGESTED_INITIAL_RENDER_COUNT`, default 30),
- client-side hydration from `/search-index.json` with `offset={10}`,
- pagination/filter recalculation after hydration.
- Project tracker must remain updated in `TODO-ISR.md` after significant behavior changes.

## Current Project Truth (Must Hold)

- Frontend stack is Astro; production output is static-first with prepared snapshot flow.
- Do not re-introduce Sanity/Vercel-based runtime dependencies for current requested flow.
- Translation calls must use configured endpoint from env and must be valid HTTPS in browser context.
- Search is Algolia-backed and should remain language-scoped to current selected language.
- Search/result routes should use direct slug paths (no forced `/articles/` prefix where removed).
- Mobile header search behavior:
- icon click opens inline search field first
- navigation to `/search` happens on submit

## Non-Regression Guardrails

- Keep Algolia hit parsing resilient:
- title fallbacks and image fallbacks must handle multiple field shapes
- Keep language filtering strict (`current language only`).
- Keep translation logic protected from infinite retry loops.
- Avoid mixed-content and invalid-cert endpoint usage in browser fetch paths.
- Keep indexing source aligned with `prepared-articles.json` flow when configured.

## Working Style

- Execute first, explain second.
- Prefer focused patches over broad rewrites.
- For each task:
- identify affected files
- implement
- run targeted verification
- report exactly what changed
- Never do destructive git reset/checkout without explicit request.

## Definition Of Done

- Feature/fix implemented.
- No obvious regression in related flow.
- Relevant command checks run (or clearly reported why not run).
- Tracking updated in `TODO-ISR.md` when change impacts ongoing project state.

## Quick Verify Commands

```bash
npm run build
npm run index:algolia
```

Use targeted checks first when possible, full build before final handoff for major changes.

## Task Intake Rule

When a new task comes, resolve it against:

1. `TODO-ISR.md` for live project status
2. `chat-exports/important-chats-index.md` for imported context
3. This file for guardrails

If conflict appears, latest explicit user instruction wins.
