# Pending Points (Updated: 2026-02-27)
## Client-Promised Pending (Must Track)

- [x] Default site language must remain French (`fr`) on first load.
- [x] Translation with review workflow (admin-side): automatic translation + human review/approve before publish.
- [x] Per-language publish control: formal draft/publish workflow by language.
- [x] Print-friendly recipe card finishing for new block-rendered recipes.
- [ ] Final performance sign-off with Lighthouse + real-device metrics (LCP/CLS/FCP).

## Recipe Builder UX Audit (Client Notion/PDF) - Phase Plan

### Status Snapshot

- Phase 1 status: `DONE`
- Phase 2 status: `DONE`
- Phase 3 status: `DONE`

### What Is Already Done

- [x] One-page recipe-first article editor flow is implemented.
- [x] Top header area now surfaces:
- [x] title
- [x] slug
- [x] excerpt
- [x] featured image
- [x] author
- [x] language
- [x] categories
- [x] tags
- [x] Recipe builder is no longer hidden behind a separate article tab flow.
- [x] Quick Info section is improved.
- [x] Ingredient paste/import helper is added.
- [x] Steps section is improved.
- [x] Ingredient/step row labels are added for clearer long-form editing.
- [x] Nutrition section is improved.
- [x] Visual progress/completion guidance is added.
- [x] Inline slug edit UX is added under the title.
- [x] Recipe builder now auto-prepares a single main recipe by default for new articles.
- [x] Optional sections are now collapsible:
- [x] article content
- [x] tips & personal notes
- [x] SEO
- [x] publication/workflow
- [x] supporting media/legacy fields
- [x] Auto-generated fields/hooks are working:
- [x] slug from title
- [x] SEO title from title
- [x] SEO description from excerpt
- [x] calories per serving
- [x] servings label fallback

### What Is Still Pending Next (Validation / Review Only)

- [x] Recipe builder nested validation merge fix applied for partial edit payloads (filled ingredients/steps/servings no longer fail incorrectly).
- [x] Recipe builder QA on staging end-to-end
- [ ] Client review pass on the new Payload article editor UX

### Phase Meaning

- `DONE` = fully finished for current scope
- `PARTIAL` = some important work done, but phase still has pending items
- `PENDING` = not started yet

### Phase 1 - Critical UX Restructure (P1)

- [x] RB-01: Replace 5-tab article editor flow with one-page vertical "Recipe-first" layout in Payload Admin.
- [x] RB-02: Remove "Recipe Blocks -> Add Recipe Card" dependency from author flow; expose core recipe fields directly.
- [x] RB-03: Move essential metadata into top header area:
- [x] title, inline slug (editable), short excerpt
- [x] featured image
- [x] author, language, categories, tags
- [x] RB-04: Keep recipe creation possible from one continuous screen without cross-tab switching.

### Phase 2 - Major Productivity + Data Entry UX (P2)

- [x] RB-05: Build compact "Quick Info" section:
- [x] prep time, cook time, servings, difficulty
- [x] type, dish, cuisine
- [x] RB-06: Convert ingredients UI to compact table layout (ingredient/qty/unit) with drag reorder controls.
- [x] RB-07: Add optional "Paste from text" helper for ingredients import (fast entry mode).
- [x] RB-08: Improve steps UI:
- [x] clearly numbered step cards
- [x] always-visible instruction textarea
- [x] optional photo + caption inline
- [x] drag reorder support
- [x] RB-09: Convert nutrition UI to compact 4x2 grid in collapsible section.

### Phase 3 - Automation + Finish (P3)

- [x] RB-10: Add auto-generated fields/hooks:
- [x] slug from title (kebab-case)
- [x] SEO title/description defaults from title + excerpt
- [x] calories per serving from total calories / servings
- [x] servings display label from servings count
- [x] RB-11: Convert optional/advanced areas to collapsible groups:
- [x] article content (optional rich text)
- [x] tips & personal notes
- [x] SEO
- [x] publication (date, original link, ready for publication)
- [x] RB-12: Add inline slug edit UX (compact under title) and reduce permanent slug field footprint.
- [x] RB-13: Add basic visual progress guidance (section-level completion indicator).
- [x] RB-14: Add ingredient paste/import helper for faster recipe entry.
- [x] RB-15: Reduce remaining Recipe Block friction while preserving current frontend-compatible storage shape.

### Delivery + QA Gate

- [x] RB-QA-01: Validate "new recipe create -> save draft -> publish" full flow on staging.
- [x] RB-QA-02: Confirm no regression on existing frontend recipe rendering (ingredients, steps with photos, compact recipe card).
- [x] RB-QA-03: Confirm mobile/desktop editor usability for long recipes.

## Homepage Performance Pending

- [ ] Reduce homepage initial render payload.
- [ ] Lower `HOME_INITIAL_RENDER_COUNT` (current default `48` -> target `12`).
- [ ] Lower `SUGGESTED_INITIAL_RENDER_COUNT` (current default `30` -> target `8`).
- [x] Defer workshops live API hydration with viewport trigger (`IntersectionObserver`) instead of immediate first-load execution.
- [x] Reduce translation overhead on first paint.
- [x] Skip initial full-page `changeLanguage(...)` run when saved language equals source/default language.
- [x] Improve homepage image delivery without crop regression.
- [ ] Add/validate `srcset + sizes`, keep portrait-safe rendering, keep only true LCP image as high priority. (`sizes` + priority cleanup done; no explicit `srcset` layer added yet)
- [x] Add below-the-fold render deferral (`content-visibility: auto` with intrinsic size hints) on heavy homepage sections.

## QA Pending

- [x] Validate post-change homepage UX on mobile + desktop:
- [x] no portrait crop regression
- [x] no filter/pagination regression
- [x] no workshop data regression
- [x] no translation dropdown regression
- [x] Create 1 new recipe end-to-end from Payload Admin and verify dual-render output on staging.
- [x] Confirm step image quality and automatic sizing behavior on mobile + desktop.
- [x] Staging QA: translation flow (auto-translate -> review approve -> publish block/unblock) with one non-French article.

## On Hold

- [ ] Full multi-language cache generation + production/staging QA (paused for new client requirement).
- [ ] Any further translation architecture changes until client confirms resume.

## Carry-Forward Backlog (On Hold from Legacy Tracker)

- [ ] Frontend: confirm form provider + integrate (Typeform or open-source).
- [ ] Content: export category pages (sale, sucre, voyage), then import JSON and map links to local slugs.
- [ ] Content: export author pages, confirm author list, then import.
- [ ] Content: import selection page HTML (`src/content/static-pages/selection.html` currently missing).
- [ ] Content: import reportages page HTML (`src/content/static-pages/reportages.html` currently empty).
- [ ] Ads/Analytics: Mediavine integration (global async script in layout).
- [ ] Ads/Analytics: staging validation after Mediavine (ads load, no console errors).
- [ ] Ads/Analytics: `ads.txt` / privacy / GDPR checks on staging.
- [ ] Payload: migrate/backfill existing legacy articles to new V2 editor schema (no data loss, with frontend parity).
- [ ] ContentV2: build legacy migration tool (dry-run + batch + rollback logs).
- [ ] ContentV2: add migration safety fields (`migrationStatus`, `migrationNotes`, `legacySnapshot`).
- [ ] ContentV2: migration QA workflow (legacy vs V2 + JSON-LD parity).
