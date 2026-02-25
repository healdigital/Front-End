# LCDB Tracker + Chat Summary (Updated: 2026-02-25)

## Session Update (2026-02-25 New Recipe Builder Scope - Front-End + Payload Admin)

- [x] Scope confirmed: implement on existing `Front-End` + `payload-admin` only (no separate new website build).
- [x] Payload recipe builder upgraded for new recipes (`recipeCard` block):
- [x] recipe family/type (`Savory` / `Sweet` / `Other`)
- [x] dish type + cuisine fields
- [x] step-level optional photo + caption support
- [x] nutrition group (calories/protein/carbs/fat/fiber/sugar/sodium)
- [x] Publication checklist hardened: recipe step images now enforce Media alt text when `readyForPublication=true`.
- [x] Front-end article rendering now uses one recipe source to generate:
- [x] Block 1: Ingredients
- [x] Block 2: Steps with photos
- [x] Block 3: Compact recipe card (steps without photos, nutrition included)
- [x] Homepage recipe meta tags normalized to `SWEET`/`SAVORY`/`RECIPE` labels.
- [x] Search-index generation extended to include recipe block prep time and recipe-type hints for hydrated cards.
- [ ] Pending QA: create 1 new recipe end-to-end from Payload Admin and verify dual-render output on staging.
- [ ] Pending QA: confirm step image quality and automatic sizing behavior on mobile + desktop.
- [ ] Pending QA: client validation for automatic translation + review workflow expectation (functional/UX decision still open).

## Session Update (2026-02-25 Translation Cache + Hold)

- [x] Front-End translation reliability upgrade pushed to `main`:
- [x] `dda532f` - static translation cache pipeline + chunked runtime fallback + cache-only mode support.
- [x] Added `build:translation-cache` script and integrated auto-run in build flow when `PUBLIC_TRANSLATE_CACHE_ONLY=1`.
- [x] Added static cache artifact path handling for deploy output (`dist/translation-cache.json`) and source copy (`public/translation-cache.json`).
- [x] Added runtime warning when cache-only mode is enabled but cache file has no entries.
- [x] Payload Admin `main` verified up-to-date at `dd1ca6c` (no new backend commit required in this step).
- [ ] On Hold: full multi-language cache generation + production/staging QA (paused for new client requirement).
- [ ] On Hold: any further translation architecture changes until client confirms resume.

## Session Update (2026-02-24 Translator Final Fix)

- [x] Fixed language dropdown behavior where API was not being hit on select.
- [x] Header language option click now directly triggers translation change flow (no dependency on bubbling-only handler).
- [x] Added translation endpoint fallback chain in runtime:
- [x] `PUBLIC_TRANSLATE_API_URL`
- [x] `PUBLIC_PAYLOAD_API_URL`
- [x] `/api` in dev
- [x] hard fallback `https://admin.lacuisinedebernard.com/api`
- [x] Added automatic failover between configured translation endpoints on network/status failures.
- [x] Front-End pushed to `main`:
- [x] `43342fd` - language dropdown trigger + translation endpoint failover hardening
- [x] Staging confirmation received: translation is now working fine.

## Session Update (2026-02-24 Search + Translation Hotfix)

- [x] Fixed search page 404 flow by enforcing trailing-slash search routes across entry points (`/search/` and `/search/?q=...`).
- [x] Updated all search launch points to the same route format:
- [x] Header search submit
- [x] Mobile header search submit
- [x] Global sidebar search submit
- [x] Shared `SearchField` submit
- [x] Search results link generation hardened for static hosting:
- [x] normalize `/articles/...` to direct slug path
- [x] ensure trailing slash for article links (`/${slug}/`)
- [x] preserve query/hash for absolute URL hits after normalization
- [x] Translation runtime hardened for full-page selected language behavior:
- [x] Added MutationObserver-based translation for dynamically injected/hydrated DOM blocks.
- [x] Added transient failure tolerance (consecutive failure threshold) to avoid immediate disable.
- [x] Kept hard-disable only for hard endpoint/config cases (`401/403/404`, invalid cert).
- [x] Removed stale session disable behavior that could keep translation stuck after earlier endpoint failures.
- [x] Front-End pushed to `main`:
- [x] `3de9b77` - search 404 hotfix + full-page translation hardening
- [x] Build smoke test passed after hotfix (`npx astro build` with lightweight env knobs).

## Session Update (2026-02-24 Late)

- [x] Homepage recipe cards now use real meta tag + real time values (placeholder `A VENIR • --` removed).
- [x] Workshop users row now shows remaining places (replaced `X personnes maximum`) across:
- [x] home featured workshop block
- [x] home workshop cards grid
- [x] sidebar workshop card
- [x] Front-End pushed to `main`:
- [x] `4769a22` - real recipe tag/time + remaining places labels
- [x] Snapshot workflow queue behavior was changed to avoid dropped updates on rapid Payload edits (`cancel-in-progress: false`).
- [x] Front-End pushed to `main`:
- [x] `1f4e28b` - process all snapshot runs without auto-cancel
- [x] Back-End webhook payload was hardened for article updates/deletes with explicit batch keys:
- [x] `articleIds`, `articleSlugs`, `articleDeleteIds`, `articleDeleteSlugs`
- [x] Back-End pushed to both branches:
- [x] `4a6413c` on `master`
- [x] same commit pushed to `main`
- [x] QA on staging: confirm recipe cards no longer show placeholders and now render real tag + real time.
- [x] QA on staging: confirm remaining places label is correct on all workshop UI surfaces.
- [x] QA on staging: perform multiple rapid Payload edits and verify `Payload Update Snapshot` runs all queued executions (no dropped updates). (Confirmed working)
- [x] QA on staging: verify `Deploy Frontend` button deploys using latest snapshot state after batch edits. (Confirmed in current flow)

## Rollback Update (2026-02-24 Night)

- [x] Reverted Front-End snapshot queue change due regression risk in current flow.
- [x] Front-End pushed to `main`:
- [x] `9955906` - revert `1f4e28b` (`cancel-in-progress` behavior restored to previous state)
- [x] Reverted Back-End article webhook extra batch payload change.
- [x] Back-End pushed to both branches:
- [x] `68a7a53` on `master`
- [x] same commit pushed to `main`
- [x] System returned to previously working update/add/delete behavior baseline.

## Session Update (2026-02-24)

- [x] Payload Admin auto deploy model moved to manual-first flow.
- [x] Added env-gated auto trigger control in Back-End (`AUTO_DEPLOY_ON_CHANGE=false` default path for manual workflow).
- [x] Added secure manual deploy trigger endpoint (admin-auth only): `POST /api/deploy-frontend`.
- [x] Added deploy status endpoint (admin-auth only): `GET /api/deploy-frontend/status`.
- [x] Added request tracking metadata (`requestId`, `startedAt`) in deploy trigger response.
- [x] Added GitHub Actions monitor service for repository-dispatch runs:
- [x] workflow run detection
- [x] jobs + step status aggregation
- [x] progress percentage computation
- [x] active job log tail retrieval
- [x] Added dedicated admin deploy monitor route: `/admin/deploy-frontend`.
- [x] Deploy monitor UI now shows:
- [x] trigger button
- [x] queued/running/completed state
- [x] progress bar + counters
- [x] jobs and step-level statuses
- [x] live logs panel
- [x] Dashboard `Deploy Frontend` card now redirects to monitor page with auto-trigger (`?auto=1`).
- [x] Sidebar nav now includes `Deploy Frontend` access (easy discoverability for admin users).
- [x] Back-End pushed to remote:
- [x] `36f72ab` pushed to `master`
- [x] same commit pushed to `main`
- [x] QA on staging: validate monitor shows correct run for each trigger under normal queue delay.
- [x] QA on staging: validate token permissions include Actions read for log/progress visibility. (Inferred from successful deploy monitoring + correct reflected changes)

## In Progress Now (2026-02-23)

- [x] Workshops source switched to production endpoint: `https://lacuisinedebernard.com/api/workshops-cache`.
- [x] Homepage workshops now API-driven (no dummy fallback), including booking URL/image/price/capacity/duration/status mapping.
- [x] Sidebar workshop card now hydrates from workshops API (same endpoint chain as homepage).
- [x] Front-End endpoint alignment committed and pushed (`fb28bd3` on `lcdb-dev/Front-End main`).
- [x] Back-End Docker deploy issues resolved (lock mismatch, missing `/public`, healthcheck tooling) and pushed (`69cd1cc` on `lcdb-dev/Back-End main/master`).
- [x] Latest Back-End deploy is healthy (container passed healthcheck, rolling update completed).
- [x] Latest Front-End deploy is healthy (custom Docker healthcheck passed, rolling update completed).
- [x] Secret build args for critical vars no longer present in latest deploy logs (`DEEPL_API_KEY`, `PAYLOAD_SECRET`, `DATABASE_URL`, `GITHUB_DISPATCH_TOKEN`).
- [x] Ops follow-up: no secret values currently visible in build logs for tracked keys; continue monitoring.
- [x] Optional cleanup: remove build-time Mongo warning (`MONGODB_URI not found`) from Front-End logs by ensuring intended build env mode. (Deferred by request)

## Session Update (2026-02-23 Evening)

- [x] Homepage workshops availability labels now show live numeric spots (e.g., `5 places disponibles`) instead of generic text.
- [x] Workshops availability logic aligned across all surfaces:
- [x] Homepage featured workshop block (SSR + client hydration)
- [x] Homepage workshop cards grid
- [x] Recipe sidebar workshop card
- [x] Full/limited states translated and normalized (`Complet`, `Dernieres places`, numeric available spots).
- [x] Homepage vertical spacing normalized with equal section rhythm and consistent gaps between major blocks.
- [x] Embedded section padding conflicts removed (Bio / Featured Masterclass / Suggested / Books embedded spacing alignment).
- [x] Disqus fallback hardening shipped:
- [x] Added shortname fallback chain (`PUBLIC_DISQUS_SHORTNAME` -> `DISQUS_SHORTNAME` -> `lcdb`)
- [x] Added robust identifier fallback from URL path when identifier is missing/empty
- [x] `Disqus is not configured.` false-negative risk reduced for env mismatch cases
- [x] Front-End pushed to `main`:
- [x] `a24ee58` - workshop availability + homepage spacing updates
- [x] `72490ed` - Disqus config/identifier fallback fix
- [x] Tomorrow QA: verify Disqus thread renders correctly on both article route variants (`/[slug]` and `/articles/[slug]`) on staging.
- [x] Tomorrow QA: visual check for equal spacing on homepage (desktop + mobile) after live deploy.

## Completed Today (2026-02-23)

- [x] Introduced reusable non-home page design system classes in `src/styles/global.css` (`lcdb-page-*`, `lcdb-surface-card`, `lcdb-article-card`, shared pagination/empty-state utilities).
- [x] Redesigned shared static page wrapper in `src/components/StaticPage.astro` to match landing page visual language (hero strip + panel content surface + typography updates).
- [x] Refreshed direct article detail route `src/pages/[slug].astro` with landing-style layout while preserving SEO JSON-LD, translation lang handling, Disqus identifier logic, and ad slots.
- [x] Aligned archive/search/list routes to landing style:
- [x] `src/pages/search.astro`
- [x] `src/pages/articles/index.astro`
- [x] `src/pages/articles/[page].astro`
- [x] `src/pages/categories/index.astro`
- [x] `src/pages/categories/[slug].astro`
- [x] `src/pages/tags/index.astro`
- [x] `src/pages/tags/[slug].astro`
- [x] Updated `src/pages/articles/[slug].astro` visual shell for consistency with non-home page theme.
- [x] Validation run completed with fast static build smoke test:
- [x] `MAX_SSG_ARTICLES=20 BUILD_ONLY_ARTICLE_PAGES=1 BUILD_DISABLE_SEARCH=1 USE_LOCAL_JSON=1 npx astro build` (successful).

## Completed Today (2026-02-20)

- [x] Temporarily disabled `You might like` related section and related fetch/call on article page (`src/pages/[slug].astro`).
- [x] Fixed homepage image source handling to avoid forced square `-500x500` variant and use real/original image URL.
- [x] Updated homepage image rendering for portrait-safe behavior in key recipe cards and featured blocks.
- [x] Corrected hero slider image presentation to fill card correctly after portrait handling adjustments.
- [x] Fixed article build-limit fallback regression (`50 -> 6000`) across article/static path files and Mongo helper.
- [x] Restored full article availability for `D&eacute;couvrez mes recettes` on home (no 48 hard cap).
- [x] Implemented progressive hydration for home recipe grid:
- [x] Initial lightweight render first.
- [x] Remaining recipes loaded after page load from `/search-index.json`.
- [x] Pagination and filters auto-update after hydration.
- [x] Fixed `Ces recettes pourrez vous int&eacute;resser` cap (previous slice limiting around ~30).
- [x] Implemented progressive hydration for suggested-recipes section as well:
- [x] Initial lightweight render first.
- [x] Remaining recipes loaded after page load from `/search-index.json` with offset.
- [x] Pagination and filters auto-update after hydration.
- [x] Build verification completed after each major change (`npm run build` successful).

## Completed (Shipped)

- [x] Responsive UI updates completed for both desktop and mobile layouts.
- [x] Header language dropdown added with selectable languages.
- [x] Header language option text styling updated for readability (white text in dropdown context).
- [x] Re-added missing language/translation related code after accidental deletion.
- [x] Fixed Astro compile error caused by merge conflict markers in `src/pages/index.astro`.
- [x] Search result URL normalized to remove `/articles/` prefix and use direct slug path (`/${slug}`).
- [x] Breadcrumb/search path handling aligned so `articles` segment does not appear.
- [x] Mobile header search updated: icon opens inline header search first, then navigates to `/search` on submit (desktop-like flow).
- [x] Translation client flow hardened to avoid infinite retry/request loops.
- [x] Removed Sanity-specific/unused translation flow from active implementation.
- [x] Removed Vercel-specific translation dependency from active implementation.
- [x] Environment-driven translation endpoint usage aligned with `.env`.
- [x] Algolia search language behavior updated to current language only.
- [x] Search hit language compatibility fixed (`hit.language` or `hit.lang`).
- [x] Algolia indexing script updated to prefer local `prepared-articles.json`.
- [x] Algolia client compatibility fixed for newer API style (`setSettings`, `saveObjects`) with fallback.
- [x] Reindex command executed successfully on 2026-02-19.
- [x] Pushed current branch state without pull, as requested.
- [x] Added persistent project agent docs: `PROJECT-AGENT.md` + `TASK-BRIEF.md`.

## Historical Completed Baseline

- [x] Pure SSG Astro build (`output: 'static'`).
- [x] Payload webhook -> GitHub Action (`payload-update`) -> Coolify deploy.
- [x] Prepared snapshot moved off Git LFS (no LFS budget issues).
- [x] Snapshot stored as GitHub Release (`prepared-snapshot`).
- [x] Build downloads snapshot via `PREPARED_JSON_URL`.
- [x] Build uses JSON only (`USE_LOCAL_JSON=1`, `BUILD_ONLY_ARTICLE_PAGES=1`).
- [x] Snapshot update uses ID/slug/title matching; snapshot includes `id` + `_id`.
- [x] Disqus comments integrated (replaced Giscus).
- [x] Translation endpoint integration added in frontend flow.
- [x] Author/meta display hidden via CSS (temporary).
- [x] Algolia indexing script + per-language search wiring.
- [x] Static pages created for header + footer links.
- [x] My Account footer link set to atelier-lacuisinedebernard.com.
- [x] Static page loader updated to read HTML from `src/content/static-pages` using absolute path.

## Reindex Run Log (2026-02-19)

Command:

```bash
npm run index:algolia
```

Result:

- [x] Source used: `prepared-articles.json` (4554 articles)
- [x] Indexed `lcdb_recipes_fr`: 1094
- [x] Indexed `lcdb_recipes_ar`: 956
- [x] Indexed `lcdb_recipes_pt_br`: 789
- [x] Indexed `lcdb_recipes_es`: 938
- [x] Indexed `lcdb_recipes_en`: 776
- [x] Indexed `lcdb_recipes_zh_hans`: 1
- [x] Status: indexing complete

## Important Notes

- Translation API calls from browser require valid HTTPS with trusted SSL certificate.
- If certificate is invalid, browser blocks request with `ERR_CERT_AUTHORITY_INVALID`.
- Build/index flow is confirmed to use prepared snapshot data when configured (`prepared-articles.json`), not direct Mongo fetch in that mode.

## Chat Summary (Till 2026-02-19)

1. Header language selector feature was requested and implemented with clickable language options.
2. Missing/deleted code was restored and language feature work was continued.
3. Code was pushed directly without pull, per instruction.
4. Merge conflict syntax in `index.astro` caused compiler error and was fixed.
5. Header language option styling and full-page translation expectations were reviewed and adjusted.
6. Clarification given that Sanity should not be used; Sanity-related usage was removed from active path.
7. Mixed-content and SSL certificate translation failures were investigated from network errors.
8. Search page slug URL behavior was fixed so `/articles/...` is removed from result links and breadcrumbs.
9. Translation infinite request loop issue was fixed in frontend behavior.
10. Mobile search UX was changed to desktop-like flow (open search input first, submit to navigate).
11. Algolia search was updated to show only current language content.
12. Reindexing was run, and source verification confirmed prepared snapshot usage.
13. Indexing script was improved for robust source selection and Algolia SDK compatibility.
14. Fresh index run completed successfully with all per-language counts logged.

## Imported Chat Summaries (Important)

### 1) `reply-to-greeting-task.md`

- Scope was expanded from greeting to a full design parity pass against `Webdesign`/Figma references.
- Major UI work tracked in that chat:
- Typography normalization (`Title/H2/Body/Caption`) across home/search/articles/category/tag templates.
- Hero (`A la une`) controls and badge placement corrected (desktop + mobile behavior updates).
- Homepage section alignment improved (left content flow, sidebar structure/order, spacing, and card proportions).
- Search page bug fixed where Algolia results were showing tags/links but not reliable title/image rendering.
- Algolia field-shape handling was hardened for multiple key variants (e.g., title/image from alternative fields).
- Build/compile blockers were iteratively fixed in that thread (route `getStaticPaths` scope issues and `BioSection` compiler break).
- Design-specific requests tracked there:
- Portrait image treatment.
- Section-level parity for `Bernard...`, `Mes livres...`, dark section color/visibility, and vector/texture usage from `Webdesign` assets.

### 2) `fix-undefined-featured-image-url.md`

- Core issue captured from logs: `featured_img_url` was `undefined` while image data existed in other fields.
- Main root-cause pattern from that context:
- Rendering/indexing logic depending on one image key is unsafe.
- Data can arrive under `featured_image_url`, `featured_image.url`, or related fallback shapes.
- Tracking takeaway for this project:
- Any card/search/article image resolver must keep fallback chain logic (not single-field only).
- Build/runtime log issues around image-field shape should be treated as data-shape mismatch first, not only missing content.

## Current Guardrails (Do Not Regress)

- Keep search result rendering resilient to Algolia field variants for both title and image.
- Keep language-scoped search behavior strict to current language only.
- Keep recipe/article URLs without `/articles/` prefix where direct slug routing is expected.
- Keep mobile search behavior desktop-like: open inline field first, navigate on submit.
- Keep translation flow free from infinite retry loops and avoid blocked mixed-content/cert-invalid endpoints.
- Keep indexing source aligned to `prepared-articles.json` flow when configured.

## Carry Forward Backlog (On Hold)

| Status | Area | Task | Notes |
| --- | --- | --- | --- |
| On Hold | Frontend | Confirm form provider + integrate | Typeform or open-source |
| On Hold | Content | Export category pages (sale, sucre, voyage) | Import JSON and map links to local slugs |
| On Hold | Content | Export author pages | Confirm author list + import |
| On Hold | Content | Import selection page HTML | `src/content/static-pages/selection.html` missing |
| On Hold | Content | Import reportages page HTML | `src/content/static-pages/reportages.html` is empty |
| On Hold | Ads/Analytics | Mediavine integration (global async script in layout) | Client requirement |
| On Hold | Ads/Analytics | Staging validation (ads load, no console errors) | After Mediavine |
| On Hold | Ads/Analytics | ads.txt / privacy / GDPR checks | Staging checks |
| On Hold | ContentV2 | Build legacy migration tool | Dry-run + batch + rollback logs |
| On Hold | ContentV2 | Add migration safety fields | `migrationStatus`, `migrationNotes`, `legacySnapshot` |
| On Hold | ContentV2 | Migration QA workflow | Legacy vs V2 + JSON-LD parity |
