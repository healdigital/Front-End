# ISR + Build Status Tracker (Updated: 2026-02-09)

## Next Tasks (Table)

| Status | Area | Task | Notes |
| --- | --- | --- | --- |
| Pending | Frontend | Create static pages: MY BOOKS, SAVORY (DIRTY), SUGAR, THE WORKSHOPS, VIDEOS, TRAVEL, NEWS REPORTS, SELECTIONS | Pages to be added on frontend |
| Pending | Frontend | Footer pages: Contact, Partnership, Legal Notices, GDPR | Static pages |
| Pending | Frontend | My Account link → `https://atelier-lacuisinedebernard.com/mon-compte/` | Update footer link |
| Pending | Frontend | Confirm form provider + integrate | Typeform or open‑source |
| Pending | Frontend | Algolia search integration | Replace current search |
| Pending | Content | Export category pages (sale, sucre, voyage) | Import JSON and map links to local slugs |
| Pending | Content | Export author pages | Confirm author list + import |
| Optional | Ads/Analytics | Mediavine integration (global async script in layout) | Client requirement, optional for now |
| Optional | Ads/Analytics | Staging validation (ads load, no console errors) | After Mediavine |
| Optional | Ads/Analytics | ads.txt / privacy / GDPR checks | Staging checks |
| Long‑term | ContentV2 | Build legacy migration tool | Dry‑run + batch + rollback logs |
| Long‑term | ContentV2 | Add migration safety fields | `migrationStatus`, `migrationNotes`, `legacySnapshot` |
| Long‑term | ContentV2 | Migration QA workflow | Legacy vs V2 + JSON‑LD parity |

## Completed ✅

- [x] Pure SSG Astro build (`output: 'static'`).
- [x] Payload webhook → GitHub Action (`payload-update`) → Coolify deploy.
- [x] Prepared snapshot moved off Git LFS (no LFS budget issues).
- [x] Snapshot stored as GitHub Release (`prepared-snapshot`).
- [x] Build downloads snapshot via `PREPARED_JSON_URL`.
- [x] Build uses JSON only (`USE_LOCAL_JSON=1`, `BUILD_ONLY_ARTICLE_PAGES=1`).
- [x] Snapshot update uses ID/slug/title matching; snapshot now includes `id` + `_id`.
- [x] Disqus comments integrated (replaced Giscus).
- [x] DeepL translation API working via Astro `/api/translate`.
- [x] Author/meta display hidden via CSS (temporary).

## Pending / Next (Frontend)

- [ ] Create static pages: MY BOOKS, SAVORY (DIRTY), SUGAR, THE WORKSHOPS, VIDEOS, TRAVEL, NEWS REPORTS, SELECTIONS.
- [ ] Footer pages: Contact, Partnership, Legal Notices, GDPR.
- [ ] My Account link → `https://atelier-lacuisinedebernard.com/mon-compte/`.
- [ ] Confirm form provider (Typeform or open-source) and integrate.
- [ ] Algolia search integration (replace current search) — planned for Monday.
- [ ] Export category pages (sale, sucre, voyage) — JSON import + local links.
- [ ] Export author pages — confirm list + import.

## Pending / Next (Ads + Analytics)

- [ ] (Optional) Mediavine integration (global async script in layout).
- [ ] (Optional) Staging validation: script present in page source, ads load, no console errors.
- [ ] (Optional) ads.txt / privacy / GDPR checks on staging.

## Long‑term (ContentV2 Migration)

- [ ] Build legacy migration tool to convert old HTML → `contentV2` + blocks.
  - [ ] Dry-run mode.
  - [ ] Batch mode.
  - [ ] Rollback-safe logs/snapshots per article.
- [ ] Add migration safety fields: `migrationStatus`, `migrationNotes`, `legacySnapshot`.
- [ ] Migration QA workflow: compare legacy vs V2, validate images + JSON-LD.
