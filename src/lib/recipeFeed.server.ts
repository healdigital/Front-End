import { payloadApiUrl } from './payload.client';
import { buildWordPressImageFallbackCandidates, processArticleImageUrl } from '../utils/cdnUrlReplacer';
import { decodeHtmlEntities } from '../utils/decodeHtmlEntities';

type FeedType = 'salees' | 'sucrees';
type SupportedLang = 'fr' | 'en' | 'es' | 'pt-br' | 'ar';

type ArticleRecord = Record<string, unknown>;

export interface RecipeFeedCard {
  href: string;
  title: string;
  excerpt: string;
  prepTime: string;
  difficulty: string;
  category: string;
  image: string;
  imageFallback: string;
  imageFallbackCandidates: string[];
}

export interface RecipeFeedResponse {
  cards: RecipeFeedCard[];
  nextPage: number | null;
  hasMore: boolean;
}

const FEED_CACHE_TTL_MS = 60_000;
const feedBatchCache = new Map<
  string,
  { expiresAt: number; value: RecipeFeedResponse }
>();

const normalizeLanguageCode = (value: unknown): SupportedLang => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'pt' || raw === 'pt_pt' || raw === 'ptbr' || raw === 'pt_br') return 'pt-br';
  if (raw === 'en' || raw === 'es' || raw === 'pt-br' || raw === 'ar') return raw;
  return 'fr';
};

const stripHtml = (value: string) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toText = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return decodeHtmlEntities(stripHtml(value));
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directCandidates = [record.rendered, record.value, record.text, record.title, record.name, record.label];
    for (const candidate of directCandidates) {
      const text = toText(candidate);
      if (text) return text;
    }
    if (Array.isArray(record.children)) {
      return record.children.map((child) => toText(child)).filter(Boolean).join(' ');
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

const extractLabels = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => extractLabels(item));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [record.name, record.title, record.slug, record.label].filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
  }
  return [];
};

const getPrimaryRecipeBlock = (article: ArticleRecord) =>
  Array.isArray(article?.recipeBlocks) ? article.recipeBlocks.find(Boolean) : null;

const classifyArchive = (article: ArticleRecord): FeedType | 'toutes' => {
  const recipeBlock = getPrimaryRecipeBlock(article) as Record<string, unknown> | null;
  const candidateText = [
    ...extractLabels(recipeBlock?.recipeType),
    ...extractLabels(recipeBlock?.dishType),
    ...extractLabels(article?.categories),
    ...extractLabels((article as Record<string, unknown>).category),
    ...extractLabels((article as Record<string, unknown>).tags),
    toText(article?.title),
    toText(article?.excerpt),
  ].join(' ');

  const normalized = normalizeToken(candidateText);
  const sweetKeywords = ['sucre', 'dessert', 'sweet', 'gateau', 'cake', 'cookie', 'brioche', 'chocolat', 'galette', 'tarte', 'creme'];
  const savoryKeywords = ['sale', 'savory', 'omelette', 'quiche', 'gratin', 'soupe', 'salade', 'foie gras', 'poulet', 'poisson', 'legume'];
  const sweetScore = sweetKeywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0);
  const savoryScore = savoryKeywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0);

  if (savoryScore > sweetScore) return 'salees';
  if (sweetScore > savoryScore) return 'sucrees';
  return 'toutes';
};

const formatDuration = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--';
  const whole = Math.round(minutes);
  if (whole >= 60) {
    const hours = Math.floor(whole / 60);
    const mins = whole % 60;
    return mins > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${hours}h`;
  }
  return `${whole} min`;
};

const formatRecipeTime = (article: ArticleRecord): string => {
  const recipeBlock = getPrimaryRecipeBlock(article) as Record<string, unknown> | null;
  const prep = Number(
    recipeBlock?.preparationTimeMinutes ||
      article.preparationTimeMinutes ||
      article.prepTime ||
      article.prep_time,
  );
  const cook = Number(recipeBlock?.cookingTimeMinutes || 0);
  if (Number.isFinite(prep) && prep > 0) {
    const total = prep + (Number.isFinite(cook) && cook > 0 ? cook : 0);
    return formatDuration(total || prep);
  }
  return '25 min';
};

const formatDifficulty = (article: ArticleRecord): string => {
  const recipeBlock = getPrimaryRecipeBlock(article) as Record<string, unknown> | null;
  const recipe = (article.recipe || {}) as Record<string, unknown>;
  const raw = String(recipeBlock?.difficulty || recipe?.difficulty || article?.difficulty || '')
    .trim()
    .toLowerCase();
  if (raw === 'easy' || raw === 'facile') return 'Facile';
  if (raw === 'medium' || raw === 'moyen' || raw === 'moyenne') return 'Moyen';
  if (raw === 'hard' || raw === 'difficile' || raw === 'difficult') return 'Difficile';
  return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : 'Recette';
};

const buildExcerpt = (article: ArticleRecord, fallbackTitle: string): string => {
  const raw = toText(article?.excerpt) || toText(article?.content) || toText(article?.contentV2);
  if (!raw) return `Découvrez ${fallbackTitle.toLowerCase()} sur La Cuisine de Bernard.`;
  return raw.length > 120 ? `${raw.slice(0, 120).trim()}...` : raw;
};

const getSlug = (article: ArticleRecord): string => {
  const raw = typeof article.slug === 'string' ? article.slug : (article.slug as { current?: string } | undefined)?.current;
  return String(raw || '').replace(/^\/+|\/+$/g, '');
};

const getArticleLanguage = (article: ArticleRecord): SupportedLang =>
  normalizeLanguageCode(
    (article as Record<string, unknown>)?.lang ||
      (article as Record<string, unknown>)?.language ||
      (article as Record<string, unknown>)?.locale ||
      'fr',
  );

async function fetchArticlesPage(
  page: number,
  limit: number,
  language: SupportedLang,
): Promise<{ docs: ArticleRecord[]; hasMore: boolean }> {
  const base = String(payloadApiUrl || '').replace(/\/+$/g, '');
  const url = new URL(`${base}/articles`);
  url.searchParams.set('depth', '0');
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('where[lang][equals]', language);
  const res = await fetch(url.toString());
  if (!res.ok) return { docs: [], hasMore: false };
  const data = await res.json();
  const docs = Array.isArray(data?.docs) ? (data.docs as ArticleRecord[]) : [];
  const hasMore = Boolean(data?.hasNextPage) || docs.length === limit;
  return { docs, hasMore };
}

export async function getRecipeFeedBatch(
  type: FeedType,
  page = 1,
  batchSize = 24,
  language: string = 'fr',
): Promise<RecipeFeedResponse> {
  const targetLanguage = normalizeLanguageCode(language);
  const cacheKey = `${type}:${targetLanguage}:p${Math.max(1, page)}:s${Math.max(1, batchSize)}`;
  const cached = feedBatchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const cards: RecipeFeedCard[] = [];
  const pageFetchLimit = Math.min(24, Math.max(12, batchSize));
  const seenSlugs = new Set<string>();
  let cursor = Math.max(1, page);
  let hasMore = true;
  let pagesFetched = 0;
  const maxPagesPerRequest = 1;

  while (cards.length < batchSize && hasMore && pagesFetched < maxPagesPerRequest) {
    pagesFetched += 1;
    const pageData = await fetchArticlesPage(cursor, pageFetchLimit, targetLanguage);
    const docs = pageData.docs;
    hasMore = pageData.hasMore;
    cursor += 1;

    for (const article of docs) {
      if (getArticleLanguage(article) !== targetLanguage) continue;
      if (classifyArchive(article) !== type) continue;
      const slug = getSlug(article);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const fallbackImage = processArticleImageUrl(article) || '';
      const image = fallbackImage;
      cards.push({
        href: `/${slug}`,
        title: decodeHtmlEntities(String(toText(article.title) || slug)),
        excerpt: buildExcerpt(article, slug),
        prepTime: formatRecipeTime(article),
        difficulty: formatDifficulty(article),
        category: type === 'salees' ? 'SALÉ' : 'SUCRE',
        image,
        imageFallback: fallbackImage,
        imageFallbackCandidates: buildWordPressImageFallbackCandidates(image),
      });

      if (cards.length >= batchSize) break;
    }
  }

  const result: RecipeFeedResponse = {
    cards,
    nextPage: hasMore ? cursor : null,
    hasMore,
  };
  feedBatchCache.set(cacheKey, {
    expiresAt: Date.now() + FEED_CACHE_TTL_MS,
    value: result,
  });
  return result;
}

