import fs from 'fs/promises';
import path from 'path';

const args = process.argv.slice(2);

const getArgValue = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const templateArg = getArgValue('--template', 'single-article.json');
const htmlArg = getArgValue('--html', '');
const outputArg = getArgValue('--out', 'tmp/single-article-legacy-merged.json');
const sourcePostFileArg = getArgValue('--source-post-file', '');
const sourceSlugArg = getArgValue('--source-slug', '');
const sourceTitleArg = getArgValue('--source-title', '');

const templatePath = path.resolve(process.cwd(), templateArg);
const htmlPath = htmlArg ? path.resolve(process.cwd(), htmlArg) : '';
const outputPath = path.resolve(process.cwd(), outputArg);
const sourcePostFilePath = sourcePostFileArg ? path.resolve(process.cwd(), sourcePostFileArg) : '';

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
  ndash: '-',
  nbsp: ' ',
  oelig: '\u0153',
  raquo: '\u00bb',
  rdquo: '\u201d',
  quot: '"',
  rsquo: '\u2019',
  ucirc: '\u00fb',
  ugrave: '\u00f9',
};

const TEXT_CORRECTIONS = new Map([
  ['scure roux', 'sucre roux'],
]);

const decodeHtmlEntities = (value) =>
  String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => NAMED_ENTITIES[name.toLowerCase()] ?? `&${name};`);

const maybeRepairMojibake = (value) => {
  const text = String(value || '');
  if (!/[ÃÂâÅ]/.test(text)) return text;

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

const normalizeTextValue = (value) => {
  const normalized = normalizeSentence(value);
  const corrected = TEXT_CORRECTIONS.get(normalized.toLowerCase());
  return corrected || normalized;
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
  const endIndex = endMatch && endMatch.index !== undefined ? startIndex + startMatch[0].length + endMatch.index : html.length;
  return html.slice(startIndex, endIndex);
};

const extractServings = (html, fallbackBlock) => {
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

  if (!amountMatch) {
    return {
      servings: typeof fallbackBlock?.servings === 'string' ? fallbackBlock.servings : '',
      servingsCount: Number(fallbackBlock?.servingsCount) || 1,
    };
  }

  const amountText = normalizeTextValue(amountMatch[1]);
  const unitText = normalizeTextValue(unitMatch?.[1] || '');
  const countMatch = amountText.match(/(\d+(?:[.,]\d+)?)/);
  const fallbackNumeric = dataServingsMatch ? Number(dataServingsMatch[1].replace(',', '.')) : NaN;
  const servingsCount = countMatch
    ? Math.max(1, Math.round(Number(countMatch[1].replace(',', '.'))))
    : Number.isFinite(fallbackNumeric) && fallbackNumeric > 0
      ? Math.max(1, Math.round(fallbackNumeric))
      : 1;

  return {
    servings: [amountText, unitText].filter(Boolean).join(' ').trim(),
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

const inferRecipeType = (templateArticle) => {
  const terms = [
    ...(Array.isArray(templateArticle.categories) ? templateArticle.categories.map((item) => item?.name || '') : []),
    ...(Array.isArray(templateArticle.tags) ? templateArticle.tags.map((item) => item?.name || '') : []),
  ]
    .map((value) => normalizeSentence(value).toLowerCase())
    .filter(Boolean);

  if (terms.some((value) => value.includes('sucré') || value.includes('sweet') || value.includes('dessert'))) {
    return 'sweet';
  }

  if (terms.some((value) => value.includes('salé') || value.includes('savory') || value.includes('savoury'))) {
    return 'savory';
  }

  return 'other';
};

const inferDishType = (recipeType) => {
  if (recipeType === 'sweet') return 'Dessert';
  if (recipeType === 'savory') return 'Main';
  return '';
};

const inferCuisine = (templateArticle, title) => {
  const haystack = `${normalizeSentence(title)} ${normalizeSentence(templateArticle.lang || '')}`.toLowerCase();
  if (haystack.includes('galette des rois') || templateArticle.lang === 'fr') {
    return 'French';
  }
  return '';
};

const normalizeServingsLabel = (label, servingsCount, lang) => {
  const cleaned = normalizeTextValue(label || '');
  if (servingsCount > 0 && lang === 'fr') return `${servingsCount} personnes`;
  if (cleaned && !/^\d+$/.test(cleaned)) return cleaned;
  if (servingsCount > 0) return String(servingsCount);
  return cleaned;
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
    if (/^cr(?:e|\u00e8)me\b/i.test(text)) break;
    paragraphs.push(text);
  }

  return paragraphs.slice(0, 3);
};

const extractGroupedIngredients = (ingredientsHtml) => {
  const groups = [];
  const groupRegex =
    /<h4[^>]*class="[^"]*wprm-recipe-ingredient-group-name[^"]*"[^>]*>([\s\S]*?)<\/h4>\s*<ul[^>]*class="[^"]*wprm-recipe-ingredients[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(ingredientsHtml))) {
    groups.push({
      label: normalizeSentence(groupMatch[1]).replace(/\s*:\s*$/, ''),
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
    const liRegex = /<li[^>]*class="[^"]*wprm-recipe-ingredient[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;

    while ((liMatch = liRegex.exec(group.listHtml))) {
      const liHtml = liMatch[1];
      const quantity = normalizeTextValue(liHtml.match(/wprm-recipe-ingredient-amount[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const unit = normalizeTextValue(liHtml.match(/wprm-recipe-ingredient-unit[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const item = normalizeTextValue(liHtml.match(/wprm-recipe-ingredient-name[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const notes = normalizeTextValue(liHtml.match(/wprm-recipe-ingredient-notes[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');

      if (!item && !quantity && !unit && !notes) continue;

      rows.push({
        quantity: [quantity, unit].filter(Boolean).join(' ').trim(),
        item,
        notes: [group.label, notes].filter(Boolean).join(' | ') || undefined,
      });
    }
  }

  return rows.map((row, index) => ({
    id: createObjectId(),
    quantity: row.quantity,
    item: row.item,
    ...(row.notes ? { notes: row.notes } : {}),
  }));
};

const extractSteps = (instructionsHtml) => {
  const steps = [];
  const stepRegex =
    /<li[^>]*class="[^"]*wprm-recipe-instruction[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*wprm-recipe-instruction-text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi;

  let stepMatch;
  while ((stepMatch = stepRegex.exec(instructionsHtml))) {
    const instruction = normalizeSentence(stepMatch[1]);
    if (!instruction) continue;
    steps.push(instruction);
  }

  return steps.map((instruction) => {
    return {
      id: createObjectId(),
      instruction,
      image: null,
      imageCaption: '',
    };
  });
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

  if (Number.isFinite(next.totalCaloriesKcal) && Number.isFinite(servingsCount) && servingsCount > 0) {
    next.caloriesKcal = Number((next.totalCaloriesKcal / servingsCount).toFixed(2));
  }

  return next;
};

const buildSeoDescription = (excerpt, fallback) => {
  const source = normalizeSentence(excerpt || fallback || '');
  if (!source) return '';
  return source.length > 157 ? `${source.slice(0, 157).trim()}...` : source;
};

const decodeSafe = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeSlug = (value) => {
  if (typeof value !== 'string') return '';
  return decodeSafe(value).trim().replace(/^\/+|\/+$/g, '');
};

const resolveSourcePost = (parsed, sourceSlug, sourceTitle) => {
  const posts = Array.isArray(parsed?.posts) ? parsed.posts : Array.isArray(parsed) ? parsed : [];
  if (posts.length === 0) {
    throw new Error('Source post file does not contain a posts array or top-level array.');
  }

  const normalizedSlug = normalizeSlug(sourceSlug);
  const normalizedTitle = typeof sourceTitle === 'string' ? sourceTitle.trim().toLowerCase() : '';

  const match = posts.find((post) => {
    const postSlug = normalizeSlug(typeof post?.slug === 'string' ? post.slug : post?.slug?.current || '');
    const postTitle = typeof post?.title === 'string' ? post.title.trim().toLowerCase() : '';
    const postLinkSlug = normalizeSlug(typeof post?.link === 'string' ? post.link : '').split('/').filter(Boolean).pop() || '';
    const postContent = typeof post?.content === 'string' ? post.content : post?.content?.rendered || '';
    const recipeTitleMatch = postContent.match(/<h2[^>]*class="[^"]*wprm-recipe-name[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    const recipeTitle = normalizeSentence(recipeTitleMatch?.[1] || '').toLowerCase();
    return (
      (normalizedSlug && (postSlug === normalizedSlug || postLinkSlug === normalizedSlug)) ||
      (normalizedTitle && (postTitle === normalizedTitle || recipeTitle === normalizedTitle))
    );
  });

  if (!match) {
    throw new Error(
      `Could not find source post for slug="${sourceSlug}" title="${sourceTitle}".`,
    );
  }

  return match;
};

const mapSourceMedia = (value) => {
  if (!value || typeof value !== 'object') return {};
  const media = {
    ...value,
  };

  if (typeof media.alt === 'string') {
    media.alt = normalizeSentence(media.alt);
  }

  if (!media.alt && typeof media.title === 'string') {
    media.alt = normalizeSentence(media.title);
  }

  return media;
};

const mapTaxonomyItems = (items) =>
  Array.isArray(items)
    ? items.map((item) => ({
        ...item,
        slug: normalizeSlug(item?.slug || ''),
        name: normalizeSentence(item?.name || ''),
        id: item?.id ?? createObjectId(),
      }))
    : [];

const splitParagraphs = (value) =>
  cleanText(value)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

const mapAuthor = (author, fallbackAuthor) => {
  if (!author || typeof author !== 'object') return fallbackAuthor;
  return {
    ...(fallbackAuthor && typeof fallbackAuthor === 'object' ? fallbackAuthor : {}),
    ...author,
    name: normalizeSentence(author.name || fallbackAuthor?.name || ''),
    email: normalizeSentence(author.email || fallbackAuthor?.email || ''),
    slug: normalizeSlug(author.slug || fallbackAuthor?.slug || ''),
    id: author.id ?? fallbackAuthor?.id ?? createObjectId(),
  };
};

const buildTemplateFromSource = (templateArticle, sourcePost) => {
  const featuredMedia = mapSourceMedia(sourcePost.featured_image || sourcePost.featuredImage || sourcePost.featuredMedia);
  const excerpt = normalizeSentence(sourcePost.excerpt || '');
  const title = normalizeSentence(sourcePost.title || templateArticle.title || '');
  const slug = normalizeSlug(typeof sourcePost.slug === 'string' ? sourcePost.slug : sourcePost.slug?.current || templateArticle.slug || '');
  const sourceId = sourcePost.id ?? sourcePost._id ?? templateArticle.id ?? templateArticle._id ?? createObjectId();

  const next = {
    ...templateArticle,
    id: sourceId,
    _id: sourceId,
    title,
    slug,
    excerpt: excerpt || templateArticle.excerpt,
    seoTitle: title || templateArticle.seoTitle,
    seoDescription: buildSeoDescription(excerpt, templateArticle.seoDescription),
    lang: sourcePost.lang || templateArticle.lang,
    date: sourcePost.date || sourcePost.published_at || sourcePost.createdAt || templateArticle.date,
    author: mapAuthor(sourcePost.author, templateArticle.author),
    categories: mapTaxonomyItems(sourcePost.categories),
    tags: mapTaxonomyItems(sourcePost.tags),
    featuredMedia,
    seoImage: featuredMedia,
    featuredImage: featuredMedia,
    _status: templateArticle._status || 'published',
    contentBlocks: Array.isArray(templateArticle.contentBlocks) ? templateArticle.contentBlocks : [],
    imageBlocks: Array.isArray(templateArticle.imageBlocks) ? templateArticle.imageBlocks : [],
    recipeBlocks: Array.isArray(templateArticle.recipeBlocks) && templateArticle.recipeBlocks.length > 0
      ? templateArticle.recipeBlocks
      : [
          {
            blockType: 'recipeCard',
            title: 'Recipe card',
            preparationTimeMinutes: null,
            cookingTimeMinutes: null,
            servingsCount: 1,
            difficulty: '',
            recipeType: '',
            dishType: '',
            cuisine: '',
            servings: '',
            ingredients: [],
            steps: [],
            nutrition: [],
            id: createObjectId(),
          },
        ],
  };

  if (Object.prototype.hasOwnProperty.call(templateArticle, 'content')) {
    next.content = sourcePost.content || templateArticle.content || '';
  }

  return next;
};

const setIfPresent = (target, source, key, value) => {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    target[key] = value;
  }
};

const mergeArticle = (templateArticle, html, options = {}) => {
  const recipeBlock = Array.isArray(templateArticle.recipeBlocks) && templateArticle.recipeBlocks.length > 0
    ? templateArticle.recipeBlocks[0]
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

  const extractedIntroParagraphs = extractIntroParagraphs(html);
  const preferredParagraphs = Array.isArray(options.preferredParagraphs)
    ? options.preferredParagraphs.filter(Boolean)
    : [];
  const introParagraphs = preferredParagraphs.length > 0 ? preferredParagraphs : extractedIntroParagraphs;
  const excerpt = normalizeSentence(options.preferredExcerpt || '') || introParagraphs[0] || normalizeSentence(templateArticle.excerpt || '');
  const servings = extractServings(html, recipeBlock);
  const preparationTimeMinutes = extractDurationMinutes(html, 'prep', recipeBlock.preparationTimeMinutes);
  const cookingTimeMinutes = extractDurationMinutes(html, 'cook', recipeBlock.cookingTimeMinutes);
  const ingredients = extractIngredients(ingredientsHtml);
  const steps = extractSteps(instructionsHtml);
  const servingsCount = servings.servingsCount || recipeBlock.servingsCount || 1;
  const nutrition = extractNutrition(html, servingsCount, recipeBlock.nutrition);

  const recipeType = inferRecipeType(templateArticle);
  const servingsLabel = normalizeServingsLabel(
    servings.servings || recipeBlock.servings || '',
    servingsCount,
    templateArticle.lang,
  );

  const nextRecipeBlock = {
    ...recipeBlock,
    id: recipeBlock.id || createObjectId(),
    title: recipeBlock.title || 'Recipe card',
    preparationTimeMinutes,
    cookingTimeMinutes,
    servings: servingsLabel,
    servingsCount,
    difficulty: ['easy', 'medium', 'hard'].includes(String(recipeBlock.difficulty || ''))
      ? recipeBlock.difficulty
      : 'medium',
    recipeType,
    dishType: inferDishType(recipeType),
    cuisine: inferCuisine(templateArticle, templateArticle.title),
    ingredients,
    steps,
    nutrition,
  };

  const mergedArticle = {
    ...templateArticle,
    excerpt,
    seoDescription: buildSeoDescription(excerpt, templateArticle.seoDescription),
    recipeBlocks: [nextRecipeBlock],
    contentV2: buildRoot(
      introParagraphs.length > 0
        ? introParagraphs
        : [normalizeSentence(templateArticle.excerpt || templateArticle.title || 'Legacy content imported.')],
    ),
  };

  setIfPresent(mergedArticle, templateArticle, 'content', html);

  return mergedArticle;
};

const main = async () => {
  const templateRaw = await fs.readFile(templatePath, 'utf8');
  const templateParsed = JSON.parse(templateRaw);
  const templateArray = Array.isArray(templateParsed) ? templateParsed : [templateParsed];
  if (templateArray.length === 0) {
    throw new Error('Template JSON is empty.');
  }

  let sourcePost = null;
  if (sourcePostFilePath) {
    const sourceRaw = await fs.readFile(sourcePostFilePath, 'utf8');
    sourcePost = resolveSourcePost(JSON.parse(sourceRaw), sourceSlugArg, sourceTitleArg);
  }

  const html = sourcePost?.content
    ? sourcePost.content
    : htmlPath
      ? await fs.readFile(htmlPath, 'utf8')
      : '';

  if (!html) {
    throw new Error('No HTML source provided. Use --html or --source-post-file.');
  }

  const templateArticle = sourcePost
    ? buildTemplateFromSource(templateArray[0], sourcePost)
    : templateArray[0];

  const sourceExcerptParagraphs = sourcePost?.excerpt ? splitParagraphs(sourcePost.excerpt) : [];
  const mergedArticle = mergeArticle(templateArticle, html, {
    preferredExcerpt: sourcePost?.excerpt || '',
    preferredParagraphs: sourceExcerptParagraphs,
  });
  const output = Array.isArray(templateParsed) ? [mergedArticle] : mergedArticle;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Template: ${path.relative(process.cwd(), templatePath)}`);
  if (sourcePostFilePath) {
    console.log(`Source post file: ${path.relative(process.cwd(), sourcePostFilePath)}`);
    console.log(`Source post slug: ${normalizeSlug(typeof sourcePost?.slug === 'string' ? sourcePost.slug : sourcePost?.slug?.current || '')}`);
  } else {
    console.log(`HTML: ${path.relative(process.cwd(), htmlPath)}`);
  }
  console.log(`Ingredients mapped: ${mergedArticle.recipeBlocks?.[0]?.ingredients?.length || 0}`);
  console.log(`Steps mapped: ${mergedArticle.recipeBlocks?.[0]?.steps?.length || 0}`);
  console.log(`Output: ${path.relative(process.cwd(), outputPath)}`);
};

main().catch((error) => {
  console.error('Merge failed:', error);
  process.exit(1);
});
