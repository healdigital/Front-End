# Pending Points (Updated: 2026-04-02, evening)

## New Client Feedback Folder Review (2026-04-01)

### Can Do Now

- [ ] Payload native rating system
  - create `recipeRatings` collection
  - add denormalized `ratingAverage` + `ratingCount` on recipes
  - add vote endpoint / server action
  - duplicate prevention via cookie + IP hash
  - update Astro display to use real rating data

- [ ] Ingredient archive pages

- [x] Final UX/UI audit carry-forward that can be done without client input
  - broader site-wide loading states / skeletons
  - remaining image optimization pass on live surfaces
  - broader color / contrast cleanup on remaining legacy surfaces
  - translation UX polish
  - richer search UX polish
  - duplicate legacy component consolidation
  - major live/frontend-facing UX/UI items from `UX_UI_AUDIT.md` are now completed
  - any deeper leftover legacy cleanup is now non-blocking polish, not an active carry-forward

- [~] Missing image offload/import fix
  - audit + remediation scripts are now in place
  - `5992` previously broken images recovered
  - `22` fallback-only cases cleared
  - `21795` unique images still remain hard-missing
  - next step is stricter URL/path recovery for the remaining broken set

- [x] Corrected copy / accent cleanup in the remaining exact visible areas Bernard flagged
  - homepage/video/sidebar/article/print-facing visible strings were cleaned
  - legacy mojibake on client-facing surfaces was reduced in the current pass

- [x] Replace wrong image with the correct one in the affected homepage/content area
  - Bernard called out one specific image that should be removed/replaced

- [x] Move the `100% human / 100% original / 100% real photos` trust content upward with the intended photo
  - remove the unwanted Bernard photo in that area

- [x] Reduce the recipe cards shown after the step-by-step instructions
  - client asked for much smaller images, closer to “postage stamp” size like the current live site

- [x] Slow staging / delayed photo loading follow-up
  - root cause is now better understood:
  - frontend fallback logic was improved earlier
  - WordPress offload errors were confirmed in the new screenshot

- [x] Complete video courses implementation per spec
  - add `User-Agent` header in `src/lib/videoCourses.ts` for Cloudflare
  - add `lessonCount` / `duration` support
  - create dedicated `VideoCourseCard.astro`
  - create `VideoCoursesSection.astro`
  - create `src/pages/cours-video.astro`
  - switch homepage fully to the new section pattern if not already complete

- [x] Leo 2026-04-02 homepage / video library batch
  - homepage main hero block removed and the sidebar/profile area now uses Leo's latest profile text + bullet points
  - upper homepage dark section now shows the `3` real priority video courses with the updated desktop card layout
  - large homepage video block replaced with newsletter block + email form
  - header `Go` search buttons removed
  - `Rédigé le ...` metadata removed from the affected surfaced lists
  - `/cours-video` now shows paid courses first, then free videos
  - `/cours-video` cards were rebuilt to a uniform same-size design without descriptions
  - `/cours-video` books section was redesigned to the screenshot-style two-panel library layout

- [ ] Google reviews integration
  - use WordPress reviews endpoint / Cloudflare cache
  - add Astro reviews component on the chosen page(s)

- [ ] Audit backlog if Leo wants it addressed now
  - [x] remove production test pages
  - [x] add `404.astro`
  - [x] clean contact page placeholder copy on the frontend
  - [x] fix hreflang coverage
  - [x] fix render-blocking font loading
  - [x] fix hardcoded staging URL / priority audit items
  - [x] footer UX/UI pass on the live footer component
  - [x] root + organism pagination parity/accessibility pass
  - [x] search UX batch
    - visible submit button
    - autocomplete suggestions
    - sort
    - category filter
    - live status/loading state
  - [x] keyboard/accessibility batch
    - filter dropdown arrows/escape/home/end
    - card contextual aria labels
    - card focus states
    - star rating accessibility
    - mobile menu focus trap / expanded state
  - [x] archive/page-2+ legacy UX cleanup
    - `MainContent`
    - `GlobalSidebar`
    - `RecipesSections`
  - [x] article detail / print / recipe UX batch
    - article detail print CTA
    - article detail newsletter CTA
    - article detail related articles
    - article detail social share improvement
    - print page localized labels
    - language switcher cleanup
    - recipe ingredients/instructions/nutrition component cleanup
    - Disqus comments wrapper cleanup
    - articles archive shared pagination cleanup
  - [x] footer/link parity fixes
    - footer `Ateliers` external link
    - footer newsletter CTA opens modal
  - [x] social share fixes
    - icon-only share style
    - current-domain share/copy behavior
  - [x] books section responsive fix
    - `.books-section-content` width forced to `100%` on the 1024 desktop/tablet range

### Blocked / Needs Client

- [ ] Newsletter / Acumbamail real submit integration
  - needs exact Acumbamail form/list/embed/API details

- [ ] Workshop card real descriptions
  - frontend support is already added
  - client still needs to fill WooCommerce excerpts/short descriptions on the source side

- [ ] Contact form actual integration
  - frontend cleanup is done
  - real form destination/tool still needs final client direction

- [ ] Club ad-free flow on the blog
  - implement cookie/JWT gate for Mediavine
  - add Club login modal
  - add Club header button/state
  - suppress ad slots for valid club members

## Tomorrow Carry-Forward (2026-03-27)

- [x] `/api/video-courses` integration
  - connected `https://atelier-lacuisinedebernard.com/api/video-courses`
  - homepage video card now uses API title + shortDescription + image fallback
  - featured video section now uses API title + shortDescription + image fallback
  - sidebar video card now uses API title + shortDescription + image fallback

- [ ] Continue only from the `Can Do Now` bucket above

## Deferred / Hold For Later

- [ ] Shop / community setup on `atelier-lacuisinedebernard.com`
  - keep deferred for now
  - `Le Club` access/protection model to be resumed later
  - FluentCommunity + Creator LMS / shop flow finalization pending
  - MemberPress / Creator LMS license dependency only if required to make protection actually work

- [ ] Shop content note
  - Leo doc items `11` and `12` should not be duplicated on the main Astro site
  - current direction: keep only links to the external shop/community where relevant

## Leo Turbet Doc - Design Carry-Forward

- [x] Mobile vertical spacing issues
  - resolved in the homepage/mobile spacing pass and treated as completed

- [x] Title padding issues
  - affected title padding issue was fixed and treated as completed

- [x] `Temps de préparation` visual issue
  - recipe/detail quick-info display issue was fixed

- [x] Final English cleanup in UI
  - client-facing/frontend English leftovers called out in Leo doc were converted to French

## Leo Turbet Doc Content Pass (2026-03-25)

- [x] Homepage hero wording aligned to `Leo Turbet.docx`
- [x] Homepage featured recipe CTA wording aligned
- [x] Main homepage recipe-grid wording aligned
- [x] Workshops wording aligned
- [x] Video-courses wording aligned
- [x] Newsletter wording aligned
- [x] About wording aligned
- [x] Books wording aligned
- [x] Inspiration wording aligned
- [x] Footer wording aligned
- [x] Shared recipe-card CTA wording aligned
- [x] Detail-page newsletter wording aligned
- [x] Shared newsletter modal wording aligned
- [x] Final grep cleanup completed for the old targeted homepage/shared wording strings
- [x] Leo doc items `11` and `12` were clarified as shop/community scope, not main-site duplicated content

## Current Active Fixes (2026-03-25)

- [x] Detail page mobile responsiveness:
  right-side cut/overflow fixed; mobile now uses a true single-column layout with balanced gutters.
- [x] Detail page desktop/sidebar parity:
  sidebar alignment and column proportions were adjusted to match homepage parity.
- [x] `/recettes-sucrees/` image presentation:
  portrait cards are in place with image-fill adjustments applied.
- [x] Mobile header search panel:
  panel is back to hidden-by-default and should only open when the search icon is clicked.
- [x] Homepage `Découvrez mes recettes` overlap at desktop/1024:
  homepage block overlap regression was traced to duplicate/broad card-height CSS and corrected.
- [x] Global WordPress image fallback logic:
  broken upload-image variants now use safer fallback candidates without incorrectly stripping valid filenames.
## Client-Promised Pending (Must Track)

- [x] Default site language must remain French (`fr`) on first load.
- [x] Translation with review workflow (admin-side): automatic translation + human review/approve before publish.
- [x] Per-language publish control: formal draft/publish workflow by language.
- [x] Print-friendly recipe card finishing for new block-rendered recipes.
- [x] Final performance sign-off with Lighthouse + real-device metrics (LCP/CLS/FCP). (Captured results: Mobile Performance `71`, Desktop Performance `89`, Accessibility `89/90`, Best Practices `88/92`, SEO `92/92`.)

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
- [x] Client review pass on the new Payload article editor UX

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

- [x] Reduce homepage initial render payload.
- [x] Lower `HOME_INITIAL_RENDER_COUNT` (kept unchanged intentionally because client wants full homepage article coverage with pagination).
- [x] Lower `SUGGESTED_INITIAL_RENDER_COUNT` (kept unchanged intentionally because client does not want this reduction).
- [x] Defer workshops live API hydration with viewport trigger (`IntersectionObserver`) instead of immediate first-load execution.
- [x] Reduce translation overhead on first paint.
- [x] Skip initial full-page `changeLanguage(...)` run when saved language equals source/default language.
- [x] Improve homepage image delivery without crop regression.
- [x] Add/validate `srcset + sizes`, keep portrait-safe rendering, keep only true LCP image as high priority. (`sizes` + priority cleanup done; explicit `srcset` skipped intentionally to avoid portrait/crop regressions)
- [x] Add below-the-fold render deferral (`content-visibility: auto` with intrinsic size hints) on heavy homepage sections.
- [x] Stop legacy WordPress image request storm on homepage/search hydration:
- [x] rewrite old `lacuisinedebernard.com/wp-content/uploads/...` URLs to DigitalOcean Spaces
- [x] stop using article-body image extraction as featured-image fallback for cards/search
- [x] lazy-assign hydrated card image `src` only when the card becomes visible

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
- [ ] Payload: migrate/backfill existing legacy articles to new V2 editor schema (on hold by client;    migration tooling/code was reverted from repo).
- [ ] ContentV2: build legacy migration tool (on hold by client; not active in current backend code).
- [ ] ContentV2: add migration safety fields (`migrationStatus`, `migrationNotes`, `legacySnapshot`) (on hold by client; not active in current backend code).
- [ ] ContentV2: migration QA workflow (legacy vs V2 + JSON-LD parity) (on hold by client).
