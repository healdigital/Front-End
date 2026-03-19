import fs from 'fs/promises';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';

const args = process.argv.slice(2);

const getArgValue = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const hasFlag = (flag) => args.includes(flag);

const slugArg = getArgValue('--slug', '');
const idArg = getArgValue('--id', '');
const langArg = getArgValue('--lang', 'fr');
const envArg = getArgValue('--env', 'payload-admin/.env');
const oldRecipesArg = getArgValue('--old-recipes', 'old-article.json');
const backupDirArg = getArgValue('--backup-dir', 'tmp/article-backups');
const previewOutArg = getArgValue('--preview-out', '');
const dryRun = hasFlag('--dry-run');

if (!slugArg && !idArg) {
  console.error('Missing required argument: --slug or --id');
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), envArg);
const oldRecipesPath = path.resolve(process.cwd(), oldRecipesArg);
const backupDir = path.resolve(process.cwd(), backupDirArg);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const previewOutPath = path.resolve(
  process.cwd(),
  previewOutArg || `tmp/${slugArg || idArg}-${langArg}-editor-preview.json`,
);

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
  if (!/[ÃƒÃ‚Ã¢Ã…]/.test(text)) return text;

  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
};

const cleanText = (value) =>
  maybeRepairMojibake(
    decodeHtmlEntities(
      String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
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

const normalizeSentence = (value) => cleanText(value).replace(/\s+/g, ' ').trim();

const getRendered = (field) => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && typeof field.rendered === 'string') return field.rendered;
  return '';
};

const createObjectId = () =>
  `${Math.floor(Date.now() / 1000).toString(16)}${Math.random().toString(16).slice(2, 18)}`.slice(0, 24);

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

const buildRoot = (paragraphs) => ({
  root: {
    children: paragraphs.map(makeParagraph),
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

const extractSection = (html, startRegex, endRegex) => {
  const startMatch = startRegex.exec(html);
  if (!startMatch || startMatch.index === undefined) return '';

  const startIndex = startMatch.index;
  const afterStart = html.slice(startIndex + startMatch[0].length);
  const endMatch = endRegex.exec(afterStart);
  const endIndex = endMatch && endMatch.index !== undefined
    ? startIndex + startMatch[0].length + endMatch.index
    : html.length;
  return html.slice(startIndex, endIndex);
};

const extractServings = (html, fallbackBlock) => {
  const headingMatch = html.match(
    /<h[1-6][^>]*>\s*(?:les\s+)?ingr(?:e|\u00e9)dients?\s+(?:for|pour)\s+([^<:]+?)\s*:?\s*<\/h[1-6]>/i,
  );
  const amountMatch = html.match(
    /class="[^"]*\bwprm-recipe-servings\b[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/i,
  );
  const unitMatch = html.match(
    /class="[^"]*\bwprm-recipe-servings-unit\b[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/i,
  );
  const dataServingsMatch = html.match(/data-servings="(\d+(?:[.,]\d+)?)"/i);

  if (!amountMatch && dataServingsMatch) {
    const numeric = Number(dataServingsMatch[1].replace(',', '.'));
    const servingsCount = Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.round(numeric)) : 1;
    return {
      servings: typeof fallbackBlock?.servings === 'string' && fallbackBlock.servings.trim()
        ? fallbackBlock.servings
        : String(servingsCount),
      servingsCount,
    };
  }

  if (!amountMatch && headingMatch) {
    const headingText = normalizeSentence(headingMatch[1]);
    const countMatch = headingText.match(/(\d+(?:[.,]\d+)?)/);
    const servingsCount = countMatch
      ? Math.max(1, Math.round(Number(countMatch[1].replace(',', '.'))))
      : Number(fallbackBlock?.servingsCount) || 1;

    return {
      servings: headingText || String(servingsCount),
      servingsCount,
    };
  }

  if (!amountMatch) {
    return {
      servings: typeof fallbackBlock?.servings === 'string' ? fallbackBlock.servings : '',
      servingsCount: Number(fallbackBlock?.servingsCount) || 1,
    };
  }

  const amountText = normalizeSentence(amountMatch[1]);
  const unitText = normalizeSentence(unitMatch?.[1] || '');
  const countMatch = amountText.match(/(\d+(?:[.,]\d+)?)/);
  const fallbackNumeric = dataServingsMatch ? Number(dataServingsMatch[1].replace(',', '.')) : NaN;
  const servingsCount = countMatch
    ? Math.max(1, Math.round(Number(countMatch[1].replace(',', '.'))))
    : Number.isFinite(fallbackNumeric) && fallbackNumeric > 0
      ? Math.max(1, Math.round(fallbackNumeric))
      : 1;
  const label = countMatch
    ? [amountText, unitText].filter(Boolean).join(' ').trim()
    : Number.isFinite(fallbackNumeric) && fallbackNumeric > 0
      ? [String(Math.max(1, Math.round(fallbackNumeric))), unitText].filter(Boolean).join(' ').trim()
      : [amountText, unitText].filter(Boolean).join(' ').trim();

  return {
    servings: label,
    servingsCount,
  };
};

const extractDurationMinutes = (html, kind, fallbackValue) => {
  const base = kind === 'prep' ? 'prep_time' : 'cook_time';

  const extractValue = (unit) => {
    const regex = new RegExp(
      `wprm-recipe-${base}\\s+wprm-recipe-${base}-${unit}[^"]*">\\s*([^<]+?)\\s*<`,
      'i',
    );
    const match = html.match(regex);
    if (!match) return 0;
    const numeric = Number(normalizeSentence(match[1]).replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const hours = extractValue('hours');
  const minutes = extractValue('minutes');
  const totalMinutes = Math.round(hours * 60 + minutes);

  if (totalMinutes > 0) return totalMinutes;

  const fallback = Number(fallbackValue);
  return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
};

const extractIntroParagraphs = (html) => {
  const paragraphs = [];
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = paragraphRegex.exec(html))) {
    const text = normalizeSentence(match[1]);
    if (!text) continue;
    if (/^recette pour\b/i.test(text)) break;
    if (/^ingredients?\b/i.test(text)) break;
    if (/^instructions?\b/i.test(text)) break;
    if (/^pr(?:e|\u00e9)paration\b/i.test(text)) break;
    if (/^pour \d+/i.test(text)) break;
    paragraphs.push(text);
  }

  return paragraphs.slice(0, 3);
};

const normalizeGroupLabel = (value) =>
  normalizeSentence(value)
    .replace(/\s*:\s*$/, '')
    .replace(/^recette pour[^:]*:\s*/i, '')
    .trim();

const extractGroupedIngredients = (ingredientsHtml) => {
  const groups = [];
  const groupRegex =
    /<h4[^>]*class="[^"]*wprm-recipe-ingredient-group-name[^"]*"[^>]*>([\s\S]*?)<\/h4>\s*<ul[^>]*class="[^"]*wprm-recipe-ingredients[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(ingredientsHtml))) {
    groups.push({
      label: normalizeGroupLabel(groupMatch[1]),
      listHtml: groupMatch[2],
    });
  }

  if (groups.length > 0) return groups;

  const standaloneListMatch = ingredientsHtml.match(/<ul[^>]*class="[^"]*wprm-recipe-ingredients[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  return standaloneListMatch ? [{ label: '', listHtml: standaloneListMatch[1] }] : [];
};

const extractIngredients = (ingredientsHtml) => {
  const groups = extractGroupedIngredients(ingredientsHtml);
  const rows = [];

  for (const group of groups) {
    if (group.label) {
      rows.push({
        isGroupHeading: true,
        groupHeading: group.label,
        id: createObjectId(),
      });
    }

    const liRegex = /<li[^>]*class="[^"]*wprm-recipe-ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;

    while ((liMatch = liRegex.exec(group.listHtml))) {
      const liHtml = liMatch[1];
      const quantity = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-amount[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const unit = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-unit[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const item = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-name[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const notes = normalizeSentence(liHtml.match(/wprm-recipe-ingredient-notes[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const itemKey = item.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f]+/g, '');

      if (!item && !quantity && !unit && !notes) continue;
      if (!quantity && (itemKey === 'cesttout' || itemKey.startsWith('cesttout'))) continue;

      rows.push({
        quantity: [quantity, unit].filter(Boolean).join(' ').trim(),
        item,
        ...(notes ? { notes } : {}),
        id: createObjectId(),
      });
    }
  }

  return rows;
};

const extractSteps = (instructionsHtml) => {
  const steps = [];
  const stepRegex =
    /<li[^>]*class="[^"]*wprm-recipe-instruction[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*wprm-recipe-instruction-text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi;

  let stepMatch;
  while ((stepMatch = stepRegex.exec(instructionsHtml))) {
    const instruction = normalizeSentence(stepMatch[1]);
    if (!instruction) continue;
    steps.push({
      instruction,
      imageCaption: '',
      id: createObjectId(),
    });
  }

  return steps;
};

const extractNutrition = (html, servingsCount, fallbackNutrition = {}) => {
  const nutritionSection = extractSection(
    html,
    /<div id="recipe-\d+-nutrition"[\s\S]*?>/i,
    /<div class="wprm-spacer"|<div class="wprm-icon-shortcode|<div class="xs_social_share_widget/i,
  );

  if (!nutritionSection) {
    return fallbackNutrition && typeof fallbackNutrition === 'object' ? fallbackNutrition : {};
  }

  const fields = {};
  const aliases = {
    calories: 'totalCaloriesKcal',
    carbohydrates: 'carbohydratesGrams',
    protein: 'proteinGrams',
    fat: 'fatGrams',
    fiber: 'fiberGrams',
    sugar: 'sugarGrams',
    sodium: 'sodiumMg',
  };

  const regex =
    /wprm-nutrition-label-text-nutrition-container-([a-z_]+)[\s\S]*?wprm-nutrition-label-text-nutrition-value"[^>]*>([^<]+)</gi;

  let match;
  while ((match = regex.exec(nutritionSection))) {
    const key = String(match[1] || '').toLowerCase();
    const mappedKey = aliases[key];
    if (!mappedKey) continue;

    const numeric = Number(normalizeSentence(match[2]).replace(',', '.'));
    if (!Number.isFinite(numeric)) continue;
    fields[mappedKey] = numeric;
  }

  const next = {
    ...(fallbackNutrition && typeof fallbackNutrition === 'object' ? fallbackNutrition : {}),
    ...fields,
  };

  if (Number.isFinite(fields.totalCaloriesKcal)) {
    const perServingCalories = fields.totalCaloriesKcal;
    next.totalCaloriesKcal = Number((perServingCalories * Math.max(servingsCount, 1)).toFixed(2));
    next.caloriesKcal = perServingCalories;
  } else if (Number.isFinite(next.totalCaloriesKcal) && Number.isFinite(servingsCount) && servingsCount > 0) {
    next.caloriesKcal = Number((next.totalCaloriesKcal / servingsCount).toFixed(2));
  }

  return next;
};

const buildSeoDescription = (excerpt, fallback) => {
  const source = normalizeSentence(excerpt || fallback || '');
  if (!source) return '';
  return source.length > 157 ? `${source.slice(0, 157).trim()}...` : source;
};

const toRoundedPositiveInt = (value, fallback = 1) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.round(parsed));
};

const extractMeaningfulParagraphs = (...htmlCandidates) => {
  const paragraphs = [];

  for (const candidate of htmlCandidates) {
    const html = String(candidate || '');
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;

    while ((match = paragraphRegex.exec(html))) {
      const text = normalizeSentence(match[1]);
      if (text) paragraphs.push(text);
    }
  }

  return Array.from(new Set(paragraphs)).filter(Boolean);
};

const buildExcerptFromSource = (source, summaryHtml, contentHtml) => {
  const explicitExcerpt = normalizeSentence(getRendered(source.excerpt));
  if (explicitExcerpt) return explicitExcerpt;

  const summaryText = normalizeSentence(summaryHtml);
  if (summaryText) return summaryText;

  const [firstParagraph] = extractMeaningfulParagraphs(contentHtml);
  return firstParagraph || '';
};

const buildServingsLabelFromRecipe = (recipe, servingsCount, lang) => {
  const amount = normalizeSentence(recipe?.servings);
  const unit = normalizeSentence(recipe?.servings_unit);
  const label = [amount, unit].filter(Boolean).join(' ').trim();
  if (label) return label;
  if (servingsCount > 0 && lang === 'fr') return `${servingsCount} personnes`;
  if (servingsCount > 0) return String(servingsCount);
  return '';
};

const mapRecipeIngredientsFromSource = (groups) => {
  const validGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const rows = [];

  for (const group of validGroups) {
    const groupName = normalizeGroupLabel(group?.name);
    if (groupName && !/^recipe for\b/i.test(groupName) && !/^for \d+/i.test(groupName)) {
      rows.push({
        isGroupHeading: true,
        groupHeading: groupName,
        id: createObjectId(),
      });
    }

    const items = Array.isArray(group?.ingredients) ? group.ingredients : [];
    for (const item of items) {
      const quantity = [normalizeSentence(item?.amount), normalizeSentence(item?.unit)].filter(Boolean).join(' ').trim();
      const ingredientName = normalizeSentence(item?.name);
      const notes = normalizeSentence(item?.notes);
      if (!quantity && !ingredientName && !notes) continue;

      rows.push({
        quantity,
        item: ingredientName || 'Ingredient',
        ...(notes ? { notes } : {}),
        id: createObjectId(),
      });
    }
  }

  return rows;
};

const mapRecipeStepsFromSource = (groups) => {
  const validGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const rows = [];

  for (const group of validGroups) {
    const items = Array.isArray(group?.instructions) ? group.instructions : [];
    for (const step of items) {
      const instruction = normalizeSentence(step?.text || step?.name || '');
      if (!instruction) continue;
      rows.push({
        instruction,
        imageCaption: '',
        id: createObjectId(),
      });
    }
  }

  return rows;
};

const mapRecipeNutritionFromSource = (nutritionSource, servingsCount) => {
  const nutrition = nutritionSource && typeof nutritionSource === 'object' ? nutritionSource : {};
  const caloriesPerServing = Number(nutrition.calories);
  const next = {};

  if (Number.isFinite(caloriesPerServing) && caloriesPerServing > 0) {
    next.caloriesKcal = caloriesPerServing;
    next.totalCaloriesKcal = Number((caloriesPerServing * Math.max(servingsCount, 1)).toFixed(2));
  }

  const mappings = [
    ['protein', 'proteinGrams'],
    ['carbohydrates', 'carbohydratesGrams'],
    ['fat', 'fatGrams'],
    ['fiber', 'fiberGrams'],
    ['sugar', 'sugarGrams'],
    ['sodium', 'sodiumMg'],
  ];

  for (const [sourceKey, targetKey] of mappings) {
    const value = Number(nutrition[sourceKey]);
    if (Number.isFinite(value) && value >= 0) {
      next[targetKey] = value;
    }
  }

  return next;
};

const normalizeServingsLabel = (label, servingsCount, lang) => {
  const cleaned = normalizeSentence(label || '');
  if (cleaned && !/^\d+$/.test(cleaned)) return cleaned;
  if (servingsCount > 0 && lang === 'fr') return `${servingsCount} personnes`;
  if (servingsCount > 0) return String(servingsCount);
  return cleaned;
};

const hasMeaningfulTextNodes = (contentV2) => {
  const children = contentV2?.root?.children;
  if (!Array.isArray(children)) return false;

  return children.some((node) =>
    Array.isArray(node?.children) &&
    node.children.some((child) => typeof child?.text === 'string' && child.text.trim().length > 0),
  );
};

const toPreviewDoc = (doc) => JSON.parse(JSON.stringify(doc));

const parseDatabaseUrl = async () => {
  const env = await fs.readFile(envPath, 'utf8');
  const match = env.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error('DATABASE_URL not found in payload-admin/.env');
  return match[1].trim().replace(/^['"]|['"]$/g, '');
};

const findStructuredRecipeSource = async (slug, lang) => {
  if (lang === 'fr') return null;

  const raw = await fs.readFile(oldRecipesPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;

  return (
    parsed.find((entry) => entry?.slug === slug && String(entry?.recipe?.language || '').toLowerCase() === lang) ||
    null
  );
};

const mergeLegacyArticle = (article) => {
  const html = typeof article.content === 'string' ? article.content : '';
  if (!html) {
    throw new Error('Article has no legacy HTML content to parse.');
  }

  const recipeBlock = Array.isArray(article.recipeBlocks) && article.recipeBlocks.length > 0
    ? article.recipeBlocks[0]
    : {};

  const ingredientsHtml = extractSection(
    html,
    /<div id="recipe-\d+-ingredients"[\s\S]*?>/i,
    /<div id="recipe-\d+-instructions"[\s\S]*?>/i,
  );
  const instructionsHtml = extractSection(
    html,
    /<div id="recipe-\d+-instructions"[\s\S]*?>/i,
    /<div class="xs_social_share_widget|<div class="wprm-call-to-action/i,
  );

  const introParagraphs = extractIntroParagraphs(html);
  const existingExcerpt = normalizeSentence(article.excerpt || '');
  const excerpt = existingExcerpt || introParagraphs[0] || normalizeSentence(article.title || '');
  const servings = extractServings(html, recipeBlock);
  const servingsCount = servings.servingsCount || Number(recipeBlock.servingsCount) || 1;

  const nextRecipeBlock = {
    blockType: 'recipeCard',
    title: typeof recipeBlock.title === 'string' && recipeBlock.title.trim() ? recipeBlock.title : 'Recipe card',
    preparationTimeMinutes: extractDurationMinutes(html, 'prep', recipeBlock.preparationTimeMinutes),
    cookingTimeMinutes: extractDurationMinutes(html, 'cook', recipeBlock.cookingTimeMinutes),
    servingsCount,
    difficulty: ['easy', 'medium', 'hard'].includes(String(recipeBlock.difficulty || ''))
      ? recipeBlock.difficulty
      : 'medium',
    recipeType: typeof recipeBlock.recipeType === 'string' && recipeBlock.recipeType.trim()
      ? recipeBlock.recipeType
      : 'other',
    dishType: typeof recipeBlock.dishType === 'string' ? recipeBlock.dishType : '',
    cuisine: typeof recipeBlock.cuisine === 'string' && recipeBlock.cuisine.trim()
      ? recipeBlock.cuisine
      : article.lang === 'fr'
        ? 'French'
        : '',
    servings: normalizeServingsLabel(servings.servings || recipeBlock.servings || '', servingsCount, article.lang),
    ingredients: extractIngredients(ingredientsHtml),
    steps: extractSteps(instructionsHtml),
    nutrition: extractNutrition(html, servingsCount, recipeBlock.nutrition),
    id: recipeBlock.id || createObjectId(),
  };

  const featuredImage = article.featuredImage?.url
    ? article.featuredImage
    : article.featured_img_url
      ? {
          url: article.featured_img_url,
          alt: normalizeSentence(article.title || ''),
          id: '',
        }
      : null;

  return {
    ...article,
    excerpt,
    contentV2: buildRoot(
      introParagraphs.length > 0
        ? introParagraphs
        : [excerpt || normalizeSentence(article.title || 'Legacy content imported.')],
    ),
    recipeBlocks: [nextRecipeBlock],
    ...(featuredImage ? { featuredImage } : {}),
    ...(article.featuredMedia ? { featuredMedia: article.featuredMedia } : {}),
    ...(article.seoImage ? { seoImage: article.seoImage } : {}),
    readyForPublication: article._status === 'published',
    seoTitle: normalizeSentence(article.seoTitle || article.title || ''),
    seoDescription: buildSeoDescription(excerpt, article.seoDescription),
    contentBlocks: Array.isArray(article.contentBlocks) ? article.contentBlocks : [],
    imageBlocks: Array.isArray(article.imageBlocks) ? article.imageBlocks : [],
    noIndex: Boolean(article.noIndex),
    translationReviewStatus: article.translationReviewStatus || 'not_required',
    autoTranslateNow: false,
    updatedAt: new Date().toISOString(),
    migrationStatus: 'editor-migrated-single',
    migrationVersion: 'legacy-html-to-editor-2026-03-19',
    migrationNotes: 'Single-article legacy HTML migration applied into contentV2 and recipeBlocks.',
  };
};

const mergeStructuredRecipeSource = (article, source) => {
  const recipe = source?.recipe && typeof source.recipe === 'object' ? source.recipe : {};
  const contentHtml = getRendered(source.content);
  const summaryHtml = recipe.summary || getRendered(source.excerpt);
  const introParagraphs = [
    ...extractMeaningfulParagraphs(summaryHtml),
    ...(!summaryHtml ? extractMeaningfulParagraphs(contentHtml) : []),
  ];
  const excerpt = buildExcerptFromSource(source, summaryHtml, contentHtml);
  const servingsCount = toRoundedPositiveInt(recipe.servings, 1);
  const existingRecipeBlock = Array.isArray(article.recipeBlocks) && article.recipeBlocks.length > 0
    ? article.recipeBlocks[0]
    : {};
  const currentHtml = typeof article.content === 'string' ? article.content : '';
  const structuredPrep = Math.max(0, Number(recipe.prep_time) || 0);
  const structuredCook = Math.max(0, Number(recipe.cook_time) || 0);

  const nextRecipeBlock = {
    blockType: 'recipeCard',
    title: typeof existingRecipeBlock.title === 'string' && existingRecipeBlock.title.trim()
      ? existingRecipeBlock.title
      : 'Recipe card',
    preparationTimeMinutes:
      structuredPrep > 0
        ? structuredPrep
        : extractDurationMinutes(currentHtml, 'prep', existingRecipeBlock.preparationTimeMinutes),
    cookingTimeMinutes:
      structuredCook > 0
        ? structuredCook
        : extractDurationMinutes(currentHtml, 'cook', existingRecipeBlock.cookingTimeMinutes),
    servingsCount,
    difficulty: ['easy', 'medium', 'hard'].includes(String(existingRecipeBlock.difficulty || ''))
      ? existingRecipeBlock.difficulty
      : 'medium',
    recipeType: typeof existingRecipeBlock.recipeType === 'string' && existingRecipeBlock.recipeType.trim()
      ? existingRecipeBlock.recipeType
      : 'other',
    dishType: typeof existingRecipeBlock.dishType === 'string' ? existingRecipeBlock.dishType : '',
    cuisine: typeof existingRecipeBlock.cuisine === 'string' && existingRecipeBlock.cuisine.trim()
      ? existingRecipeBlock.cuisine
      : '',
    servings: buildServingsLabelFromRecipe(recipe, servingsCount, article.lang),
    ingredients: mapRecipeIngredientsFromSource(recipe.ingredients),
    steps: mapRecipeStepsFromSource(recipe.instructions),
    nutrition: mapRecipeNutritionFromSource(recipe.nutrition, servingsCount),
    id: existingRecipeBlock.id || createObjectId(),
  };

  const featuredImage = article.featuredImage?.url
    ? article.featuredImage
    : article.featured_img_url
      ? {
          url: article.featured_img_url,
          alt: normalizeSentence(article.title || ''),
          id: '',
        }
      : recipe.image_url
        ? {
            url: recipe.image_url,
            alt: normalizeSentence(article.title || source?.title?.rendered || ''),
            id: String(recipe.image_id || ''),
          }
        : null;

  return {
    ...article,
    excerpt,
    content: contentHtml || article.content,
    contentV2: buildRoot(
      introParagraphs.length > 0
        ? introParagraphs
        : [excerpt || normalizeSentence(article.title || 'Legacy content imported.')],
    ),
    recipeBlocks: [nextRecipeBlock],
    ...(featuredImage ? { featuredImage } : {}),
    ...(article.featuredMedia ? { featuredMedia: article.featuredMedia } : {}),
    ...(article.seoImage ? { seoImage: article.seoImage } : {}),
    readyForPublication: article._status === 'published',
    seoTitle: normalizeSentence(article.seoTitle || article.title || source?.title?.rendered || ''),
    seoDescription: buildSeoDescription(excerpt, article.seoDescription),
    contentBlocks: Array.isArray(article.contentBlocks) ? article.contentBlocks : [],
    imageBlocks: Array.isArray(article.imageBlocks) ? article.imageBlocks : [],
    noIndex: Boolean(article.noIndex),
    translationReviewStatus: article.translationReviewStatus || 'not_required',
    autoTranslateNow: false,
    updatedAt: new Date().toISOString(),
    migrationStatus: 'editor-migrated-single',
    migrationVersion: 'structured-recipe-to-editor-2026-03-19',
    migrationNotes: 'Single-article structured recipe migration applied into contentV2 and recipeBlocks.',
  };
};

const main = async () => {
  const uri = await parseDatabaseUrl();
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const collection = client.db().collection('articles');
    let current;

    if (idArg) {
      if (!ObjectId.isValid(idArg)) {
        throw new Error(`Invalid ObjectId: "${idArg}".`);
      }

      current = await collection.findOne({ _id: new ObjectId(idArg), lang: langArg });

      if (!current) {
        throw new Error(`No article found for _id="${idArg}" lang="${langArg}".`);
      }
    } else {
      const matches = await collection
        .find({ slug: slugArg, lang: langArg })
        .limit(2)
        .toArray();

      if (matches.length === 0) {
        throw new Error(`No article found for slug="${slugArg}" lang="${langArg}".`);
      }

      if (matches.length > 1) {
        throw new Error(`Multiple articles found for slug="${slugArg}" lang="${langArg}".`);
      }

      current = matches[0];
    }

    const effectiveSlug = current.slug || slugArg || idArg;
    const effectiveLang = current.lang || langArg;
    const structuredSource = await findStructuredRecipeSource(effectiveSlug, effectiveLang);
    const backupPath = path.join(backupDir, `${effectiveSlug}-${effectiveLang}-${timestamp}-before.json`);
    const merged = structuredSource ? mergeStructuredRecipeSource(current, structuredSource) : mergeLegacyArticle(current);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, JSON.stringify(toPreviewDoc(current), null, 2), 'utf8');
    await fs.mkdir(path.dirname(previewOutPath), { recursive: true });
    await fs.writeFile(previewOutPath, JSON.stringify([toPreviewDoc(merged)], null, 2), 'utf8');

    console.log(`Backup: ${path.relative(process.cwd(), backupPath)}`);
    console.log(`Preview: ${path.relative(process.cwd(), previewOutPath)}`);
    console.log(`Ingredients mapped: ${merged.recipeBlocks?.[0]?.ingredients?.length || 0}`);
    console.log(`Steps mapped: ${merged.recipeBlocks?.[0]?.steps?.length || 0}`);
    console.log(`contentV2 ready: ${hasMeaningfulTextNodes(merged.contentV2)}`);
    console.log(`Source mode: ${structuredSource ? 'structured-recipe' : 'legacy-html'}`);

    if (dryRun) {
      console.log('Dry run only. No database update performed.');
      return;
    }

    const { _id, ...setDoc } = merged;
    await collection.updateOne({ _id: current._id }, { $set: setDoc });
    console.log(`Updated article ${effectiveSlug} (${effectiveLang})`);
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
