# Recipe Builder Gap Analysis

Last reviewed: 2026-02-27

## What The Client Actually Wants

Client wants the Payload article editor to feel like a fast, recipe-first publishing tool:

- one continuous editing flow
- minimal clicks
- recipe data entered directly
- image + metadata visible early
- ingredients and steps fast to enter
- automatic helper logic for repetitive fields
- advanced fields hidden until needed

Important scope clarification from prior client chat:

- this is for `new recipes`
- this is for existing `Front-End + payload-admin`
- not a separate website rebuild

## Current State In Code

Current article editor is still tab-based in `payload-admin/src/collections/Articles.ts`:

- `title`
- `slug`
- `tabs`
  - `Content`
  - `Recipe`
  - `Images`
  - `SEO`
  - `Metadata`

Current recipe entry is still block-first:

- `recipeBlocks` lives under the `Recipe` tab
- editor must add `Recipe Card` block first
- recipe fields are not directly visible on load

Current recipe schema is in `payload-admin/src/collections/blocks/RecipeCardBlock.ts`.

## What Is Already Done

These parts already align partially with the client requirement:

- recipe type exists:
  - `savory`
  - `sweet`
  - `other`
- dish type exists
- cuisine exists
- step photo exists
- step image caption exists
- nutrition fields exist
- calories per serving auto-calculation already exists
- translation review workflow exists
- per-language publish control exists
- print page exists on frontend
- frontend already renders:
  - ingredients
  - steps with photos
  - compact recipe card without step photos

## What Is Not Done Yet

### Structural P1 Gaps

- editor is still 5-tab based
- recipe is still hidden behind `Recipe Blocks -> Recipe Card`
- featured image is still in separate `Images` tab
- author/categories/tags are still in `Metadata` tab
- slug is still a full standalone field at top

### P2 UX Gaps

- no compact one-screen `Quick Info` section
- ingredients are still array rows, not compact table UX
- no `Paste from text` helper for ingredients
- steps are still default array UI, not dedicated numbered card UX
- nutrition is not redesigned into the intended compact collapsible layout
- no guided visual completion/progress

### P3 Automation / Finish Gaps

- SEO defaults are not auto-generated from title/excerpt yet
- inline compact slug edit UX is not implemented
- collapsible recipe-first page structure is not implemented
- publication controls are not visually separated into final section on one-page flow

## Important Technical Constraint

Current frontend still reads recipe content from `recipeBlocks`.

That means:

- if we remove `recipeBlocks` completely in admin schema, frontend rendering and existing validation/hooks will break
- safest implementation path is:
  - keep storage compatibility first
  - redesign admin editing UX first
  - then decide whether to keep `recipeBlocks` as storage shape or migrate to direct fields with adapter layer

## Recommended Implementation Strategy

### Phase 1

- keep existing data model compatible
- build one-page admin UX
- surface key fields in recipe-first order
- remove block friction from editor experience

### Phase 2

- improve ingredient + step data entry UX
- compact nutrition layout
- add helper actions/imports

### Phase 3

- add SEO defaults
- inline slug edit
- progress guidance
- optional wide-screen sidebar polish

## Recommended Safety Rule

Do not start by deleting `recipeBlocks` from persistence.

Better path:

1. make editor UX match client expectation
2. preserve frontend compatibility
3. add migration/adapter only when UI is stable

## Working Conclusion

The client request is not "small improvements".

It is a real admin UX rebuild of the article editor, with recipe-first structure, while preserving current frontend rendering and translation workflow.

So before implementation, the correct mental model is:

- this is primarily an admin architecture/UI task
- not just field renaming
- not just adding 2-3 fields
- not just styling
