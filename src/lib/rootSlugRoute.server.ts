/**
 * Runtime resolution for `/[slug]` recipe pages (ISR / on-demand rendering).
 * Mirrors the former getStaticPaths mapping in src/pages/[slug].astro.
 */
import { payloadFetch } from './payload.client';
import { getAllArticlesFromMongo, getArticleBySlugFromMongo } from './mongo.server';

type ContentValue = string | number | boolean | null | undefined | ContentRecord | ContentValue[];
type ContentRecord = Record<string, ContentValue>;

export type RootSlugArticleEntry = ContentRecord & {
  slug?: string | { current?: string };
  lang?: ContentValue;
  language?: ContentValue;
  locale?: ContentValue;
  recipeBlocks?: unknown[];
  content?: ContentValue;
};

const getBuildLimit = () => {
  const envLimit = Number(process.env.MAX_SSG_ARTICLES);
  const safeEnvLimit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 120;
  return Math.min(safeEnvLimit, 10000);
};

export type RootSlugResolvedProps = {
  article: RootSlugArticleEntry;
  languageSlugMap: Record<string, string>;
  fallbackRecipeArticle: RootSlugArticleEntry | null;
};

export async function resolveRootSlugPageProps(rawSlugParam: string): Promise<RootSlugResolvedProps | null> {
  const normalizeSlugLocal = (value: ContentValue) =>
    String(value || '').replace(/^\/+|\/+$/g, '');
  const decodeSafeSlug = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const normalizeLanguageCode = (value: ContentValue) => {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    if (raw === 'pt' || raw === 'pt_br' || raw === 'ptbr') return 'pt-br';
    if (!raw) return 'fr';
    return raw;
  };
  const getArticleSlugValue = (item: RootSlugArticleEntry): string => {
    const raw =
      typeof item.slug === 'string' ? item.slug : item?.slug?.current || '';
    return normalizeSlugLocal(decodeSafeSlug(raw));
  };
  const normalizeRecipeSlugToken = (value: string): string =>
    normalizeSlugLocal(decodeSafeSlug(value))
      .replace(/^wprm[-_/]+/i, '')
      .replace(/^recipe[-_/]+/i, '');
  const getCoreSlug = (slugValue: string): string => {
    const normalized = normalizeSlugLocal(slugValue);
    const recipePrefixed = normalized.match(/^(en|es|ar|pt-br|pt|zh-hans)\/recipe\/(.+)$/i);
    if (recipePrefixed) return normalizeRecipeSlugToken(recipePrefixed[2]);
    const langPrefixed = normalized.match(/^(en|es|ar|pt-br|pt|zh-hans)\/(.+)$/i);
    if (langPrefixed) return normalizeRecipeSlugToken(langPrefixed[2]);
    return normalizeRecipeSlugToken(normalized);
  };
  const extractRecipeIdFromContent = (value: ContentValue): string => {
    const text =
      typeof value === 'string' ? value : JSON.stringify(value ?? '');
    if (!text) return '';
    const patterns = [
      /wprm[_-]recipe[_-]?(?:id)?\D*(\d{2,})/i,
      /data-recipe-id=["']?(\d{2,})/i,
      /wprm-recipe-container\D*(\d{2,})/i,
      /wprm_print=?(\d{2,})/i,
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match?.[1]) return String(match[1]).trim().toLowerCase();
    }
    return '';
  };
  const toArticlePath = (slugValue: string): string =>
    slugValue ? `/${normalizeSlugLocal(slugValue)}/` : '/';
  const getArticleImageKey = (item: RootSlugArticleEntry): string => {
    const direct =
      (typeof (item as { featured_img_url?: string }).featured_img_url === 'string' &&
        (item as { featured_img_url?: string }).featured_img_url) ||
      (typeof item?.featuredImage?.url === 'string' && item.featuredImage.url) ||
      (typeof item?.featuredMedia?.url === 'string' && item.featuredMedia.url) ||
      (typeof item?.featured_image?.url === 'string' && item.featured_image.url) ||
      '';
    return String(direct || '')
      .trim()
      .toLowerCase();
  };
  const getArticleRecipeKey = (item: RootSlugArticleEntry): string => {
    const rec = item as Record<string, unknown>;
    const direct =
      rec.wprmId ||
      rec.wprm_id ||
      rec.wprmRecipeId ||
      rec.wprm_recipe_id ||
      rec.recipeId ||
      rec.recipe_id ||
      '';
    const directKey = String(direct || '')
      .trim()
      .toLowerCase();
    if (directKey) return directKey;
    return extractRecipeIdFromContent(item?.content);
  };
  const hasRenderableRecipeData = (item: RootSlugArticleEntry): boolean => {
    if (!item || typeof item !== 'object') return false;

    const recipeBlocks = Array.isArray(item?.recipeBlocks)
      ? (item.recipeBlocks as Array<Record<string, unknown>>)
      : [];
    const hasRecipeBlocks = recipeBlocks.some((block) => {
      if (!block || typeof block !== 'object') return false;
      const ingredients = Array.isArray(block.ingredients) ? block.ingredients : [];
      const steps = Array.isArray(block.steps) ? block.steps : [];
      return ingredients.length > 0 || steps.length > 0;
    });
    if (hasRecipeBlocks) return true;

    const contentText =
      typeof item?.content === 'string' ? item.content : JSON.stringify(item?.content ?? '');
    if (!contentText) return false;

    return /wprm-recipe|content-v2-recipe|recipe-ingredients|recipe-steps/i.test(contentText);
  };
  const buildLanguageSlugMapBySlug = (items: RootSlugArticleEntry[]) => {
    type Descriptor = {
      slug: string;
      coreSlug: string;
      lang: string;
      path: string;
      recipeKey: string;
      imageKey: string;
    };

    const descriptors: Descriptor[] = (Array.isArray(items) ? items : [])
      .map((item) => {
        const slug = getArticleSlugValue(item);
        if (!slug) return null;
        const lang = normalizeLanguageCode(
          item?.lang || item?.language || item?.locale,
        );
        return {
          slug,
          coreSlug: getCoreSlug(slug),
          lang,
          path: toArticlePath(slug),
          recipeKey: getArticleRecipeKey(item),
          imageKey: getArticleImageKey(item),
        };
      })
      .filter((item): item is Descriptor => Boolean(item));

    const bySlug = new Map<string, Descriptor[]>();
    const byCoreSlug = new Map<string, Descriptor[]>();
    const byRecipe = new Map<string, Descriptor[]>();
    const byImage = new Map<string, Descriptor[]>();

    for (const descriptor of descriptors) {
      const slugGroup = bySlug.get(descriptor.slug) || [];
      slugGroup.push(descriptor);
      bySlug.set(descriptor.slug, slugGroup);

      if (descriptor.coreSlug) {
        const coreGroup = byCoreSlug.get(descriptor.coreSlug) || [];
        coreGroup.push(descriptor);
        byCoreSlug.set(descriptor.coreSlug, coreGroup);
      }

      if (descriptor.recipeKey) {
        const recipeGroup = byRecipe.get(descriptor.recipeKey) || [];
        recipeGroup.push(descriptor);
        byRecipe.set(descriptor.recipeKey, recipeGroup);
      }

      if (descriptor.imageKey) {
        const imageGroup = byImage.get(descriptor.imageKey) || [];
        imageGroup.push(descriptor);
        byImage.set(descriptor.imageKey, imageGroup);
      }
    }

    const mapBySlug = new Map<string, Record<string, string>>();
    for (const descriptor of descriptors) {
      const mapping: Record<string, string> = {};
      const addTarget = (candidate: Descriptor) => {
        if (!candidate?.lang || !candidate?.path) return;
        mapping[candidate.lang] = candidate.path;
      };

      (bySlug.get(descriptor.slug) || []).forEach(addTarget);
      if (descriptor.coreSlug) {
        (byCoreSlug.get(descriptor.coreSlug) || []).forEach(addTarget);
      }
      if (descriptor.recipeKey) {
        (byRecipe.get(descriptor.recipeKey) || []).forEach(addTarget);
      }
      if (descriptor.imageKey) {
        (byImage.get(descriptor.imageKey) || []).forEach(addTarget);
      }
      addTarget(descriptor);

      mapBySlug.set(descriptor.slug, mapping);
    }

    return mapBySlug;
  };

  const requested = normalizeSlugLocal(decodeSafeSlug(String(rawSlugParam || '').trim()));
  if (!requested) return null;

  // Fast path first: direct slug lookup avoids expensive full-collection scans.
  const directFromMongo = await getArticleBySlugFromMongo(requested);
  if (directFromMongo && typeof directFromMongo === 'object') {
    const item = directFromMongo as RootSlugArticleEntry;
    const slugValue = getArticleSlugValue(item);
    // Build languageSlugMap from translation_group_id siblings if available.
    const languageSlugMap: Record<string, string> = {};
    const itemLang = normalizeLanguageCode(item?.lang || item?.language || item?.locale);
    if (slugValue && itemLang) languageSlugMap[itemLang] = toArticlePath(slugValue);
    const itemImg =
      (typeof (item as { featured_img_url?: string }).featured_img_url === 'string' &&
        (item as { featured_img_url?: string }).featured_img_url) ||
      (typeof item?.featuredImage?.url === 'string' && item.featuredImage.url) ||
      '';
    if (itemImg) {
      try {
        const siblings = await payloadFetch<RootSlugArticleEntry>({
          collection: 'articles',
          query: { 'featuredImage.url': itemImg, depth: 0, limit: 10 },
        });
        for (const sib of siblings || []) {
          const sLang = normalizeLanguageCode(sib?.lang || sib?.language || sib?.locale);
          const sSlug = getArticleSlugValue(sib);
          if (sLang && sSlug) languageSlugMap[sLang] = toArticlePath(sSlug);
        }
      } catch {}
    }
    return {
      article: { ...item, slug: slugValue },
      languageSlugMap,
      fallbackRecipeArticle: item,
    };
  }

  let articles: RootSlugArticleEntry[] = [];
  try {
    articles = await getAllArticlesFromMongo();
  } catch (error) {
    console.error('getAllArticlesFromMongo failed, falling back to Payload:', error);
  }

  if (!articles || articles.length === 0) {
    try {
      const payloadResponse = await payloadFetch<RootSlugArticleEntry>({
        collection: 'articles',
        query: { depth: 0, limit: getBuildLimit() },
      });
      articles = payloadResponse;
    } catch (error) {
      console.error('payloadFetch fallback failed:', error);
    }
  }

  if (!Array.isArray(articles)) return null;

  const languageSlugMapBySlug = buildLanguageSlugMapBySlug(articles);
  const fallbackByCoreSlug = new Map<string, RootSlugArticleEntry>();
  const fallbackByRecipeKey = new Map<string, RootSlugArticleEntry>();
  const fallbackByImageKey = new Map<string, RootSlugArticleEntry>();
  const upsertFallback = (
    map: Map<string, RootSlugArticleEntry>,
    key: string,
    candidate: RootSlugArticleEntry,
  ) => {
    if (!key) return;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, candidate);
      return;
    }

    const existingLang = normalizeLanguageCode(
      existing?.lang || existing?.language || existing?.locale,
    );
    const candidateLang = normalizeLanguageCode(
      candidate?.lang || candidate?.language || candidate?.locale,
    );
    if (existingLang !== 'fr' && candidateLang === 'fr') {
      map.set(key, candidate);
    }
  };

  for (const entry of articles) {
    if (!hasRenderableRecipeData(entry)) continue;

    const entrySlug = getArticleSlugValue(entry);
    const coreSlug = getCoreSlug(entrySlug);
    const recipeKey = getArticleRecipeKey(entry);
    const imageKey = getArticleImageKey(entry);

    upsertFallback(fallbackByCoreSlug, coreSlug, entry);
    upsertFallback(fallbackByRecipeKey, recipeKey, entry);
    upsertFallback(fallbackByImageKey, imageKey, entry);
  }

  const pickPropsForItem = (item: RootSlugArticleEntry): RootSlugResolvedProps => {
    const slugValue = getArticleSlugValue(item);
    const languageSlugMap = languageSlugMapBySlug.get(slugValue) || {};
    const fallbackRecipeArticle =
      fallbackByCoreSlug.get(getCoreSlug(slugValue)) ||
      fallbackByRecipeKey.get(getArticleRecipeKey(item)) ||
      fallbackByImageKey.get(getArticleImageKey(item)) ||
      null;
    return {
      article: { ...item, slug: slugValue },
      languageSlugMap,
      fallbackRecipeArticle,
    };
  };

  const direct = articles.find((item) => getArticleSlugValue(item) === requested);
  if (direct) {
    return pickPropsForItem(direct);
  }

  // Legacy fallback: some records keep language-prefixed recipe slugs.
  const requestedCore = getCoreSlug(requested);
  const byCore = articles.find((item) => {
    const slug = getArticleSlugValue(item);
    return slug && getCoreSlug(slug) === requestedCore;
  });
  if (byCore) {
    return pickPropsForItem(byCore);
  }

  const fromMongo = await getArticleBySlugFromMongo(requested);
  if (fromMongo && typeof fromMongo === 'object') {
    return pickPropsForItem(fromMongo as RootSlugArticleEntry);
  }

  return null;
}

/**
 * `/[lang]/[slug]` and `/[lang]/recipe/[slug]` — resolves to a single article in
 * the target language. Prefers a direct (lang, slug) Payload lookup so articles
 * outside the first 120 in the cached list still match.
 */
export async function resolveLangRecipePageProps(
  langRaw: string,
  slugRaw: string,
): Promise<RootSlugResolvedProps | null> {
  const lang = String(langRaw || '').trim().toLowerCase();
  const slug = String(slugRaw || '').trim().replace(/^\/+|\/+$/g, '');
  if (!lang || !slug) return null;

  const decoded = (() => {
    try { return decodeURIComponent(slug); } catch { return slug; }
  })();

  for (const candidate of new Set([slug, decoded])) {
    try {
      const hits = await payloadFetch<RootSlugArticleEntry>({
        collection: 'articles',
        query: { lang, slug: candidate, depth: 2, limit: 1 },
      });
      const item = hits[0];
      if (!item) continue;
      const rawSlugValue = typeof item?.slug === 'string'
        ? item.slug
        : (item?.slug as { current?: string } | undefined)?.current;
      const slugValue = String(rawSlugValue || '').replace(/^\/+|\/+$/g, '');
      const languageSlugMap: Record<string, string> = {};
      if (slugValue) {
        languageSlugMap[lang] = lang === 'fr' ? `/${slugValue}/` : `/${lang}/${slugValue}/`;
      }
      const itemImg =
        (typeof (item as { featured_img_url?: string }).featured_img_url === 'string' &&
          (item as { featured_img_url?: string }).featured_img_url) ||
        (typeof (item?.featuredImage as { url?: string } | undefined)?.url === 'string'
          ? (item.featuredImage as { url: string }).url
          : '') ||
        '';
      if (itemImg) {
        try {
          const siblings = await payloadFetch<RootSlugArticleEntry>({
            collection: 'articles',
            query: { 'featuredImage.url': itemImg, depth: 0, limit: 10 },
          });
          for (const sib of siblings || []) {
            const sLang = String(sib?.lang || '').toLowerCase();
            const sRaw = typeof sib?.slug === 'string'
              ? sib.slug
              : (sib?.slug as { current?: string } | undefined)?.current;
            const sSlug = String(sRaw || '').replace(/^\/+|\/+$/g, '');
            if (sLang && sSlug) {
              languageSlugMap[sLang] = sLang === 'fr' ? `/${sSlug}/` : `/${sLang}/${sSlug}/`;
            }
          }
        } catch {}
      }
      return {
        article: { ...item, slug: slugValue },
        languageSlugMap,
        fallbackRecipeArticle: item,
      };
    } catch {}
  }

  return resolveRootSlugPageProps(`${lang}/recipe/${slug}`);
}
