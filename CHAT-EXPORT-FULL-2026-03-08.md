# LCDB Full Chat Export (Reconstructed) - 2026-03-08

## Note

This is a reconstructed full working export of the project chat history, not a raw platform transcript dump. It is intended to preserve:

- what was requested
- what was implemented
- what was reverted
- what was pushed
- what is stable now
- what is on hold
- what should be resumed later

## Project Context

- Project: `lcdb-astro`
- Front-end: Astro static site
- Back-end/admin: `payload-admin`
- Core rule established during the chat:
- articles = `PURE SSG`
- search index = `PURE SSG`
- upcoming workshops = API-driven allowed

## Major Work Completed During This Chat

### 1. Front-End Delivery Work

- Header language dropdown flow was implemented and restored after accidental deletion.
- Search URL behavior was normalized to direct slug routes.
- Mobile search behavior was aligned with desktop-like flow.
- Translation flow was stabilized multiple times and later left in a working state.
- Homepage performance was improved without breaking the client’s article coverage requirement.
- Workshop blocks were aligned to API-driven behavior.
- Homepage pagination and suggested recipes pagination were debugged and restored to a working accepted state.
- Article detail featured image behavior from the new Payload editor was fixed.
- Relative Payload media URLs were normalized correctly for front-end rendering.
- Old WordPress image-domain request storms were investigated and fixed in the accepted flow.
- Final accepted front-end state was confirmed by QA.

### 2. Payload Admin / Recipe Builder UX

- Recipe/article editor was reworked to a one-page recipe-first flow.
- Top metadata was surfaced clearly:
- title
- slug
- excerpt
- featured image
- author
- language
- categories
- tags
- Quick info UX was improved.
- Ingredient import/paste helper was added.
- Steps editing was improved.
- Nutrition section was improved.
- Progress/completion guidance was added.
- Inline slug editing was added.
- Publication and translation workflow were added and stabilized.
- Print-friendly recipe card work was finished.
- Staging QA was completed.
- Client review passed for this editor UX.

### 3. Translation Workflow

- Translation endpoint behavior was debugged multiple times.
- Infinite/repeated translation request loops were fixed.
- Header language selection behavior was corrected.
- Auto-translate + review/approval workflow in Payload was implemented.
- Per-language publish control was implemented.
- Default site language rule was preserved as French.
- Translation architecture was later paused for further changes until client confirms.

### 4. Homepage Performance

- First-load translation overhead was reduced.
- Workshops hydration was deferred safely.
- Image loading behavior was tuned and some experiments were later reverted when they hurt UX.
- Legacy image request storms and bad fallback behaviors were investigated heavily.
- Pagination logic was adjusted multiple times until both sections worked:
- `Découvrez mes recettes`
- `Ces recettes pourrez vous intéresser`
- Final performance sign-off metrics were captured:
- Mobile Performance: `71`
- Desktop Performance: `89`
- Accessibility: `89 / 90`
- Best Practices: `88 / 92`
- SEO: `92 / 92`

### 5. Deploy / Build / Ops Work

- Front-end and back-end builds were debugged repeatedly.
- Docker/build secret exposure issue was handled previously in the broader project flow.
- Multiple Payload build blockers were fixed:
- invalid UI field labels
- unsupported `admin.className` on UI fields
- hydration warning mitigation
- Build slowness was investigated and duplicate article route cost was reduced.
- Later some build-related image/migration experiments were reverted when the user requested restore to the stable behavior.

### 6. Comment / Disqus / Workshop / Miscellaneous Feature Work

- Disqus issues were fixed earlier in the working flow.
- Workshop display was aligned with live availability labels and remaining places.
- Section spacing and homepage consistency issues were addressed.
- Search and article rendering were hardened against field shape inconsistencies.

## Reversions and Restorations That Matter

### Accepted final state after reversions

Several experiments were intentionally rolled back when they created regressions. Important examples:

- delayed pagination variants that broke page-number behavior
- aggressive image loading priority changes that slowed actual image rendering
- legacy migration code after client said not needed right now

Current accepted rule:

- keep the stable working homepage/pagination/image flow
- do not re-open old experimental pagination/image-loading behavior without reason

## Legacy Migration Work That Was Explored Then Reverted

This was started later in the chat, then put on hold by the client and reverted from the repo.

### What was explored

- migration safety fields
- migration audit tool
- migration prepare tool
- migration convert tool
- featured media import tooling
- migration dry-runs and limited safe writes

### What was learned

- most legacy articles are still HTML-based
- almost all of them are image-heavy
- proper `featuredMedia` relations are missing for the legacy dataset
- `featured_img_url` style fields exist, but that is not enough for full safe V2 migration
- media-aware migration would require proper image import/mapping first

### Final status of this area

- client said this is not needed right now
- migration-related backend code was reverted from the repo
- this work is currently on hold
- if resumed later, it should be resumed locally first, not directly on live

## Current Stable / Accepted State

### Front-end

- current delivery scope: done
- homepage, article pages, search, pagination, image behavior: stable
- articles remain pure SSG
- search remains pure SSG
- workshops remain API-driven

### Payload Admin

- recipe builder/editor UX delivery scope: done
- translation review workflow: done
- staging QA: done
- client review pass: done

### Performance

- Lighthouse/performance sign-off captured
- current accepted numbers are recorded

## Current Pending Status

### Active pending

- none

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

## Important Rules Established In This Chat

- Keep articles and search `PURE SSG`
- Workshops may remain API-driven
- Do not break homepage pagination to optimize first paint
- Preserve portrait-safe image behavior
- Do not re-open legacy migration work unless client explicitly resumes it
- If legacy migration resumes later:
- do local-only testing first
- do not start with live destructive writes
- media mapping must be validated before large-scale V2 migration

## Rollback / Restore Points

- Front-End stable tag: `stable-2026-03-02-fe`
- Back-End stable tag: `stable-2026-03-02-be`

## Files To Check First In A New Chat

- `PENDING-POINTS.md`
- `TODO-ISR.md`
- `CHAT-HANDOFF-2026-03-08.md`
- `PROJECT-AGENT.md`
- `TASK-BRIEF.md`
- `ROLLBACK-CHECKPOINTS.md`

## Known Local Dirty / Unrelated Files

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

## Recommended Resume Starting Points

If the project resumes normally:

1. check `PENDING-POINTS.md`
2. check `TODO-ISR.md`
3. confirm whether new work is:
- active delivery
- hold item resumed
- backlog item

If the client resumes legacy migration later:

1. re-open locally only
2. re-check legacy image source consistency on DO Spaces
3. validate media import path first
4. only then resume V2 migration planning

## Final State At End Of This Chat

- current delivery accepted
- no active pending delivery item left
- migration work deferred
- project can be resumed later from a clean known stable state
