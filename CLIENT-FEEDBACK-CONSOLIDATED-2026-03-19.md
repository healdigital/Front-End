# Client Feedback Consolidated

## Sources Reviewed

- [Leo Turbet.docx](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/Leo%20Turbet.docx)
- [lcb_feedback_tracker.html](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/lcb_feedback_tracker.html)

## Important Notes Before Work Starts

- The tracker HTML contains `30` items in the `items` array, but the visible stats block says `28`. This should not be trusted as the final source of truth.
- The tracker is good for prioritization, but the DOCX contains extra asks and clarifications that are not fully captured there.
- Some messages were marked as “Done” in chat, but these should be treated as “needs verification”, not as fully closed.
- Client is sensitive to visual inconsistency. Any UI fix should be checked against the original site or Figma before calling it done.

## Consolidated Worklist

### A. Critical content and migration blockers

1. Fix UTF-8 / accent issues site-wide.
What client wants:
- No broken accents anywhere on the French site.
- Search results should also display clean text.

How to handle:
- fix encoding in import/prepared article generation
- fix render-time decoding where entities or mojibake still leak
- recheck search page separately because it was explicitly called out

2. Fix missing recipe content for existing recipes.
What client wants:
- Existing migrated recipes must not be empty.
- Recipe body, ingredients, and structured recipe content must appear consistently.

How to handle:
- audit current export/import pipeline
- migrate old legacy HTML into the new editor shape for old recipes
- verify article body + recipe card both render for old content, not only for newly created content

3. Fix missing images site-wide.
What client wants:
- Recipe images, inline article images, and step images should render.
- Client specifically said pictures are missing in many places.

How to handle:
- audit media import pipeline
- audit featured image mapping
- audit inline image rendering in legacy content and recipe steps
- verify media references in Mongo / prepared articles / final front-end render

4. Fix ingredient rendering parity with original.
What client wants:
- ingredient bullets must show
- ingredient headings must show
- spacing between ingredient groups must match original

How to handle:
- front-end recipe renderer must output actual list markup
- group headings from admin / migrated content must render above the correct group
- add spacing rules between groups
- compare against original `nusszopf` page

5. Remove English leakage from French version.
What client wants:
- “Sweet” and “Savory” in French
- no random English UI labels anywhere in FR version

How to handle:
- audit labels in recipe cards, filters, badges, page labels, headers, list views, and metadata
- fix source labels and rendered UI strings

### B. Layout and visual consistency

6. Keep design coherent with rest of website.
What client said:
- font weight is not the same
- design is weird
- same UI/UX
- some gradients / odd styling should be removed

How to handle:
- do a visual consistency sweep, not just one-page fixes
- check typography scale, font weight, spacing, card size, button style, gradients, background colors
- do not ship piecemeal CSS without comparing to original and Figma

7. Font choice needs review.
What client said:
- Inter is too generic
- font weight is not the same

How to handle:
- confirm if proper paid font license exists
- if not, choose a closer free fallback than Inter
- test font weights, not just font family

8. Sticky header across the site.
What client wants:
- header should stay fixed on scroll

How to handle:
- implement sticky/fixed behavior at shared layout/header level
- test on article pages, homepage, archive pages, and mobile

9. Remove sticky behavior where it breaks ad space.
What client wants:
- right sidebar should not stay sticky if it blocks future ads

How to handle:
- identify all sticky sidebar logic
- remove it or scope it carefully so ad area is not obstructed

10. Article images centered with fixed maximum width.
What client wants:
- centered pictures with `512px` width
- one message also says `14:18` image format, but this is ambiguous and needs interpretation

How to handle:
- center inline images in article body
- apply max-width `512px`
- check if `14:18` means an aspect ratio requirement and confirm before implementing globally

11. Sidebar cleanup and redesign.
What client wants:
- keep only Facebook and Instagram
- remove “Découvrir son univers”
- sidebar should match Figma background and spacing

How to handle:
- remove extra icons/links
- align sidebar surface/background/padding/gaps with design reference

12. Recipe cards should match original more closely.
What client wants:
- cards should be smaller
- cards should show the photo in the correct portrait-like format where required
- add excerpt text on cards
- keep only time tags, remove V/GF/DF tags
- fix missing right border
- move category tags to top

How to handle:
- audit shared recipe card component
- rebuild card sizing and spacing to match original references
- ensure excerpt truncation is consistent
- adjust tag placement and visible metadata

13. Homepage and archive layout changes.
What client wants:
- homepage recipe grid can be `3` per row
- `/recettes-salees/` should be `3` cards per row and title-only without pictures
- remove grid/list toggle buttons on homepage
- remove first hero image on category/archive pages like `/le-sale/`
- improve list view to table-style layout

How to handle:
- separate homepage card logic from archive page card logic
- make list view a proper tabular layout
- remove old toggle controls if no longer part of design
- remove leading archive hero image where not desired

14. Homepage ateliers section needs redesign fix.
What client wants:
- dark-background workshop section needs layout/design improvement

How to handle:
- compare against Figma / desired design
- fix card sizing, alignment, spacing, typography, and contrast

15. Remove specific unwanted header/homepage buttons.
What client wants:
- remove the unknown `S v` button from nav
- remove additional buttons Leo pointed at in screenshots
- one homepage block also had “We can remove this” and should be rechecked against screenshots

How to handle:
- verify against screenshots and current staging
- do not assume only one button is in scope

### C. Interactive features and dynamic sections

16. Carousel improvements.
What client wants:
- auto loop every few seconds
- left/right arrows
- apply arrow treatment across site carousels, not only one place

How to handle:
- centralize carousel behavior if multiple carousel components exist
- add autoplay + loop + arrows
- test accessibility and mobile swipe behavior

17. “Vous aimerez aussi” should not always show same recipes.
What client wants:
- random recipes on each load

How to handle:
- randomize selection from eligible recipe pool
- avoid showing current recipe and duplicates
- decide if randomness is build-time, request-time, or client-side

18. Popular recipes section.
What client wants:
- surface popular recipes on both homepage and article pages
- client explicitly said “Both”

How to handle:
- propose a ranking source:
  - manual curation
  - most viewed
  - fallback heuristic
- confirm approach before implementation if analytics data is not available

19. Ingredient archive pages.
What client wants:
- archive pages for ingredients

How to handle:
- normalize ingredient names
- generate clean slugs
- create `/ingredient/[slug]` archives
- later link ingredient names from recipes to those archive pages

20. Newsletter / Acumbamail integration.
What client wants:
- connect newsletter to Acumbamail
- newsletter block on homepage
- newsletter popup/article flow should be tied to real Acumbamail form/list

How to handle:
- current popup is validation-only and fake-success
- need Acumbamail embed/link/list details
- decide whether submit happens inline or redirects to hosted form
- add homepage newsletter block if not already present in correct design

### D. Admin and editorial workflow

21. Bulk upload for recipe step photos.
What client wants:
- upload many photos at once
- automatically create one step entry per uploaded image

How to handle:
- extend Payload admin step uploader
- bulk upload should map each uploaded file to a new step row
- keep manual reordering/editing possible after upload

22. Ingredient heading support in admin and front-end.
What client wants:
- ingredient headings were forgotten

How to handle:
- confirm whether headings should exist as explicit structured data in recipe block
- ensure admin supports them cleanly
- ensure front-end renders them

### E. Verification-specific asks from DOCX not fully explicit in tracker

23. “Please check these kinds of change in all the website”.
Meaning:
- client does not want isolated fixes only on one page
- visual/design issue should be audited globally

24. “Same UI/UX”.
Meaning:
- use common patterns across homepage, article pages, archives, and cards
- avoid one-off fixes that create a new inconsistency

25. “Client will get angry” risk areas.
Most sensitive items based on tone:
- ugly / inconsistent design
- missing content
- missing images
- broken accents
- recipe card mismatch
- spacing / bullet / ingredient group issues

## Practical Priority Order

### Phase 1: Ship blockers

- UTF-8 / accent fixes
- missing recipe content
- missing images
- ingredient bullets / headings / spacing
- English leakage in FR
- sticky header and sticky sidebar conflict review

### Phase 2: Core visual parity

- recipe cards parity
- article image alignment
- sidebar cleanup/design
- list view and archive page cleanup
- homepage ateliers and homepage button cleanup

### Phase 3: Dynamic features

- carousel autoplay + arrows
- random related recipes
- popular recipes
- ingredient archives
- newsletter / Acumbamail

### Phase 4: Admin productivity

- bulk step image upload
- better ingredient heading support end-to-end

## Items Missing or Under-specified

These need clarification or should be treated carefully:

- `14:18` image format request: unclear whether aspect ratio or layout proportion
- popular recipes source: manual vs dynamic analytics-based
- newsletter Acumbamail flow: hosted form vs inline submit
- exact font fallback if paid font cannot be licensed

## Recommended Tracking Rule

For each item, track with these statuses:

- `Not started`
- `Investigating`
- `Implementation in progress`
- `Ready for visual QA`
- `Blocked by client input`
- `Done`

## Recommended Next Step

Before implementing more features, the safest sequence is:

1. close content/data blockers first
2. then fix recipe rendering parity
3. then do visual/UI consistency sweep
4. then add dynamic features like ingredient archives and Acumbamail

This order reduces the chance of upsetting the client because it addresses the most visible breakages first.
