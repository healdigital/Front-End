# Merge Legacy Single Article Handoff

## Purpose

This note documents the work done around:

- [scripts/merge-legacy-into-single-article.mjs](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/scripts/merge-legacy-into-single-article.mjs)

The goal of this script is:

- take one legacy article source
- extract structured recipe data from legacy HTML / WPRM blocks
- output JSON in the same top-level shape as [single-article.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/single-article.json)
- make it possible to migrate one article at a time before doing all articles

## What Was Done

### 1. Built single-article merger

The script now supports generating one converted article JSON from:

- a template file
- a source post file from `All Articles`
- legacy HTML / WPRM content inside that post

It maps:

- `excerpt`
- `contentV2`
- `recipeBlocks[0].ingredients`
- `recipeBlocks[0].steps`
- `preparationTimeMinutes`
- `cookingTimeMinutes`
- `servings`
- `servingsCount`
- `nutrition`

### 2. Important fixes added

The script was improved to handle these cases:

- source post resolution by:
  - post slug
  - post title
  - post link slug
  - WPRM recipe title inside `content`
- servings fallback from WPRM `data-servings="..."`
- nutrition parsing from WPRM nutrition block
- per-serving `caloriesKcal` calculation from `totalCaloriesKcal / servingsCount`

### 3. Tested on recipe articles

We used and validated this flow on:

- `Galette des rois pommes caramélisées, praliné et Calvados`
- `Dutch Baby aux myrtilles et ricotta au citron`

### 4. Mongo test migration done

One article was updated in Mongo in new-editor shape:

- `Dutch Baby aux myrtilles et ricotta au citron`
- slug: `dutch-baby-aux-myrtilles-et-ricotta-au`

Backups saved before DB updates:

- [tmp/dutch-baby-before-new-editor-update.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/tmp/dutch-baby-before-new-editor-update.json)
- [tmp/dutch-baby-before-nutrition-fix.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/tmp/dutch-baby-before-nutrition-fix.json)

## Current Known Result

For `Dutch Baby aux myrtilles et ricotta au citron`, the Mongo article now has:

- `contentV2`
- `recipeBlocks`
- `ingredients: 9`
- `steps: 9`
- `servingsCount: 2`
- `servings: 2 personnes`
- nutrition:
  - `totalCaloriesKcal: 803`
  - `caloriesKcal: 401.5`
  - `proteinGrams: 30`
  - `carbohydratesGrams: 90`
  - `fatGrams: 37`
  - `fiberGrams: 6`
  - `sugarGrams: 19`
  - `sodiumMg: 358`

## Current Output Files

Generated / used files:

- [tmp/single-article-sample-from-prepared.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/tmp/single-article-sample-from-prepared.json)
- [tmp/galette-des-rois-pommes-caramelisees-praline-et-calvados-converted.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/tmp/galette-des-rois-pommes-caramelisees-praline-et-calvados-converted.json)
- [tmp/legacy-article-parsed.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/tmp/legacy-article-parsed.json)
- [tmp/single-article-legacy-merged.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/tmp/single-article-legacy-merged.json)

## Important Gotchas

### 1. Source post slug may not match frontend article slug

Example:

- in [All Articles/post-7.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/All%20Articles/post-7.json)
- the post slug is Arabic
- but the public `link` and WPRM recipe name point to the French recipe slug

So source resolution cannot rely only on `post.slug`.

### 2. Source language/content should not be translated

Rule followed during this work:

- preserve source content language
- do not translate body text automatically
- only decode entities / fix mojibake where needed

### 3. Nutrition schema is limited

WPRM source may contain more fields than Payload currently stores.

Currently mapped into Payload recipe nutrition:

- `totalCaloriesKcal`
- `caloriesKcal`
- `proteinGrams`
- `carbohydratesGrams`
- `fatGrams`
- `fiberGrams`
- `sugarGrams`
- `sodiumMg`

Not currently stored by schema:

- saturated fat
- polyunsaturated fat
- monounsaturated fat
- trans fat
- cholesterol
- potassium
- vitamin A
- vitamin C
- calcium
- iron

## How To Continue Later

### 1. Review one article conversion

Open:

- [scripts/merge-legacy-into-single-article.mjs](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/scripts/merge-legacy-into-single-article.mjs)
- [single-article.json](/c:/Users/navee/OneDrive/Desktop/PEter/15%20Jan/astro/lcdb-astro/single-article.json)

### 2. Generate one converted article JSON

Example command:

```bash
node scripts/merge-legacy-into-single-article.mjs --template single-article.json --source-post-file "All Articles/post-7.json" --source-slug "dutch-baby-aux-myrtilles-et-ricotta-au" --out tmp/single-article-sample-from-prepared.json
```

Note:

- if `source-slug` does not directly match the JSON post slug, resolver now also tries `link` slug and WPRM recipe title

### 3. Update only one Mongo article

Safe process used:

- fetch existing Mongo article by slug
- save a backup JSON in `tmp/`
- preserve existing relationship IDs:
  - `categories`
  - `tags`
  - `author`
- update only the target article
- verify `contentV2`, `recipeBlocks`, servings, and nutrition after write

## Good Next Steps

When resuming, do this next:

1. create a reusable one-article Mongo updater script
2. feed it:
   - target Mongo article slug
   - converted JSON file path
   - optional source post file
3. test on one more article before bulk migration

## Status

As of 2026-03-19:

- the merge script is usable
- one Mongo article has already been converted safely
- backups exist
- the next sensible step is to formalize the one-article updater into a reusable script
