# Tracklist: Disqus + DeepL Translation

## Comments (Disqus)
- [x] Add Disqus embed component (`src/components/DisqusComments.astro`)
- [x] Replace Giscus in article pages
- [x] Remove unused Giscus component
- [x] Add `PUBLIC_DISQUS_SHORTNAME` to `.env.example`

## DeepL Translation (Full Page)
- [x] Add Payload endpoint `/api/translate`
- [x] Add `DEEPL_API_KEY` + `DEEPL_API_URL` to `payload-admin/.env.example`
- [x] Update language switchers to use `data-lang` + `.lang-btn`
- [x] Add client-side DeepL translation in `dynamicTranslate.ts`
- [x] Ensure language selection works from header/footer

## Pending (to verify)
- [ ] Set `PUBLIC_TRANSLATE_API_URL` in front-end env
- [ ] Set `DEEPL_API_KEY` in payload-admin env
- [ ] Set `PUBLIC_DISQUS_SHORTNAME` in front-end env
- [ ] Test: change language → full page translated
- [ ] Test: Disqus loads on article detail page
