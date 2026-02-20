# LCDB Tracker + Chat Summary (Updated: 2026-02-20)

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
