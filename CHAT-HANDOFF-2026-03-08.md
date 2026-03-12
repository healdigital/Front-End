# LCDB Chat Handoff Summary (2026-03-08)

## Project Scope

- Repo: `lcdb-astro`
- Front-end: Astro static site
- Back-end/admin: `payload-admin`
- Articles and search are intended to remain `PURE SSG`
- Upcoming workshops are allowed to stay `API-driven`

## Current Stable State

- Front-end current delivery scope: done
- Payload recipe builder / article editor UX scope: done
- Lighthouse / performance sign-off captured: done
- Current active delivery pending: none

## Confirmed Completed

### Front-end

- Homepage, article pages, search, pagination, and image behavior are currently in a stable accepted state.
- Search works and uses direct slug-style article URLs.
- Homepage pagination is working for:
- `Découvrez mes recettes`
- `Ces recettes pourrez vous intéresser`
- Homepage image regressions and request-storm issues were fixed in the accepted flow.
- Performance sign-off captured:
- Mobile Performance: `71`
- Desktop Performance: `89`
- Accessibility: `89 / 90`
- Best Practices: `88 / 92`
- SEO: `92 / 92`

### Payload Admin / Recipe Builder

- One-page recipe-first editor flow implemented
- Inline slug editor implemented
- Progress/completion guidance implemented
- Ingredient paste/import helper implemented
- Steps / nutrition / quick-info UX improved
- Translation review workflow implemented
- Per-language publish control implemented
- Print-friendly recipe card support finished
- Staging QA completed
- Client review on new editor UX passed

## Current Pending Status

### Active Pending

- None

### On Hold

- Full multi-language cache generation + production/staging QA
- Further translation architecture changes until client confirms resume
- Payload legacy articles migration to V2 schema
- Legacy featured-media import / media-aware migration

### Backlog

- Form provider integration
- Category page export/import
- Author page export/import
- `selection.html` content import
- `reportages.html` content import
- Mediavine integration
- Ads/privacy/GDPR checks

## Legacy Migration Status

- Legacy migration was explored temporarily.
- Migration-related backend code was later reverted from the repo because client said it is not needed right now.
- Do not resume legacy migration unless client explicitly asks again.
- If resumed later, first step should be local-only testing, not live deployment.

## Important Working Rules

- Keep articles and search `PURE SSG`
- Do not move article/search rendering to SSR
- Upcoming workshops can remain API-driven
- Do not reduce homepage article availability in a way that breaks pagination expectations
- Preserve portrait-safe image behavior
- Do not break current homepage pagination flow
- Do not re-open legacy migration work unless client confirms

## Rollback / Restore Points

- Front-End stable tag: `stable-2026-03-02-fe`
- Back-End stable tag: `stable-2026-03-02-be`

## Files To Check First In A New Chat

- `PENDING-POINTS.md`
- `TODO-ISR.md`
- `PROJECT-AGENT.md`
- `TASK-BRIEF.md`
- `ROLLBACK-CHECKPOINTS.md`

## Known Local Dirty / Unrelated Files

These were intentionally not part of the accepted delivery work and should be handled carefully:

### Front-end local dirty/untracked

- `PENDING-POINTS.md`
- `TODO-ISR.md`
- `astro.config.mjs`
- `src/utils/decodeHtmlEntities.ts`
- `image/PENDING-POINTS/*`
- `tmp_notion_recipe_builder_audit.html`
- `tmp_recipe_builder_audit_clean.txt`
- `tmp_recipe_builder_audit_extract.txt`
- `tmp_recipe_builder_audit_extract.utf8.txt`

### Back-end local untracked

- `.next_stale/`
- `.next_stale_20260205-172249/`
- `admin.ini`
- `back.ini`

## If A New Chat Starts

Start from this assumption:

- current production/staging flow is stable
- active delivery work is complete
- only hold/backlog items remain

If client gives new work, first decide whether it belongs to:

1. hold items
2. backlog items
3. a brand-new feature/change

If client asks about legacy migration again, resume only with:

1. local-only testing
2. no live destructive writes first
3. media mapping validation before any real V2 migration
