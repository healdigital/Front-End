# Client Update

## What We Did Today

- Reviewed and consolidated all feedback from `Leo Turbet.docx` and `lcb_feedback_tracker.html`.
- Converted the feedback into a tracked execution list so the 30 requested points are now grouped by priority and status.
- Audited the current article data flow to confirm where content is coming from and which content is still in legacy format.
- Confirmed that most existing articles are still in the old shape, which explains why many recipe pages are incomplete or inconsistent.
- Completed a structured migration investigation for legacy recipe content.
- Built a dedicated converter for old recipe data so it can be transformed into the current editor format safely instead of relying on fragile HTML scraping.
- Generated and verified sample converted editor-shape JSON outputs from real legacy recipe entries.
- Validated the safe migration approach for old recipe content before any bulk database update.

## Critical Items Identified

These are the most important blockers and should be handled first:

1. Missing recipe content on many migrated recipes
2. Missing images across articles and recipe pages
3. UTF-8 / accent issues
4. Ingredient rendering parity:
   bullets, headings, and spacing
5. English labels still appearing on the French site

## Important Visual / UX Items

- recipe card parity with the original site
- sticky header verification
- sidebar cleanup and Figma parity
- archive/category layout cleanup
- article image width and centering rules
- overall font, spacing, and visual consistency

## Dynamic / Feature Items

- ingredient archive pages
- newsletter popup connection with Acumbamail
- carousel improvements
- random related recipes
- popular recipes section
- admin improvements such as bulk step-photo upload

## What Happens Next

1. Finish the one-article safe migration flow with backup-first logic
2. Verify the converted article output inside the current editor format
3. Apply the migration to a small controlled set of recipe articles first
4. Then move to the other critical front-end issues:
   images, accents, ingredient rendering, and French label cleanup

## Internal Tracking

Detailed internal tracking is maintained here:

- [CLIENT-EXECUTION-TRACKER-2026-03-19.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/CLIENT-EXECUTION-TRACKER-2026-03-19.md)
- [CLIENT-FEEDBACK-CONSOLIDATED-2026-03-19.md](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/CLIENT-FEEDBACK-CONSOLIDATED-2026-03-19.md)
