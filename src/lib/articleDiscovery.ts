import { getAllArticlesFromMongo } from './mongo.server';
import { buildWpSquareVariantUrl, processArticleImageUrl } from '../utils/cdnUrlReplacer';
import { stripHtml } from '../utils/stripHtml.js';

type SidebarArticle = {
  image: string;
  label: string;
  slug: string;
  title: string;
};

const getSlug = (article: any): string => {
  const raw = typeof article?.slug === 'string' ? article.slug : article?.slug?.current;
  return String(raw || '').trim().replace(/^\/+|\/+$/g, '');
};

const getTitle = (article: any): string => stripHtml(String(article?.title || ''));

const getExcerpt = (article: any): string =>
  stripHtml(String(article?.excerpt || article?.seoDescription || article?.content || ''));

const hasRecipe = (article: any): boolean =>
  Array.isArray(article?.recipeBlocks) && article.recipeBlocks.length > 0;

const hasCategories = (article: any): boolean =>
  Array.isArray(article?.categories) && article.categories.length > 0;

const toText = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return stripHtml(value);
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    for (const candidate of [value.rendered, value.value, value.text, value.title, value.name, value.label]) {
      const text = toText(candidate);
      if (text) return text;
    }
  }
  return '';
};

const extractSidebarLabel = (article: any): string => {
  const categoryLabel = (Array.isArray(article?.categories) ? article.categories : [])
    .map((entry: any) => toText(entry))
    .find(Boolean);

  if (categoryLabel) return categoryLabel;

  const tagLabel = (Array.isArray(article?.tags) ? article.tags : [])
    .map((entry: any) => toText(entry))
    .find(Boolean);

  if (tagLabel) return tagLabel;

  const cuisineLabel = toText(article?.cuisine);
  if (cuisineLabel) return cuisineLabel;

  return 'Recettes';
};

const articleScore = (article: any): number => {
  const hasImage = Boolean(processArticleImageUrl(article));
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

  const ranked = allArticles
    .filter((article: any) => String(article?.lang || 'fr').toLowerCase() === lang.toLowerCase())
    .map((article: any) => {
      const slug = getSlug(article);
      const title = getTitle(article);
      const imageSource = processArticleImageUrl(article);
      const image = buildWpSquareVariantUrl(imageSource, 500) || imageSource;
      return {
        article,
        score: articleScore(article),
        sidebar: {
          title,
          slug: slug ? `/${slug}` : '',
          image,
          label: extractSidebarLabel(article),
        },
      };
    })
    .filter(({ sidebar }) => Boolean(sidebar.slug && sidebar.title && sidebar.image))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit).map((entry) => entry.sidebar);
}
