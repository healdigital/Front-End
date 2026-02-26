# Pending Points (Updated: 2026-02-26)
## Client-Promised Pending (Must Track)

- [x] Default site language must remain French (`fr`) on first load.
- [x] Translation with review workflow (admin-side): automatic translation + human review/approve before publish.
- [x] Per-language publish control: formal draft/publish workflow by language.
- [x] Print-friendly recipe card finishing for new block-rendered recipes.
- [ ] Final performance sign-off with Lighthouse + real-device metrics (LCP/CLS/FCP).

## Homepage Performance Pending

- [ ] Reduce homepage initial render payload.
- [ ] Lower `HOME_INITIAL_RENDER_COUNT` (current default `48` -> target `12`).
- [ ] Lower `SUGGESTED_INITIAL_RENDER_COUNT` (current default `30` -> target `8`).
- [ ] Defer workshops live API hydration with viewport trigger (`IntersectionObserver`) instead of immediate first-load execution.
- [ ] Reduce translation overhead on first paint.
- [ ] Skip initial full-page `changeLanguage(...)` run when saved language equals source/default language.
- [ ] Improve homepage image delivery without crop regression.
- [ ] Add/validate `srcset + sizes`, keep portrait-safe rendering, keep only true LCP image as high priority.
- [ ] Add below-the-fold render deferral (`content-visibility: auto` with intrinsic size hints) on heavy homepage sections.

## QA Pending

- [ ] Validate post-change homepage UX on mobile + desktop:
- [ ] no portrait crop regression
- [ ] no filter/pagination regression
- [ ] no workshop data regression
- [ ] no translation dropdown regression
- [ ] Create 1 new recipe end-to-end from Payload Admin and verify dual-render output on staging.
- [ ] Confirm step image quality and automatic sizing behavior on mobile + desktop.
- [ ] Staging QA: translation flow (auto-translate -> review approve -> publish block/unblock) with one non-French article.

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
