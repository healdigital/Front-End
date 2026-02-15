# Tracklist: Mediavine Integration (Astro)

## Core integration
- [x] Add global Mediavine script hook in `src/layouts/BaseLayout.astro`
- [x] Add ad slot placeholders in article templates
- [x] Add `public/ads.txt` placeholder file
- [x] Add env docs for Mediavine + GA

## Pending (needs client-provided values)
- [ ] Set `PUBLIC_MEDIAVINE_SCRIPT_SRC` (exact script URL from Mediavine)
- [ ] Replace `public/ads.txt` with Mediavine-provided content (no edits)
- [ ] Confirm ad slot names/sizes and adjust slot IDs/min-heights
- [ ] Set `PUBLIC_GA_MEASUREMENT_ID` (if GA is required)

## Validation (staging)
- [ ] View page source → Mediavine script present
- [ ] Open article page → ad requests fire (network tab)
- [ ] No console errors from Mediavine
- [ ] CLS stable (ad slots reserved space)
