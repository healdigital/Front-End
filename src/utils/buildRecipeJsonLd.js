import { stripHtml } from './stripHtml.js';

const getBaseUrl = () => {
  if (typeof process !== 'undefined' && process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL;
  }

  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  return isDev ? 'http://localhost:4321' : 'https://lacuisinedebernard.com';
};

const asText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

const asPositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return Math.round(parsed);
};

const asSlug = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.current === 'string') return value.current;
  return '';
};

const joinUrl = (baseUrl, slug) => `${baseUrl.replace(/\/+$/, '')}/${slug.replace(/^\/+/, '')}`;

const compact = (items) => items.filter(Boolean);

const extractImageUrls = (source) => {
  const direct = compact([
    source?.featuredMedia?.url,
    source?.featuredMedia?.value?.url,
    source?.featuredImage?.url,
    source?.featured_image?.url,
    source?.featured_img_url,
    source?.featuredImageUrl,
  ]);

  const gallery = Array.isArray(source?.imageBlocks)
    ? source.imageBlocks.flatMap((block) => {
        if (block?.blockType !== 'imageGallery' || !Array.isArray(block.images)) return [];
        return block.images
          .map((imageItem) => imageItem?.image?.url || (typeof imageItem?.image === 'string' ? imageItem.image : ''))
          .filter(Boolean);
      })
    : [];

  return Array.from(new Set([...direct, ...gallery]));
};

const extractKeywordString = (source) => {
  if (Array.isArray(source?.tags)) {
    const tagNames = source.tags
      .map((tag) => asText(tag?.name || tag?.title || tag))
      .filter(Boolean);
    return tagNames.join(', ');
  }

  if (Array.isArray(source?.tags?.keyword)) {
    return source.tags.keyword.join(', ');
  }

  if (typeof source?.tags === 'string') {
    return source.tags;
  }

  return '';
};

const extractCategory = (source) => {
  if (Array.isArray(source?.categories) && source.categories.length > 0) {
    return asText(source.categories[0]?.name || source.categories[0]?.title);
  }

  if (Array.isArray(source?.tags?.course) && source.tags.course.length > 0) {
    return asText(source.tags.course[0]);
  }

  return asText(source?.course);
};

const normalizeFromRecipeBlockArticle = (source) => {
  if (!Array.isArray(source?.recipeBlocks) || source.recipeBlocks.length === 0) return null;

  const recipeBlock =
    source.recipeBlocks.find((block) => block?.blockType === 'recipeCard') || source.recipeBlocks[0];
  if (!recipeBlock) return null;

  const ingredients = Array.isArray(recipeBlock.ingredients)
    ? recipeBlock.ingredients
        .map((ingredient) => {
          const quantity = asText(ingredient?.quantity);
          const item = asText(ingredient?.item);
          const notes = asText(ingredient?.notes);
          if (!quantity && !item && !notes) return '';
          const main = [quantity, item].filter(Boolean).join(' ');
          return notes ? `${main} (${notes})`.trim() : main.trim();
        })
        .filter(Boolean)
    : [];

  const instructions = Array.isArray(recipeBlock.steps)
    ? recipeBlock.steps
        .map((step) => asText(step?.instruction))
        .filter(Boolean)
    : [];

  if (ingredients.length === 0 || instructions.length === 0) {
    return null;
  }

  return {
    slug: asSlug(source?.slug),
    name: asText(recipeBlock.title) || asText(source?.title),
    description: stripHtml(asText(source?.excerpt)) || asText(source?.title),
    inLanguage: asText(source?.lang) || asText(source?.language) || 'en',
    imageUrls: extractImageUrls(source),
    authorName: asText(source?.author?.name) || 'Bernard',
    datePublished: asText(source?.date),
    dateModified: asText(source?.modified || source?.updated || source?.date),
    recipeYield: asText(recipeBlock.servings),
    prepMinutes: asPositiveInt(recipeBlock.preparationTimeMinutes),
    cookMinutes: asPositiveInt(recipeBlock.cookingTimeMinutes),
    recipeCategory: extractCategory(source),
    recipeCuisine: asText(source?.cuisine),
    keywords: extractKeywordString(source),
    ingredients,
    instructions,
  };
};

const normalizeLegacyRecipe = (source) => {
  if (!source || typeof source !== 'object') return null;

  const ingredients = Array.isArray(source.ingredients_flat)
    ? source.ingredients_flat
        .filter((item) => item?.type === 'ingredient')
        .map((item) => {
          const quantity = [asText(item.amount), asText(item.unit)].filter(Boolean).join(' ');
          const name = asText(item.name);
          return [quantity, name].filter(Boolean).join(' ').trim();
        })
        .filter(Boolean)
    : [];

  const instructions = Array.isArray(source.instructions_flat)
    ? source.instructions_flat.map((step) => stripHtml(asText(step?.text))).filter(Boolean)
    : [];

  if (ingredients.length === 0 || instructions.length === 0) {
    return null;
  }

  const imageUrls = Array.isArray(source.images)
    ? source.images.filter(Boolean)
    : source.image_url
      ? [source.image_url]
      : [];

  const category =
    Array.isArray(source.tags?.course) && source.tags.course.length > 0
      ? asText(source.tags.course[0])
      : asText(source.course);

  const cuisine =
    Array.isArray(source.tags?.cuisine) && source.tags.cuisine.length > 0
      ? asText(source.tags.cuisine[0])
      : asText(source.cuisine);

  const keywords = extractKeywordString(source);

  return {
    slug: asSlug(source.slug),
    name: asText(source.name || source.title),
    description: stripHtml(asText(source.summary)) || asText(source.name || source.title),
    inLanguage: asText(source.language) || 'en',
    imageUrls,
    authorName: asText(source.author_name) || 'Bernard',
    datePublished: asText(source.date),
    dateModified: asText(source.modified || source.date),
    recipeYield: source.servings
      ? `${asText(source.servings)} ${asText(source.servings_unit)}`.trim()
      : '',
    prepMinutes: asPositiveInt(source.prep_time),
    cookMinutes: asPositiveInt(source.cook_time),
    recipeCategory: category,
    recipeCuisine: cuisine,
    keywords,
    ingredients,
    instructions,
    nutrition: source.nutrition || null,
    rating:
      Number(source.rating_count) > 0
        ? {
            ratingValue: Number(source.rating_average),
            ratingCount: Number(source.rating_count),
          }
        : null,
    video: source.video?.url
      ? {
          name: asText(source.name || source.title),
          description: stripHtml(asText(source.summary)),
          thumbnailUrl: asText(source.video.thumbnail),
          uploadDate: asText(source.video.upload_date),
          contentUrl: asText(source.video.url),
        }
      : null,
  };
};

const removeEmpty = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => removeEmpty(item)).filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const cleanedEntries = Object.entries(value)
      .map(([key, child]) => [key, removeEmpty(child)])
      .filter(([, child]) => child !== undefined);
    if (cleanedEntries.length === 0) return undefined;
    return Object.fromEntries(cleanedEntries);
  }

  if (value === null || value === undefined || value === '') return undefined;
  return value;
};

export function buildRecipeJsonLd(source) {
  const normalized =
    normalizeFromRecipeBlockArticle(source) ||
    normalizeLegacyRecipe(source?.recipe || source);

  if (!normalized || !normalized.slug || !normalized.name) {
    return null;
  }

  const baseUrl = getBaseUrl();
  const canonical = joinUrl(baseUrl, normalized.slug);

  const prep = normalized.prepMinutes;
  const cook = normalized.cookMinutes;
  const total = prep !== null || cook !== null ? Number(prep || 0) + Number(cook || 0) : null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    '@id': `${canonical}#recipe`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    name: normalized.name,
    description: normalized.description || normalized.name,
    inLanguage: normalized.inLanguage,
    image: normalized.imageUrls.length === 1 ? normalized.imageUrls[0] : normalized.imageUrls,
    author: {
      '@type': 'Person',
      name: normalized.authorName || 'Bernard',
    },
    publisher: {
      '@type': 'Organization',
      name: 'La Cuisine de Bernard',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl.replace(/\/+$/, '')}/logo.png`,
      },
    },
    datePublished: normalized.datePublished,
    dateModified: normalized.dateModified || normalized.datePublished,
    recipeYield: normalized.recipeYield,
    prepTime: prep !== null ? `PT${prep}M` : undefined,
    cookTime: cook !== null ? `PT${cook}M` : undefined,
    totalTime: total !== null ? `PT${total}M` : undefined,
    recipeCategory: normalized.recipeCategory,
    recipeCuisine: normalized.recipeCuisine,
    keywords: normalized.keywords,
    recipeIngredient: normalized.ingredients,
    recipeInstructions: normalized.instructions.map((text, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text,
    })),
    nutrition: normalized.nutrition
      ? {
          '@type': 'NutritionInformation',
          calories: normalized.nutrition.calories,
          fatContent: normalized.nutrition.fat,
          carbohydrateContent: normalized.nutrition.carbohydrates,
          proteinContent: normalized.nutrition.protein,
          fiberContent: normalized.nutrition.fiber,
          sugarContent: normalized.nutrition.sugar,
          sodiumContent: normalized.nutrition.sodium,
        }
      : undefined,
    aggregateRating: normalized.rating
      ? {
          '@type': 'AggregateRating',
          ratingValue: normalized.rating.ratingValue,
          ratingCount: normalized.rating.ratingCount,
        }
      : undefined,
    video: normalized.video
      ? {
          '@type': 'VideoObject',
          name: normalized.video.name,
          description: normalized.video.description,
          thumbnailUrl: normalized.video.thumbnailUrl,
          uploadDate: normalized.video.uploadDate,
          contentUrl: normalized.video.contentUrl,
        }
      : undefined,
  };

  return removeEmpty(schema);
}
