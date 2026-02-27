# Recipe Builder UX Audit - No-Miss Requirement Extraction

Last reviewed: 2026-02-27

## Source Verification

- Notion URL reviewed:
  - `https://pineapple-schooner-731.notion.site/Functional-UX-Audit-Recipe-Builder-Payload-Admin-3130b1cba8b180afb26ee59d272cd9c1`
- Exported PDF reviewed:
  - `c:\Users\navee\OneDrive\Desktop\995b84df-a7ff-4a26-a5ce-5823357f22d4_Functional_UX_Audit__Recipe_Builder_(Payload_Admin).pdf`
- PDF extracted text reviewed from:
  - `tmp_recipe_builder_audit_clean.txt`

Note: Notion direct HTML is app-shell JS content; detailed requirement text is captured in the PDF export and has been used as the canonical source.

## Audit Goal (as written)

- Make recipe creation as simple as possible.
- Keep recipe creation accessible on a single page.

## Current State (Documented in Audit)

- Article editor currently split into 5 tabs:
  - Content
  - Recipe (inside Recipe Blocks -> Add Recipe Block -> Recipe Card)
  - Images
  - SEO
  - Metadata
- Recipe creation currently requires heavy tab switching and modal/block indirection.
- Audit states basic recipe creation is `35+ clicks` minimum.

## Identified UX Problems (Do Not Miss)

### P1 - Critical

1. 5 tabs cause context switching and no global visibility/progress.
2. Recipe Card is hidden behind block flow despite only one block type.
3. Featured image is disconnected from recipe content (separate tab).
4. Author/Categories/Tags are buried in Metadata and easy to miss.

### P2 - Major

5. Content tab has weak value for recipe-first workflow.
6. No guided flow/progress indication.
7. Nutrition fields are stacked vertically and not compact.
8. Slug is always visible and wastes top area despite being auto-generated.

### P3 - Minor

9. SEO in a full tab for only 3 fields is disproportionate.
10. Duplicate title concept (article title vs recipe card title) is confusing.
11. Servings count + display label dual fields are confusing (display should be generated).
12. Image Blocks purpose is unclear when step photos already exist.

## Proposed Target UX (One-Page Recipe-First)

### Core Principles

- One page, vertical scroll (no tab hopping).
- Visual sections with clear hierarchy.
- Recipe fields directly editable (not hidden in block chooser).
- Auto-generated fields for repetitive/derived values.
- Progressive disclosure for advanced/secondary sections.

### Required Section Order

1. Header
2. Quick Info
3. Ingredients
4. Steps
5. Content (collapsible)
6. Nutrition (collapsible)
7. Tips (collapsible)
8. SEO (collapsible)
9. Publication (collapsible)

### Header Must Include

- Title
- Inline editable slug
- Short excerpt
- Featured image
- Author
- Language
- Categories
- Tags

### Quick Info Must Include

- Prep time
- Cook time
- Servings
- Difficulty
- Type
- Dish
- Cuisine

### Ingredients UX Requirements

- Compact table layout (ingredient, quantity, unit).
- Reorder support (drag handle).
- Add ingredient row quickly.
- Paste/import from text helper.

### Steps UX Requirements

- Clear step numbering.
- Always-visible instruction area.
- Optional photo per step.
- Optional caption per step photo.
- Reorder support.

### Collapsible Sections (Bottom)

- Article content (optional rich text)
- Nutrition (compact 4x2 layout)
- Tips and personal notes
- SEO
- Publication settings

## Auto-Generation Rules (Explicit in Audit)

- Slug = title (kebab-case)
- SEO title = title + recipe suffix
- SEO description = excerpt trimmed
- Calories per serving = total calories / servings count
- Servings display label = derived from servings count

## Structural Implementation Recommendations

- Remove tab-first model and use one-page section groups.
- Remove Recipe Blocks dependency for core recipe data entry.
- Move featured media into header context.
- Split metadata:
  - author/language/categories/tags near top
  - publication controls in collapsible section

## Quick Wins (If Full Refactor Is Delayed)

- Remove Recipe Blocks indirection first.
- Bring featured image to top context.
- Move author/categories/tags into immediate recipe flow.
- Add SEO defaults via hooks.
- Make nutrition compact via admin layout/CSS improvements.

## Priority Summary (From Audit)

- P1:
  - Remove Recipe Card block system (direct fields).
  - Merge 5 tabs into single-page flow.
  - Move image + key metadata to header zone.
- P2:
  - Sidebar-friendly layout for wide screens.
  - Ingredients compact table.
  - Nutrition compact collapsible grid.
  - SEO auto-generation hooks.
- P3:
  - Paste/import ingredients from text.
  - Inline slug edit behavior.
  - Visual progress indicator.

## Acceptance Checklist (Execution-Ready)

- Editor supports complete recipe creation on one page without tab switching.
- Recipe author can fill title/excerpt/image/metadata in top section immediately.
- Ingredients and steps are fast-entry/reorder friendly.
- Nutrition is compact and per-serving value is derived automatically.
- SEO defaults auto-fill but remain editable.
- Publication controls remain available without cluttering primary recipe flow.
- No duplicate/confusing title or servings input patterns.
