# ISR + Build Status Tracker (Updated: 2026-02-16)

## Active (Client Requests)

| Status | Area | Task | Notes |
| --- | --- | --- | --- |
| Ready for QA | Design | Integrate `new-design` branch (selective merge, no generated artifacts) | Homepage uses new components + data mapping |
| Ready for QA | Search | Algolia search on `/search` with language-specific results | Run `npm run index:algolia` to populate indices |
| Done | Security | Remove leaked `Front` / `Front.pub` keys + ignore | Removed locally + added to `.gitignore` |

## On Hold

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

## Completed

- [x] Pure SSG Astro build (`output: 'static'`).
- [x] Payload webhook -> GitHub Action (`payload-update`) -> Coolify deploy.
- [x] Prepared snapshot moved off Git LFS (no LFS budget issues).
- [x] Snapshot stored as GitHub Release (`prepared-snapshot`).
- [x] Build downloads snapshot via `PREPARED_JSON_URL`.
- [x] Build uses JSON only (`USE_LOCAL_JSON=1`, `BUILD_ONLY_ARTICLE_PAGES=1`).
- [x] Snapshot update uses ID/slug/title matching; snapshot now includes `id` + `_id`.
- [x] Disqus comments integrated (replaced Giscus).
- [x] DeepL translation API working via Astro `/api/translate`.
- [x] Author/meta display hidden via CSS (temporary).
- [x] Algolia indexing script + per-language search wiring.
- [x] Static pages created for header + footer links.
- [x] My Account footer link set to atelier-lacuisinedebernard.com.
- [x] Static page loader updated to read HTML from `src/content/static-pages` using absolute path.
