# Recipe Builder Phase 1 Implementation Plan

Last updated: 2026-02-27

## Objective

Implement the client-requested critical UX restructure in Payload Admin for new recipe articles, without breaking:

- current frontend rendering
- existing `recipeBlocks`-based data flow
- translation workflow
- publication validation

Phase 1 focuses on the critical workflow issue:

- one-page recipe-first editing experience
- no forced tab hopping
- no visible "block-first" friction for recipe authors

## Scope of Phase 1

### In Scope

- remove 5-tab editing experience from author workflow
- create one-page vertical recipe-first layout
- bring essential fields into top section
- make recipe editing available directly on page load
- preserve current stored data shape

### Out of Scope

- full ingredients paste parser
- advanced progress indicator
- final nutrition compact redesign polish
- SEO auto-generation hooks
- schema migration away from `recipeBlocks`

Those stay for later phases.

## Non-Negotiable Safety Rule

Do not remove `recipeBlocks` persistence in Phase 1.

Reason:

- frontend depends on `recipeBlocks`
- publication checklist depends on `recipeBlocks`
- translation hooks depend on `recipeBlocks`
- print/frontend JSON-LD currently depend on the same source

So Phase 1 is primarily:

- admin UX restructuring
- not backend data-model deletion

## Recommended Technical Strategy

## Strategy A - Preferred

Keep existing article collection data model mostly intact, but change the admin editing experience.

Approach:

1. Replace the `tabs` field layout in `Articles.ts` with one ordered field stack.
2. Surface top-level non-recipe essentials first:
   - title
   - slug
   - excerpt
   - featured media
   - author
   - language
   - categories
   - tags
3. Keep recipe data stored inside `recipeBlocks`, but present it through a cleaner single-page author flow.
4. Move secondary fields into collapsibles:
   - content
   - SEO
   - publication
   - legacy/fallback fields

This gives the client the requested UX direction without breaking current rendering.

## Strategy B - Avoid In Phase 1

Move all recipe fields from `recipeBlocks` to direct article fields immediately.

Why avoid now:

- too many downstream changes at once
- frontend adapters needed
- validation refactor needed
- translation refactor needed
- higher rollback complexity

## Exact Deliverables

### D1. Replace Tabs With One-Page Layout

Current:

- `type: 'tabs'` in `payload-admin/src/collections/Articles.ts`

Planned:

- convert to sequential field groups / rows / collapsibles
- remove author-facing dependency on tabs

Expected result:

- author lands on one continuous editor

### D2. Build Top Header Section

Top section order:

1. title
2. slug
3. excerpt
4. featured media
5. author
6. language
7. categories
8. tags

Notes:

- slug can remain technically as normal text field in Phase 1
- inline slug UX can be postponed to later
- but visually it should stop dominating the page

### D3. Create Quick Info Section

This section should expose recipe essentials early:

- prep time
- cook time
- servings count
- difficulty
- recipe type
- dish type
- cuisine

Implementation note:

- these still come from first `recipeCard` block in `recipeBlocks`
- we may initially keep the recipe block editor visible below, but the author flow should clearly show "this is the recipe section"

### D4. Keep Recipe Editing In One Continuous Flow

Minimum acceptable Phase 1 outcome:

- recipe section visible directly in page flow
- no need to jump to separate tab
- no need to hunt fields in other tabs

If block chooser still technically exists under the hood, it must be visually minimized in the workflow.

### D5. Move Secondary/Advanced Fields Into Collapsibles

Collapsibles for:

- article content / story
- SEO
- publication settings
- legacy read-only imported fields
- image blocks / non-primary image content

Expected effect:

- editor stays focused on recipe creation first

## File-Level Impact

### Primary File

- `payload-admin/src/collections/Articles.ts`

Main changes:

- remove `tabs` layout
- reorder fields
- add collapsible group structure
- promote top metadata fields

### Supporting Files Likely Needed

- `payload-admin/src/app/(payload)/custom.scss`
  - admin-only visual improvements for density/layout
- `payload-admin/src/collections/blocks/RecipeCardBlock.ts`
  - optional label cleanup / row grouping polish

### Files That Must Be Checked But Not Broken

- `payload-admin/src/collections/hooks/articlePublicationChecklist.ts`
- `payload-admin/src/collections/hooks/normalizeRecipeBlocks.ts`
- `payload-admin/src/collections/hooks/autoTranslateFromSource.ts`
- `src/utils/renderArticleContent.ts`
- `src/utils/buildRecipeJsonLd.js`
- `src/pages/print/[slug].astro`

## Phase 1 Execution Order

### Step 1

Refactor `Articles.ts` layout only.

Goal:

- same fields
- same data
- different admin arrangement

### Step 2

Add admin visual styling in `custom.scss`.

Goal:

- better grouping
- denser header area
- clearer section separation

### Step 3

Polish recipe block section so it reads as the main editor flow.

Goal:

- recipe author should intuitively understand where to enter recipe data

### Step 4

Run validation checks:

- typecheck
- existing save flow
- publish checklist flow
- non-French translation fields still conditionally work

### Step 5

Manual QA:

- create new French recipe
- attach featured image
- fill ingredients and steps
- save draft
- publish
- verify frontend render unchanged

## Risks

### Risk 1

Breaking existing admin author habits by over-customizing too early.

Mitigation:

- keep field names stable where possible

### Risk 2

Breaking translation workflow conditions when moving metadata fields.

Mitigation:

- do not change field names
- only change placement/layout

### Risk 3

Breaking publication validation if recipe block structure changes.

Mitigation:

- no storage refactor in Phase 1

## Definition of Done for Phase 1

Phase 1 is complete only if all of these are true:

- article editor is no longer tab-based for the primary author flow
- title, excerpt, featured image, author, language, categories, tags are visible near top
- recipe section is part of one continuous page flow
- save/publish still works
- current frontend recipe rendering remains unchanged
- translation workflow still works for non-French variants

## Recommended Next Step After Phase 1

Once Phase 1 is stable:

- Phase 2 should improve actual data entry UX
  - ingredients table feel
  - step cards
  - compact nutrition

That is where the editor starts feeling truly close to the client mockup.
