# LCDB Transcript-Style Summary (2026-03-08)

## Purpose

This file is a higher-detail chronological summary of the project chat history. It is intended for bootstrapping a new chat with minimal context loss.

Use this together with:

- `CHAT-HANDOFF-2026-03-08.md`
- `CHAT-EXPORT-FULL-2026-03-08.md`
- `PENDING-POINTS.md`
- `TODO-ISR.md`

## Chronological Summary

### Early front-end and translation phase

- Header language selector was requested, added, then partially lost and restored.
- Mixed-content / SSL / endpoint issues affected translation.
- Translation loops and repeated API calls were debugged multiple times.
- Search URLs were normalized to remove `/articles/` prefix from result links.
- Mobile search behavior was changed to match desktop-style flow.
- Search indexing and language-scoped search behavior were hardened.

### Search / Algolia / indexing

- Algolia indexing was adjusted to prefer `prepared-articles.json`.
- Reindexing was run successfully.
- Search result rendering was hardened against field-shape mismatches.
- Search page 404 flow and trailing-slash handling were fixed.

### Homepage design / image / article list work

- Homepage sections, spacing, cards, image behavior, and several design parity items were refined.
- Image source handling was updated repeatedly to avoid square/cropped variants.
- Hero slider and portrait-safe rendering were tuned.
- The article cap regression on homepage was fixed.
- Progressive hydration for homepage recipe grid and suggested recipes was explored and then adjusted to match client behavior.

### Disqus / comments / workshops / section spacing

- Disqus integration issues were fixed and hardened.
- Workshop cards and sidebar workshop data were aligned with the live API.
- Workshop availability labels were improved.
- Equal spacing across homepage sections was adjusted.

### Performance / build / deploy work

- Build and deploy blockers were fixed across front-end and back-end multiple times.
- Secret/build-arg exposure was addressed earlier in the broader project flow.
- Homepage performance was improved, but certain experiments were reverted when they created regressions.
- Final Lighthouse sign-off metrics were captured and accepted.

### Payload admin / recipe builder audit implementation

- Client shared a Notion/PDF recipe builder UX audit.
- Requirement was understood as a real recipe/editor UX rebuild, not small tweaks.
- Payload article editor was reworked into a one-page recipe-first flow.
- Top metadata was moved into a clearer header section.
- Quick info, ingredients, steps, and nutrition UX were improved.
- Ingredient import helper and inline slug editor were added.
- Progress/completion guidance was added.
- Publication workflow and translation review flow were integrated into the editor.
- Validation issues with partial nested payloads were fixed.
- QA was completed.
- Client review pass was treated as done.

### Translation review / publish workflow

- Translation review workflow was implemented for non-French variants.
- Publish blocking behavior was enforced until translation review approval.
- Auto-translation and review metadata were wired into article save flow.
- Further translation architecture changes were later put on hold.

### Homepage performance finalization

- Translation overhead on first paint was reduced.
- Workshops hydration was deferred appropriately.
- Image delivery was tuned while preserving portrait-safe rendering.
- Delayed pagination experiments were tried, partially reverted, then stabilized.
- Homepage pagination was restored and made to work correctly for both:
- `Découvrez mes recettes`
- `Ces recettes pourrez vous intéresser`
- Final accepted behavior:
- pagination works
- images work
- site performance is acceptable

### Legacy migration exploration

- After front-end and editor work stabilized, legacy article migration to V2 schema was explored.
- Migration safety fields were added temporarily.
- Migration audit, prepare, convert, and featured-media import scripts were built temporarily.
- Dry-run and some safe local/data tests were run.
- It was confirmed that most legacy articles are HTML-heavy and image-heavy.
- Proper `featuredMedia` relations are largely missing in legacy data.
- The client later said this work is not needed right now.
- All migration-related backend code was reverted from the repository.
- Migration remains on hold.

### Final accepted state at end of chat

- Front-end current delivery scope: done
- Payload recipe builder / editor UX scope: done
- Lighthouse sign-off: done
- Legacy migration: on hold
- No active delivery pending items remain

### Recent updates (2026-03-17)

- Fixed Payload Admin preview build failure by ensuring legacy HTML preview always passes a string to `stripHtml()`.
- Updated preview so `Short Excerpt` and `Legacy Content (Read-only HTML)` display clean UTF‑8 text (HTML tags are stripped and entities decoded).
- Updated article editor UX so the **Editor Progress** widget is hidden when a featured image is attached (handled via a conditional class + CSS rule).

## Final Accepted Metrics

- Mobile Performance: `71`
- Desktop Performance: `89`
- Accessibility: `89 / 90`
- Best Practices: `88 / 92`
- SEO: `92 / 92`

## Current Pending Classification

### Active pending

- None

### On hold

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

## Hard Rules To Preserve In Future Chats

- Keep articles and search `PURE SSG`
- Workshops may remain API-driven
- Do not break homepage pagination for the sake of performance experiments
- Preserve portrait-safe image behavior
- Do not re-open legacy migration work unless explicitly requested

## Known Stable Restore Points

- Front-End tag: `stable-2026-03-02-fe`
- Back-End tag: `stable-2026-03-02-be`

## Files To Read First In A New Chat

- `CHAT-HANDOFF-2026-03-08.md`
- `CHAT-EXPORT-FULL-2026-03-08.md`
- `CHAT-TRANSCRIPT-STYLE-SUMMARY-2026-03-08.md`
- `PENDING-POINTS.md`
- `TODO-ISR.md`
- `PROJECT-AGENT.md`
- `ROLLBACK-CHECKPOINTS.md`

## Caution

The following local files were known to be dirty/untracked and should not be blindly reverted:

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

## Resume Guidance

If a new chat starts, use this sequence:

1. Read `CHAT-HANDOFF-2026-03-08.md`
2. Read `PENDING-POINTS.md`
3. Read `TODO-ISR.md`
4. Use this file only for extra historical detail

If the client resumes legacy migration later:

1. restart locally
2. do not begin with live destructive changes
3. validate legacy media mapping first
4. then decide whether migration should re-enter active scope
