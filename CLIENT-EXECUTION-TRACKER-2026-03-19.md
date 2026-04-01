# Client Execution Tracker

## Source Of Truth

Primary sources reviewed:

- [Leo Turbet.docx](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/Leo%20Turbet.docx)
- [lcb_feedback_tracker.html](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/lcb_feedback_tracker.html)
- [CLIENT-FEEDBACK-CONSOLIDATED-2026-03-19.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/CLIENT-FEEDBACK-CONSOLIDATED-2026-03-19.md)
- [New Client feedback/Chat.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/New%20Client%20feedback/Chat.md)
- [New Client feedback/BLOG_AUDIT.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/New%20Client%20feedback/BLOG_AUDIT.md)
- [New Client feedback/UX_UI_AUDIT.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/New%20Client%20feedback/UX_UI_AUDIT.md)
- [New Client feedback/CLUB_AD_FREE_IMPLEMENTATION (1).md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/New%20Client%20feedback/CLUB_AD_FREE_IMPLEMENTATION%20%281%29.md)
- [New Client feedback/google-reviews-astro-brief.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/New%20Client%20feedback/google-reviews-astro-brief.md)
- [New Client feedback/video_caption.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/New%20Client%20feedback/video_caption.md)
- [New Client feedback/Implementation Spec — La Cuisine de Bernard Blog (1).pdf](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/New%20Client%20feedback/Implementation%20Spec%20%E2%80%94%20La%20Cuisine%20de%20Bernard%20Blog%20%281%29.pdf)

## New Client Feedback Review (2026-04-01)

New items identified after reviewing the `New Client feedback` folder in depth.

### Direct client asks

- Missing image offload/import fix remains open
  - client reported many slow or missing photos
  - offload screenshot shows real media offload failures in WordPress
- Corrected text/accent cleanup remains open in the exact areas Bernard called out
  - `These are not the texts I corrected`
  - transcript confirms missing accents in corrected copy
- One wrong image still needs replacement in the affected homepage/content area
- Trust/value block still needs the intended content/image arrangement:
  - move `100% human / 100% original / 100% real photos` upward
  - remove the unwanted Bernard photo in that area
- Recipe cards shown after the step-by-step section still need their images reduced drastically
  - client reference: much smaller, “postage stamp” style images

### Spec-driven implementation items

- Video courses implementation is broader than the current basic API hookup
  - spec still calls for `User-Agent` handling in `videoCourses.ts`
  - `lessonCount` / `duration`
  - dedicated `VideoCourseCard.astro`
  - dedicated `VideoCoursesSection.astro`
  - dedicated `/cours-video` page
- Club ad-free blog flow is separately specified
  - Club login modal
  - JWT cookie flow
  - conditional Mediavine load suppression
  - header Club state UI
- Google reviews integration is also specified as a separate feature

### Audit backlog from the new folder

- Remove production test pages
- Add `404.astro`
- Fix incomplete hreflang coverage
- Fix render-blocking font loading
- Fix public endpoint/security hardening items called out in the audit
- Fix hardcoded staging URL / broader pre-launch technical backlog

## Latest Content Pass (2026-03-25)

Content-only pass completed from [Leo Turbet.docx](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/Leo%20Turbet.docx) without touching design/CSS.

- Homepage hero wording aligned
- Featured recipe CTA wording aligned
- Homepage recipe-grid wording aligned
- Workshops wording aligned
- Video-courses wording aligned
- Newsletter wording aligned
- About wording aligned
- Books wording aligned
- Inspiration wording aligned
- Footer wording aligned
- Shared recipe-card CTA wording aligned
- Detail-page newsletter wording aligned
- Shared newsletter modal wording aligned
- Final grep sweep cleared the previously targeted old wording strings
- Leo doc items `11` and `12` were clarified as shop/community scope and should not be duplicated on the main Astro site

## Carry-Forward For Tomorrow (2026-03-27)

- Main-site video courses API integration completed:
  - connected `https://atelier-lacuisinedebernard.com/api/video-courses`
  - homepage video card now uses live API title/description data
  - featured video section now uses live API title/description data
  - sidebar video card now uses live API title/description data
  - safe local image fallback remains in place when API image is `null`

- Implement native recipe rating system in Payload:
  - `recipeRatings` collection
  - denormalized `ratingAverage` / `ratingCount`
  - vote action/endpoint
  - duplicate prevention with cookie + IP hash
- Keep main Astro site limited to shop links only for the shop/community/course sales flow
- Remaining doable scope:
  - Ingredient archive pages
  - missing image offload/import fix
  - corrected copy/accent cleanup in Bernard-flagged areas
  - wrong-image replacement + trust-block content/photo rearrangement
  - full video-courses implementation per spec
  - Google reviews integration

## Blocked / Needs Client

- Newsletter / Acumbamail real integration
  - needs exact Acumbamail form/list/embed/API details
- Workshop real descriptions
  - frontend support is in place
  - client still needs to populate WooCommerce excerpts/short descriptions
- Club ad-free blog flow
  - depends on the Club auth/plugin/shop direction being resumed on the client side

## Deferred Shop / Community Scope

- `Le Club` setup on `atelier-lacuisinedebernard.com` is deferred for now
- Final access/protection model still pending between:
  - FluentCommunity
  - Creator LMS
  - MemberPress
- Resume later if/when client wants the club/community flow completed
- MemberPress / Creator LMS license dependency remains relevant only if protection is resumed and blocked

## Leo Doc New Changes - Carry-Forward

Additional items found in [Leo Turbet.docx](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/Leo%20Turbet.docx) after the original wording/content pass:

- Mobile vertical spacing issue: resolved in the homepage/mobile spacing pass
- Title padding issue: resolved on the affected screens
- `Temps de préparation` visual issue: resolved in the recipe/detail quick-info pass
- Frontend English issue in French UI: resolved on the client-facing screens called out by Leo

Note:
- these Leo-doc carry-forward items have now been completed on the relevant frontend screens

## Latest Active Regressions (2026-03-25)

- Detail page mobile layout regression resolved:
  right-side cut/overflow fixed, centered single-column mobile layout now applied.
- Detail page desktop/sidebar parity regression resolved:
  sidebar alignment and column proportions updated to match homepage parity.
- `/recettes-sucrees/` image-fill regression resolved:
  portrait cards with adjusted image-fill now applied.
- Mobile header search panel regression has been corrected in code:
  search should stay hidden by default and open only on search-icon click.
- Homepage `Découvrez mes recettes` overlap regression has been corrected in code:
  the previous-block overlap was traced to overly broad card-height/CTA CSS.
- Global WordPress upload image handling has been hardened:
  fallback candidates now preserve valid filenames and try real generated sizes before failing.

## Working Rules

- Do not mark anything done without visual verification against staging + original/Figma.
- Items marked “Done” in chat are treated as `Needs verification`.
- Priority order:
  - `P1` = visible blockers that can upset client quickly
  - `P2` = pre-launch polish and layout parity
  - `P3` = dynamic improvements / admin improvements
- Track status using:
  - `Not started`
  - `Investigating`
  - `In progress`
  - `Needs verification`
  - `Blocked by client`
  - `Done`

## Immediate Strategy

We should not jump to carousel/newsletter/archive features first.

Best sequence:

1. fix data/content/image/encoding blockers
2. fix recipe page parity
3. fix card/layout consistency
4. then do dynamic features and admin workflow improvements

## Task Board

### P1: Ship blockers

#### T01. UTF-8 / accent issues site-wide

- Status: `Done`
- Owner:
  - `Codex`: trace encoding/import/render/search leakage
  - `You`: verify affected pages from client screenshots
- Why this matters:
  - client explicitly called out accent issues multiple times
  - broken accents make the site look low quality immediately
- Technical direction:
  - fix import/prepared article generation
  - fix render-time decoding where needed
  - verify search page separately

#### T02. Missing recipe content on migrated recipes

- Status: `Done`
- Owner:
  - `Codex`: legacy-to-new-editor migration flow
  - `You`: identify highest-priority broken recipe examples from Leo
- Why this matters:
  - client said many recipes are empty
  - blocks QA of most other recipe-related items
- Technical direction:
  - continue old-article conversion work
  - migrate legacy HTML into `contentV2` + `recipeBlocks`
  - build safe one-article migration flow before bulk migration
- Existing related work:
  - [MERGE-LEGACY-SINGLE-ARTICLE-HANDOFF.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/MERGE-LEGACY-SINGLE-ARTICLE-HANDOFF.md)
- Completed state:
  - 2000+ legacy recipe/articles were exported, converted, and re-imported into the new editor structure
  - Mongo documents and [prepared-articles.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/prepared-articles.json) were synced
  - grouped ingredient and grouped step headings were backfilled into migrated recipes where source data supported them

#### T03. Missing images site-wide

- Status: `Done`
- Owner:
  - `Codex`: inspect media mapping and render paths
  - `You`: collect broken URLs/pages from staging if available
- Why this matters:
  - client explicitly said pictures are missing
- Technical direction:
  - verify featured images
  - verify inline images
  - verify recipe step images
  - inspect media import pipeline and front-end rendering
- Completed state:
  - featured image fallback, inline content image rendering, and step-image fallback rendering are working again across migrated recipe/article content

#### T04. Sticky header

- Status: `Done`
- Owner:
  - `Codex`: verify implementation works site-wide
  - `You`: confirm client-facing behavior on staging
- Why this matters:
  - explicitly requested
  - also was said to be “Done” in chat, so must be verified
- Technical direction:
  - test homepage, article page, archive page, mobile
- Verified state:
  - shared header is currently sticky in the active site header implementation

#### T05. Ingredient bullets missing

- Status: `Done`
- Owner:
  - `Codex`: front-end recipe renderer
  - `You`: provide exact pages client compared if needed
- Why this matters:
  - recipe page parity issue
  - client specifically noticed bullets missing
- Technical direction:
  - output actual list markup
  - avoid flattening ingredients to plain text

#### T06. Ingredient headings missing

- Status: `Done`
- Owner:
  - `Codex`: admin schema + renderer + migration mapping
  - `You`: confirm whether all legacy grouped ingredients must be preserved
- Why this matters:
  - client explicitly said “We forgot to add Ingredient Heading”
- Technical direction:
  - preserve headings in migrated data
  - render headings on front-end
  - check admin support
- Completed state:
  - grouped ingredient headings now work in Payload admin
  - grouped step headings are also supported in admin, preview, print, and front-end recipe rendering
  - existing migrated recipes were backfilled so Mongo/editor/prepared JSON keep the same grouped structure

#### T07. Ingredient group spacing broken

- Status: `Done`
- Owner:
  - `Codex`: CSS/rendering parity
  - `You`: confirm expected original spacing visually
- Why this matters:
  - client referenced original `nusszopf` page
- Technical direction:
  - compare staging vs original
  - add group spacing and section rhythm

#### T08. Remove English from French version

- Status: `Done`
- Owner:
  - `Codex`: audit labels and strings
  - `You`: run quick French QA pass
- Why this matters:
  - very visible and embarrassing in front of client
- Technical direction:
  - replace `Sweet` / `Savory`
  - audit page labels, tags, filters, buttons, metadata

### P2: Pre-launch UI and parity fixes

#### T09. Visual consistency sweep

- Status: `Not started`
- Owner:
  - `Codex`: identify inconsistent components
  - `You`: share screenshots/client references
- Why this matters:
  - client repeatedly said design is weird / not coherent / same UI-UX needed
- Technical direction:
  - typography
  - font weight
  - spacing
  - gradients
  - button styles
  - surface/background consistency

#### T10. Font parity / fallback decision

- Status: `Blocked by client`
- Owner:
  - `You`: confirm license or approved fallback
  - `Codex`: implement once font choice is final
- Blocker:
  - original paid font licensing unclear
- Need from client:
  - font license or accepted fallback

#### T11. Article images centered at 512px

- Status: `Not started`
- Owner:
  - `Codex`: article content CSS / render
  - `You`: verify if this applies to all inline images or only article-body images
- Technical direction:
  - center inline images
  - max-width `512px`
  - keep responsive behavior

#### T12. Sidebar cleanup

- Status: `Done`
- Owner:
  - `Codex`: sidebar component
  - `You`: visual check with client
- Includes:
  - keep only Facebook and Instagram
  - remove “Découvrir son univers”
  - remove any extra icons/links
- Verified state:
  - sidebar currently shows only Facebook and Instagram
  - the sidebar CTA link that was called out is no longer present

#### T13. Sidebar Figma parity

- Status: `Done`
- Owner:
  - `Codex`: background, spacing, container styles
  - `You`: provide Figma reference if needed
- Technical direction:
  - beige/cream background
  - internal spacing
  - align with overall article layout
- Latest detail-page pass:
  - sidebar column width/padding was tightened
  - empty beige strip beside the author card was removed
  - ad block spacing was reduced so the empty band above the ad no longer shows

#### T14. Remove sticky sidebar because of future ads

- Status: `Done`
- Owner:
  - `Codex`: article/sidebar layout logic
  - `You`: confirm where ad slot must remain available
- Verified state:
  - homepage sticky sidebar blocker has been removed per latest fix

#### T15. Recipe cards parity with original

- Status: `Not started`
- Owner:
  - `Codex`: shared recipe card component
  - `You`: collect 2-3 original vs staging references
- Includes:
  - card too big
  - image format and dimensions
  - card border issue
  - excerpt text
  - keep only time tag
  - remove V/GF/DF tags
  - move category tags to top

#### T16. Homepage ateliers section

- Status: `Done`
- Owner:
  - `Codex`: homepage section component
  - `You`: visual QA

#### T17. Remove unwanted nav/homepage buttons

- Status: `Needs verification`
- Owner:
  - `Codex`: header/homepage component sweep
  - `You`: confirm screenshots
- Includes:
  - `S v` button
  - buttons Leo pointed to in screenshots
  - “we can remove this” homepage element

#### T18. Category and archive page cleanup

- Status: `Done`
- Owner:
  - `Codex`: archive templates
  - `You`: verify exact intended differences between `/le-sale/` and `/recettes-salees/`
- Includes:
  - remove first hero image on category/archive page
  - improve list view
  - table-like layout where requested
  - title-only card layout for `/recettes-salees/`
  - 3 cards per row where requested

#### T19. Homepage recipe grid changes

- Status: `Done`
- Owner:
  - `Codex`: homepage recipe listing
  - `You`: verify design after implementation
- Includes:
  - 3 recipes per row
  - remove grid/list toggle buttons

### P3: Dynamic features and improvements

#### T20. Carousel autoplay

- Status: `Done`
- Owner:
  - `Codex`
  - `You`: QA all carousel surfaces
- Includes:
  - auto loop every few seconds
- Verified state:
  - homepage carousel currently auto-loops on an interval

#### T21. Carousel arrows site-wide

- Status: `Done`
- Owner:
  - `Codex`
  - `You`: QA homepage + article page carousels
- Verified state:
  - shared client arrow style is now applied on the main site carousel/slider surfaces, including homepage and article-related navigation

#### T22. Random “Vous aimerez aussi”

- Status: `Done`
- Owner:
  - `Codex`: selection logic
  - `You`: confirm randomness is acceptable vs curated content

#### T23. Popular recipes section

- Status: `Done`
- Owner:
  - `You`: get direction from client if needed
  - `Codex`: implement chosen approach
- Scope:
  - homepage
  - article pages

#### T24. Ingredient archive pages

- Status: `Investigating`
- Owner:
  - `Codex`: taxonomy/data approach
  - `You`: confirm scope with client if needed
- Technical direction:
  - normalize ingredient text
  - generate slugs
  - add ingredient archive pages
  - later link ingredient names to archives
- Current reality:
  - this remains separate scope
  - recipe/article data cleanup and grouped heading sync are complete first

#### T25. Newsletter / Acumbamail integration

- Status: `Blocked by client`
- Owner:
  - `You`: extract exact Acumbamail form/list details
  - `Codex`: wire real submit flow
- Current reality:
  - current popup is fake-submit only
- Need:
  - form link or embed code
  - list/audience
  - double opt-in preference
  - success behavior

#### T26. Newsletter block on homepage

- Status: `Done`
- Owner:
  - `Codex`: homepage block implementation
  - `You`: verify final placement and copy
- Dependency:
  - ideally should align with Acumbamail integration

### P3: Admin workflow improvements

#### T27. Bulk upload for recipe step photos

- Status: `Done`
- Owner:
  - `Codex`: Payload admin implementation
  - `You`: confirm desired exact workflow
- Goal:
  - upload multiple photos
  - automatically create one step entry per photo
- Completed state:
  - first-click helper flow is working
  - pending step heading input is inserted before created/uploaded steps
  - grouped step sections now match the same heading-first flow used for grouped ingredients

## Current Pending Scope

- Leo-doc wording/content pass is `Done` for the current homepage/shared live surfaces
- Article/detail page recreate is `In progress`
  - latest pass removed the extra story-fed `Bon appétit !` source, tightened the hero/image layout, and cleaned sidebar spacing
  - still pending: final visual parity with the client reference/Figma
- Ingredient archive pages
- Newsletter / Acumbamail real submit integration
- Font/license final decision from client

## “Done In Chat” But Must Be Re-checked

- Sticky header
- Keep only Facebook/Instagram
- Remove English from French version
- Design cleanup messages where Leo said “Done” or Atul replied “Done”

These are not trustworthy as final until visually verified.

## Work Split For Us

### You should handle

- collect client confirmations where needed
- keep screenshot references together
- confirm Figma/original references for parity-sensitive pages
- get Acumbamail details
- clarify font/license if available
- verify “14:18” image-format meaning

### I should handle

- encoding/content/image/root-cause analysis
- old recipe migration tooling
- recipe page renderer fixes
- card/layout implementation
- archive/newsletter/admin technical implementation
- creation of one-article-safe migration/update scripts

## Best Next Implementation Order

1. T02 missing recipe content
2. T03 missing images
3. T01 UTF-8 / accents
4. T05 + T06 + T07 ingredient rendering parity
5. T15 recipe card parity
6. T12 + T13 + T14 sidebar fixes
7. T18 + T19 archive/homepage layout cleanup
8. T20 + T21 carousel
9. T24 ingredient archives
10. T25 + T26 newsletter / Acumbamail
11. T27 admin bulk upload

## Practical Note

If we want to avoid upsetting the client, the safest visible wins are:

- recipe content appearing again
- images showing correctly
- accents fixed
- ingredient bullets/headings/spacing fixed
- recipe cards closer to original

Everything else should be done after these are stable.
