# LCDB Top-Notch Agent Playbook

## Purpose

Use this file as the default operating contract for this project so work stays consistent, fast, and on-track.

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

