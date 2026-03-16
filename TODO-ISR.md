# LCDB Tracker + Chat Summary (Updated: 2026-03-16)

## Current State

- Front-end current delivery scope: `IN PROGRESS`
- Article detail page redesign scope: `IN PROGRESS`
- Payload recipe data export / cleanup scope: `IN PROGRESS`
- Payload recipe-builder / editor UX scope: `DONE`
- Lighthouse sign-off captured: `DONE`
- Legacy article migration to V2 schema: `ON HOLD BY CLIENT`

## Current Active Pending

- Final article detail page polish against latest Figma once `.fig` / proper Figma access is available
- Recipe card data cleanup/export from WPRM-style content into cleaner Payload-backed structure
- Verify live related articles after deploy using prepared JSON fallback
- Continue recipe card setup after clean export is ready
- Review remaining mobile/header interactions after current submenu fix on staging/live

## Current On Hold

- Full multi-language cache generation + production/staging QA
- Further translation architecture changes until client confirms resume
- Payload legacy articles migration to V2 schema
- Legacy featured-media import / media-aware migration
- Exact comments redesign parity with Figma inside Disqus embed

## Current Constraints

- Exact Figma parity is limited until proper Figma access or `.fig` source is available
- Exact comments UI parity is limited because Disqus comments render inside an embedded iframe
- Recipe card data is still mixed into broader content/JSON and needs cleaner export before final setup

## Latest Confirmed Completed

- Header dropdowns added for `MES LIVRES`, `SALÉ`, and `SUCRÉ`
- Mobile navigation refined so submenu items stay collapsed by default and open on tap
- Menu-linked landing pages redesigned:
- `mes-livres`
- `chocolat-maison`
- `recettes-salees`
- `le-sale`
- `recettes-sucrees`
- `le-sucre`
- `voyages-culinaires`
- `videos`
- Article detail page significantly refined toward Figma:
- newsletter block and modal
- related articles slider section
- sidebar layout and sticky behavior
- preparation / ingredients / nutrition presentation
- featured image conditional behavior when the first content paragraph already contains an image
- Article detail page metadata adjustments:
- author forced to `Bernard Laurance`
- sweet/savory label derived from article category/tag data
- Related articles fallback added for deploys that build with `USE_LOCAL_JSON=1`
- Comments shell styling refined without changing the current HTML structure
- Homepage pagination restored and working for:
- `Découvrez mes recettes`
- `Ces recettes pourrez vous intéresser`
- Homepage image behavior stable again
- Image/performance regressions resolved in current accepted flow
- Final Lighthouse performance sign-off captured:
- Mobile Performance: `71`
- Desktop Performance: `89`
- Accessibility: `89 / 90`
- Best Practices: `88 / 92`
- SEO: `92 / 92`
- Payload recipe editor / recipe builder client review passed

## Payload Recipe Builder Status

- one-page recipe-first editor flow: done
- inline slug editor: done
- progress/completion guidance: done
- ingredient paste/import helper: done
- improved steps/nutrition/quick-info UX: done
- publication + translation review workflow: done
- print-friendly recipe card support: done
- staging QA completed: done

## Legacy Migration Status

- Migration tooling was explored and tested temporarily.
- Client has currently said this is not needed.
- Migration-related backend code has been reverted from the repo.
- No active migration implementation work is pending unless client reopens it later.

## Carry-Forward Backlog

- Form provider integration
- Category page export/import
- Author page export/import
- `selection.html` content import
- `reportages.html` content import
- Mediavine integration
- Ads/privacy/GDPR checks

## Notes

- Stable rollback tags already exist:
- Front-End: `stable-2026-03-02-fe`
- Back-End: `stable-2026-03-02-be`

- Recent front-end commits in current delivery track:
- `72c25fd feat: refine mobile navigation`
- `886f5a5 feat: refine article details page realted artciels`
- `5d4b175 feat: refine article details page`
- `7600d45 feat: refine comments`
- `6181c8f fix: refine comments section styling`
- `954ea42 fix: refine newsletter modal styling`

- Live related-articles failure root cause was confirmed in deploy logs:
- build was running with `USE_LOCAL_JSON=1`
- Mongo was unavailable in deploy (`MONGODB_URI not found`)
- fallback support has now been added in code for prepared/local article data

- Backend migration code for `Payload legacy articles migration to V2 schema` has been removed from the repo after client pause.
