import { processArticleImageUrl } from '../src/utils/cdnUrlReplacer.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const preparedJsonPath = path.join(process.cwd(), 'prepared-articles.json');

const maybeRepairMojibake = (value) => {
  const text = String(value || '');
  if (!/(Ã.|Â.|â€|â€™|â€œ|â€|â€“|â€”|â€¦)/.test(text)) return text;

  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
};

const decodeHtmlEntities = (value) =>
  String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

async function generateSearchIndex() {
  try {
    console.log('[SEARCH] Generating search index...');

    const searchLimitRaw = Number(process.env.SEARCH_INDEX_LIMIT);
    const hasSearchLimit = Number.isFinite(searchLimitRaw) && searchLimitRaw > 0;
    if (hasSearchLimit) {
      console.log(`[SEARCH] Using SEARCH_INDEX_LIMIT=${searchLimitRaw} for search-index output only`);
    }

    let articles = [];

    if (fs.existsSync(preparedJsonPath)) {
      try {
        const prepared = JSON.parse(fs.readFileSync(preparedJsonPath, 'utf8'));
        if (Array.isArray(prepared) && prepared.length > 0) {
          articles = prepared;
          console.log(`[SEARCH] Using prepared-articles.json (${prepared.length} articles).`);
        }
      } catch (error) {
        console.warn('[SEARCH] Failed to read prepared-articles.json, falling back to mongo/API:', error?.message || error);
      }
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      // Dynamic import keeps this script compatible with tsx in CJS/ESM contexts.
      const { getAllArticlesFromMongo: getArticles } = await import('../src/lib/mongo.server.ts');
      articles = await getArticles();
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      const payloadApiUrl = process.env.PUBLIC_PAYLOAD_API_URL || process.env.PAYLOAD_API_URL;
      const targetLimit = undefined;
      if (payloadApiUrl) {
        console.warn('[SEARCH] Mongo returned 0 articles. Falling back to Payload API.');
        const pageSize = 100;
        let page = 1;
        let totalPages = 0;
        let safety = 0;
        const fetched = [];

        while (safety < 500) {
          safety += 1;
          const url = `${payloadApiUrl}/articles?limit=${pageSize}&page=${page}&depth=2`;
          const res = await fetch(url);
          if (!res.ok) {
            console.warn(`[SEARCH] Payload API error ${res.status} ${res.statusText}`);
            break;
          }
          const data = await res.json();
          const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
          if (docs.length === 0) break;
          fetched.push(...docs);

          totalPages = Number(data?.totalPages) || totalPages;
          if (totalPages && page >= totalPages) break;

          if (targetLimit && fetched.length >= targetLimit) break;
          if (docs.length < pageSize) break;
          page += 1;
        }

        articles = fetched;
      } else {
        console.warn('[SEARCH] PUBLIC_PAYLOAD_API_URL not set; cannot fallback to Payload API.');
      }
    }

    console.log(`[SEARCH] Found ${articles.length} articles to process`);

    console.log('[SEARCH] Processing articles...');
    const searchIndex = [];
    const homeRecipesIndex = [];
    const total = articles.length;
    const limitedArticles = hasSearchLimit ? articles.slice(0, searchLimitRaw) : articles;

    const stripHtml = (value) =>
      maybeRepairMojibake(decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' ')));
    const countWords = (value) =>
      stripHtml(value)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean).length;

    const richTextToPlain = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return stripHtml(value);
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (!item) return '';
            if (typeof item === 'string') return stripHtml(item);
            if (typeof item === 'object') {
              if (typeof item.text === 'string') return stripHtml(item.text);
              if (Array.isArray(item.children)) {
                return item.children
                  .map((child) => (typeof child?.text === 'string' ? stripHtml(child.text) : ''))
                  .join(' ');
              }
            }
            return '';
          })
          .join(' ');
      }
      if (typeof value === 'object') {
      if (typeof value.text === 'string') return stripHtml(value.text);
        if (Array.isArray(value.children)) {
          return value.children
            .map((child) => (typeof child?.text === 'string' ? stripHtml(child.text) : ''))
            .join(' ');
        }
      }
      return '';
    };

    const entityName = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return stripHtml(value);
      if (typeof value === 'object') {
        return stripHtml(value.name || value.title || value.label || '');
      }
      return '';
    };

    const resolvePublishedAt = (article) => {
      const candidate =
        article?.publishedAt ||
        article?.date ||
        article?.modified ||
        article?.updated ||
        article?.updatedAt ||
        article?.createdAt ||
        '';
      return typeof candidate === 'string' ? candidate : '';
    };

    const getPrimaryRecipeBlock = (article) => {
      const blocks = Array.isArray(article?.recipeBlocks) ? article.recipeBlocks : [];
      if (!blocks.length) return null;
      return blocks.find((block) => block?.blockType === 'recipeCard') || blocks[0];
    };

    const resolvePrepTimeLabel = (article) => {
      const recipeBlock = getPrimaryRecipeBlock(article);
      const candidate =
        recipeBlock?.preparationTimeMinutes ??
        article?.recipe?.prepTime ??
        article?.prepTime ??
        article?.preparationTimeMinutes ??
        article?.preparationTime;

      if (candidate === null || candidate === undefined || candidate === '') return '';
      const asNumber = Number(candidate);
      if (Number.isFinite(asNumber) && asNumber >= 0) {
        return `${Math.round(asNumber)} min`;
      }

      const text = String(candidate).trim();
      if (!text) return '';
      if (/[0-9].*(min|h)/i.test(text)) return text;
      if (/^\d+([.,]\d+)?$/.test(text)) return `${text} min`;
      return '';
    };

    for (let i = 0; i < total; i++) {
      const article = articles[i];
      const recipeBlock = getPrimaryRecipeBlock(article);
      const slug = typeof article.slug === 'string' ? article.slug : article.slug?.current || '';
      const contentText = richTextToPlain(article.content).substring(0, 1000);
      const excerptText = richTextToPlain(article.excerpt);
      const recipeCategoryText = [entityName(recipeBlock?.recipeType), entityName(recipeBlock?.dishType)]
        .filter(Boolean)
        .join(' ');
      const categoryText = Array.isArray(article.categories)
        ? [recipeCategoryText, article.categories.map(entityName).filter(Boolean).join(' ')].filter(Boolean).join(' ')
        : entityName(article.category);
      const tagsText = Array.isArray(article.tags)
        ? article.tags.map(entityName).filter(Boolean).join(' ')
        : '';
      const authorText = entityName(article.author);
      const readingTimeMin = Math.max(1, Math.round((countWords(article.content) || countWords(article.excerpt)) / 200));

      const processedArticle = {
        id: article._id?.toString() || article.id?.toString() || '',
        title: stripHtml(article.title || ''),
        content: contentText,
        excerpt: excerptText,
        slug,
        category: categoryText,
        tags: tagsText,
        author: authorText,
        publishedAt: resolvePublishedAt(article),
        prepTime: resolvePrepTimeLabel(article),
        readingTimeMin,
        featured_image: {
          url: processArticleImageUrl(article),
          alt: stripHtml(article.featured_image?.alt || article.title || ''),
        },
        searchableText: [
          stripHtml(article.title || ''),
          excerptText,
          contentText,
          categoryText,
          tagsText,
          authorText,
        ].join(' ').toLowerCase(),
      };

      if (!hasSearchLimit || i < limitedArticles.length) {
        searchIndex.push(processedArticle);
      }
      homeRecipesIndex.push({
        id: processedArticle.id,
        title: processedArticle.title,
        slug: processedArticle.slug,
        excerpt: processedArticle.excerpt,
        category: processedArticle.category,
        tags: processedArticle.tags,
        prepTime: processedArticle.prepTime,
        publishedAt: processedArticle.publishedAt,
        featured_image: processedArticle.featured_image,
      });

      if ((i + 1) % 10 === 0 || i === total - 1) {
        const progress = ((i + 1) / total * 100).toFixed(1);
        const barWidth = 40;
        const filled = Math.round(((i + 1) / total) * barWidth);
        const bar = '#'.repeat(filled) + '-'.repeat(barWidth - filled);
        process.stdout.write(`\r[SEARCH] Progress: [${bar}] ${i + 1}/${total} (${progress}%)`);
      }
    }

    console.log('\n[SEARCH] Processing complete.');

    const outputPath = path.join(__dirname, '..', 'public', 'search-index.json');
    const homeOutputPath = path.join(__dirname, '..', 'public', 'home-recipes-index.json');
    console.log('[SEARCH] Writing search indexes to files...');
    fs.writeFileSync(outputPath, JSON.stringify(searchIndex));
    fs.writeFileSync(homeOutputPath, JSON.stringify(homeRecipesIndex));

    console.log(`[SEARCH] Search index generated with ${searchIndex.length} articles at ${outputPath}`);
    console.log(`[SEARCH] Home recipes index generated with ${homeRecipesIndex.length} articles at ${homeOutputPath}`);
  } catch (error) {
    console.error('[SEARCH] Error generating search index:', error);
    process.exit(1);
  }
}

generateSearchIndex();
