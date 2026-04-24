import { getAllArticlesFromMongo } from './mongo.server';
import { getPopularSlugViewMap } from './googleAnalytics';
import { buildWpSquareVariantUrl, processArticleImageUrl } from '../utils/cdnUrlReplacer';
import { stripHtml } from '../utils/stripHtml.js';

type SidebarArticle = {
  image: string;
  label: string;
  slug: string;
  title: string;
};

type UnknownRecord = Record<string, unknown>;
type DiscoverableArticle = UnknownRecord & {
  categories?: unknown[];
  content?: unknown;
  cuisine?: unknown;
  date?: string;
  excerpt?: unknown;
  lang?: string;
  modified?: string;
  recipeBlocks?: unknown[];
  seoDescription?: string;
  slug?: string | { current?: string };
  tags?: unknown[];
  title?: unknown;
  updatedAt?: string;
};

const getSlug = (article: DiscoverableArticle): string => {
  const raw = typeof article?.slug === 'string' ? article.slug : article?.slug?.current;
  return String(raw || '').trim().replace(/^\/+|\/+$/g, '');
};

const getTitle = (article: DiscoverableArticle): string => stripHtml(String(article?.title || ''));

const getExcerpt = (article: DiscoverableArticle): string =>
  stripHtml(String(article?.excerpt || article?.seoDescription || article?.content || ''));

const hasRecipe = (article: DiscoverableArticle): boolean =>
  Array.isArray(article?.recipeBlocks) && article.recipeBlocks.length > 0;

const hasCategories = (article: DiscoverableArticle): boolean =>
  Array.isArray(article?.categories) && article.categories.length > 0;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const toText = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return stripHtml(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean).join(' ');
  if (isRecord(value)) {
    for (const candidate of [value.rendered, value.value, value.text, value.title, value.name, value.label]) {
      const text = toText(candidate);
      if (text) return text;
    }
  }
  return '';
};

const normalizeToken = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toSidebarTag = (source: string): string => {
  const normalized = normalizeToken(source);
  if (!normalized) return 'RECETTE';
  if (/(sucre|dessert|sweet|gateau|cake|cookie|brioche|chocolat|tarte|entremet|creme|praline|sable)/.test(normalized)) {
    return 'SUCRÉ';
  }
  if (/(sale|savory|savoury|gratin|omelette|quiche|salade|foie gras|poulet|poisson|soupe|legume|potimarron)/.test(normalized)) {
    return 'SALÉ';
  }
  if (normalized.includes('atelier')) return 'ATELIERS';
  if (normalized.includes('voyage')) return 'VOYAGES';
  if (normalized.includes('reportage')) return 'REPORTAGES';
  if (normalized.includes('selection')) return 'SÉLECTIONS';
  if (normalized.includes('video')) return 'VIDÉOS';
  return source.trim().toUpperCase() || 'RECETTE';
};

const extractSidebarLabel = (article: DiscoverableArticle): string => {
  const categoryLabel = (Array.isArray(article?.categories) ? article.categories : [])
    .map((entry: unknown) => toText(entry))
    .find(Boolean);

  if (categoryLabel) return toSidebarTag(categoryLabel);

  const tagLabel = (Array.isArray(article?.tags) ? article.tags : [])
    .map((entry: unknown) => toText(entry))
    .find(Boolean);

  if (tagLabel) return toSidebarTag(tagLabel);

  const cuisineLabel = toText(article?.cuisine);
  if (cuisineLabel) return toSidebarTag(cuisineLabel);

  return hasRecipe(article) ? 'RECETTE' : 'ARTICLE';
};

type ArticleImageInput = Parameters<typeof processArticleImageUrl>[0];

const buildGaRanking = async (
  articles: DiscoverableArticle[],
): Promise<Map<string, number>> => {
  const articleSlugs = new Set(
    articles
      .map((article) => getSlug(article))
      .filter(Boolean),
  );

  if (!articleSlugs.size) return new Map();

  const viewMap = await getPopularSlugViewMap(250);
  if (!viewMap.size) return new Map();

  const ranking = new Map<string, number>();

  for (const [slug, views] of viewMap.entries()) {
    if (!slug || !articleSlugs.has(slug)) continue;
    ranking.set(slug, views);
  }

  return ranking;
};

const articleScore = (article: DiscoverableArticle): number => {
  const hasImage = Boolean(processArticleImageUrl(article as ArticleImageInput));
  const excerptLength = getExcerpt(article).length;
  const updatedValue = article?.updatedAt || article?.modified || article?.date || '';
  const updatedAt = new Date(String(updatedValue || ''));
  const ageDays = Number.isNaN(updatedAt.getTime())
    ? 9999
    : Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 86_400_000));

  let score = 0;
  if (hasImage) score += 40;
  if (hasRecipe(article)) score += 35;
  if (hasCategories(article)) score += 10;
  score += Math.min(excerptLength, 220) / 10;

  if (ageDays <= 30) score += 24;
  else if (ageDays <= 90) score += 18;
  else if (ageDays <= 365) score += 10;
  else score += 4;

  return score;
};

export async function getPopularSidebarArticles(limit = 5, lang = 'fr'): Promise<SidebarArticle[]> {
  const allArticles = await getAllArticlesFromMongo();
  const localizedArticles = allArticles.filter(
    (article: DiscoverableArticle) => String(article?.lang || 'fr').toLowerCase() === lang.toLowerCase(),
  );
  const gaRanking = await buildGaRanking(localizedArticles);

  const ranked = localizedArticles
    .map((article: DiscoverableArticle) => {
      const slug = getSlug(article);
      const title = getTitle(article);
      const imageSource = processArticleImageUrl(article as ArticleImageInput);
      const image = buildWpSquareVariantUrl(imageSource, 500) || imageSource;
      const gaScore = gaRanking.get(slug) || 0;
      return {
        article,
        score: gaScore > 0 ? gaScore * 1000 + articleScore(article) : articleScore(article),
        gaScore,
        sidebar: {
          title,
          slug: slug ? `/${slug}` : '',
          image,
          label: extractSidebarLabel(article),
        },
      };
    })
    .filter(({ sidebar }) => Boolean(sidebar.slug && sidebar.title && sidebar.image))
    .sort((a, b) => {
      if (a.gaScore !== b.gaScore) return b.gaScore - a.gaScore;
      return b.score - a.score;
    });

  return ranked.slice(0, limit).map((entry) => entry.sidebar);
}
