import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const args = process.argv.slice(2);

const getArgValue = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const hasFlag = (flag) => args.includes(flag);

const inputArg = getArgValue('--input', 'old-article.json');
const outputArg = getArgValue('--out', 'tmp/old-recipes-editor-shape.json');
const slugArg = getArgValue('--slug', '');

const inputPath = path.resolve(process.cwd(), inputArg);
const outputPath = path.resolve(process.cwd(), outputArg);

const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  agrave: '\u00e0',
  auml: '\u00e4',
  ccedil: '\u00e7',
  ecirc: '\u00ea',
  egrave: '\u00e8',
  eacute: '\u00e9',
  gt: '>',
  hellip: '...',
  icirc: '\u00ee',
  laquo: '\u00ab',
  ldquo: '\u201c',
  lsquo: '\u2018',
  lt: '<',
  mdash: '-',
  nbsp: ' ',
  ndash: '-',
  oelig: '\u0153',
  raquo: '\u00bb',
  rdquo: '\u201d',
  quot: '"',
  rsquo: '\u2019',
  ucirc: '\u00fb',
  ugrave: '\u00f9',
};

const decodeHtmlEntities = (value) =>
  String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => NAMED_ENTITIES[name.toLowerCase()] ?? `&${name};`);

const maybeRepairMojibake = (value) => {
  const text = String(value || '');
  if (!/(?:\u00c3.|\u00c2.|\u00e2.|\u00c5.)/.test(text)) return text;

  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
};

const stripNoiseFromHtml = (html) =>
  String(html || '')
    .replace(/<div[^>]*class="[^"]*xs_social_share_widget[^"]*"[\s\S]*?<\/div>\s*/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

const cleanHtmlToText = (html) =>
  maybeRepairMojibake(
    decodeHtmlEntities(
      stripNoiseFromHtml(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const normalizeSentence = (value) => cleanHtmlToText(value).replace(/\s+/g, ' ').trim();

const getRendered = (field) => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && typeof field.rendered === 'string') return field.rendered;
  return '';
};

const createObjectId = () => randomBytes(12).toString('hex');

const toNumber = (value) => {
  const normalized = String(value ?? '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRoundedPositiveInt = (value, fallback = 1) => {
  const parsed = toNumber(value);
  if (parsed === null || parsed <= 0) return fallback;
  return Math.max(1, Math.round(parsed));
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

const makeParagraph = (text) => ({
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text,
      type: 'text',
      version: 1,
    },
  ],
  direction: null,
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
  textFormat: 0,
  textStyle: '',
});

const buildRichTextRoot = (paragraphs) => ({
  root: {
    children: (paragraphs.length ? paragraphs : ['']).map(makeParagraph),
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

const extractMeaningfulParagraphs = (...htmlCandidates) => {
  const paragraphs = [];

  for (const candidate of htmlCandidates) {
    const html = stripNoiseFromHtml(candidate);
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;

    while ((match = paragraphRegex.exec(html))) {
      const text = normalizeSentence(match[1]);
      if (text) paragraphs.push(text);
    }
  }

  if (paragraphs.length > 0) {
    return Array.from(new Set(paragraphs));
  }

  const fallbackText = normalizeSentence(firstNonEmpty(...htmlCandidates));
  return fallbackText ? [fallbackText] : [];
};

const buildExcerpt = (source, summaryHtml, contentHtml) => {
  const explicitExcerpt = normalizeSentence(getRendered(source.excerpt));
  if (explicitExcerpt) return explicitExcerpt;

  const summaryText = normalizeSentence(summaryHtml);
  if (summaryText) return summaryText;

  const [firstParagraph] = extractMeaningfulParagraphs(contentHtml);
  return firstParagraph || '';
};

const buildServingsLabel = (recipe, servingsCount) => {
  const amount = normalizeSentence(recipe?.servings);
  const unit = normalizeSentence(recipe?.servings_unit);
  if (amount && unit) return `${amount} ${unit}`.trim();
  if (amount) return amount;
  return String(servingsCount);
};

const mapIngredientGroups = (groups, recipe) => {
  const validGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const preserveGroupName = validGroups.filter((group) => normalizeSentence(group?.name)).length > 1;

  const rows = [];

  for (const group of validGroups) {
    const groupName = normalizeSentence(group?.name);
    const items = Array.isArray(group?.ingredients) ? group.ingredients : [];

    for (const item of items) {
      const quantityParts = [normalizeSentence(item?.amount), normalizeSentence(item?.unit)].filter(Boolean);
      const quantity = quantityParts.join(' ').trim();
      const ingredientName = normalizeSentence(item?.name);
      const notesParts = [];

      if (preserveGroupName && groupName) {
        notesParts.push(groupName);
      }

      const itemNotes = normalizeSentence(item?.notes);
      if (itemNotes) {
        notesParts.push(itemNotes);
      }

      if (!quantity && !ingredientName && notesParts.length === 0) continue;

      rows.push({
        quantity,
        item: ingredientName || 'Ingredient',
        ...(notesParts.length ? { notes: notesParts.join(' | ') } : {}),
        id: createObjectId(),
      });
    }
  }

  if (rows.length > 0) return rows;

  return [
    {
      quantity: '',
      item: recipe?.name ? normalizeSentence(recipe.name) : 'Ingredient',
      id: createObjectId(),
    },
  ];
};

const mapInstructionGroups = (groups) => {
  const validGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const steps = [];

  for (const group of validGroups) {
    const groupName = normalizeSentence(group?.name);
    const instructions = Array.isArray(group?.instructions) ? group.instructions : [];

    instructions.forEach((step, index) => {
      const stepName = normalizeSentence(step?.name);
      const stepText = normalizeSentence(step?.text);
      const parts = [];

      if (groupName && index === 0) parts.push(groupName);
      if (stepName) parts.push(stepName);
      if (stepText) parts.push(stepText);

      const instruction = parts.join(': ').trim();
      if (!instruction) return;

      steps.push({
        instruction,
        id: createObjectId(),
      });
    });
  }

  if (steps.length > 0) return steps;

  return [
    {
      instruction: 'Recipe steps not available.',
      id: createObjectId(),
    },
  ];
};

const mapNutrition = (nutritionSource, servingsCount) => {
  const nutrition = nutritionSource && typeof nutritionSource === 'object' ? nutritionSource : {};
  const caloriesPerServing = toNumber(nutrition.calories);
  const totalCaloriesKcal =
    caloriesPerServing !== null ? Math.round(caloriesPerServing * Math.max(servingsCount, 1) * 10) / 10 : null;

  const mapped = {
    ...(totalCaloriesKcal !== null ? { totalCaloriesKcal } : {}),
    ...(caloriesPerServing !== null ? { caloriesKcal: caloriesPerServing } : {}),
    ...(toNumber(nutrition.protein) !== null ? { proteinGrams: toNumber(nutrition.protein) } : {}),
    ...(toNumber(nutrition.carbohydrates) !== null
      ? { carbohydratesGrams: toNumber(nutrition.carbohydrates) }
      : {}),
    ...(toNumber(nutrition.fat) !== null ? { fatGrams: toNumber(nutrition.fat) } : {}),
    ...(toNumber(nutrition.fiber) !== null ? { fiberGrams: toNumber(nutrition.fiber) } : {}),
    ...(toNumber(nutrition.sugar) !== null ? { sugarGrams: toNumber(nutrition.sugar) } : {}),
    ...(toNumber(nutrition.sodium) !== null ? { sodiumMg: toNumber(nutrition.sodium) } : {}),
  };

  return Object.keys(mapped).length > 0 ? mapped : undefined;
};

const mapFeaturedImage = (source, recipe, title) => {
  const imageUrl = firstNonEmpty(
    recipe?.image_url,
    recipe?.pin_image_url,
    source?.featured_image_src,
    source?.featuredImage?.url,
  );

  if (!imageUrl) return null;

  return {
    url: imageUrl,
    alt: normalizeSentence(title),
    id: String(recipe?.image_id || source?.featured_media || ''),
  };
};

const mapLanguage = (source, recipe) => {
  const recipeLanguage = normalizeSentence(recipe?.language).toLowerCase();
  if (recipeLanguage) return recipeLanguage;

  const link = String(source?.link || '');
  if (/\/en\//i.test(link)) return 'en';
  if (/\/es\//i.test(link)) return 'es';
  if (/\/pt-br\//i.test(link)) return 'pt-br';
  if (/\/ar\//i.test(link)) return 'ar';
  return 'fr';
};

const mapStatus = (source) => (String(source?.status || '').toLowerCase() === 'publish' ? 'published' : 'draft');

const convertRecipeArticle = (source) => {
  const recipe = source?.recipe && typeof source.recipe === 'object' ? source.recipe : {};
  const title = normalizeSentence(firstNonEmpty(recipe.name, getRendered(source.title)));
  const contentHtml = getRendered(source.content);
  const summaryHtml = firstNonEmpty(recipe.summary, getRendered(source.excerpt));
  const introParagraphs = extractMeaningfulParagraphs(summaryHtml, contentHtml);
  const excerpt = buildExcerpt(source, summaryHtml, contentHtml);
  const servingsCount = toRoundedPositiveInt(recipe.servings, 1);
  const nutrition = mapNutrition(recipe.nutrition, servingsCount);
  const status = mapStatus(source);

  const recipeBlock = {
    blockType: 'recipeCard',
    title: 'Recipe card',
    preparationTimeMinutes: Math.max(0, toRoundedPositiveInt(recipe.prep_time, 0)),
    cookingTimeMinutes: Math.max(0, toRoundedPositiveInt(recipe.cook_time, 0)),
    servingsCount,
    difficulty: 'medium',
    recipeType: 'other',
    dishType: '',
    cuisine: '',
    servings: buildServingsLabel(recipe, servingsCount),
    ingredients: mapIngredientGroups(recipe.ingredients, recipe),
    steps: mapInstructionGroups(recipe.instructions),
    ...(nutrition ? { nutrition } : {}),
    id: createObjectId(),
  };

  return {
    createdAt: source?.date ? new Date(source.date).toISOString() : new Date().toISOString(),
    updatedAt: source?.modified ? new Date(source.modified).toISOString() : new Date().toISOString(),
    featuredMedia: null,
    author: null,
    lang: mapLanguage(source, recipe),
    categories: [],
    tags: [],
    recipeBlocks: [recipeBlock],
    seoImage: null,
    noIndex: false,
    readyForPublication: status === 'published',
    translationReviewStatus: 'not_required',
    translationSourceArticle: null,
    autoTranslateNow: false,
    translationReviewedAt: null,
    translationReviewedBy: null,
    featuredImage: mapFeaturedImage(source, recipe, title),
    _status: status,
    contentBlocks: [],
    date: source?.date ? new Date(source.date).toISOString() : new Date().toISOString(),
    modified: source?.modified ? new Date(source.modified).toISOString() : null,
    link: normalizeSentence(source?.link),
    excerpt,
    imageBlocks: [],
    seoDescription: excerpt,
    seoTitle: title,
    slug: normalizeSentence(source?.slug),
    title,
    contentV2: buildRichTextRoot(introParagraphs),
    content: contentHtml,
  };
};

const main = async () => {
  const raw = await fs.readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Expected old-article.json to contain an array.');
  }

  const selected = slugArg ? parsed.filter((entry) => entry?.slug === slugArg) : parsed;
  if (slugArg && selected.length === 0) {
    throw new Error(`No recipe article found for slug "${slugArg}".`);
  }

  const converted = selected.map(convertRecipeArticle);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(converted, null, 2), 'utf8');

  const label = slugArg ? `slug ${slugArg}` : `${converted.length} recipes`;
  console.log(`Converted ${label} -> ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
