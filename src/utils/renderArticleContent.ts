import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';

import { replaceCdnUrl } from './cdnUrlReplacer';

type UnknownRecord = Record<string, unknown>;
type LexicalValue = { root: { children: unknown[] } };
type RenderArticleContentOptions = {
  includeContentBlocks?: boolean;
  includeContentV2?: boolean;
  includeImageBlocks?: boolean;
  includeLegacyFallback?: boolean;
  includeRecipeBlocks?: boolean;
  suppressRecipeSummaryTitle?: boolean;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

const escapeHtml = (value: string): string =>
  value
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
    .split("'")
    .join('&#39;');

const escapeAttribute = (value: string): string => escapeHtml(value);

const lexicalNodeHasContent = (node: unknown): boolean => {
  if (!isRecord(node)) return false;

  const text = asText(node.text);
  if (text.length > 0) return true;

  const type = asText(node.type);
  if (type === 'upload' || type === 'relationship' || type === 'block') return true;

  if (Array.isArray(node.children)) {
    return node.children.some((child) => lexicalNodeHasContent(child));
  }

  return false;
};

const isLexicalValue = (value: unknown): boolean => {
  if (!isRecord(value) || !isRecord(value.root)) return false;
  return Array.isArray(value.root.children);
};

const hasLexicalContent = (value: unknown): boolean => {
  if (!isLexicalValue(value)) return false;
  const lexicalValue = value as LexicalValue;
  return lexicalValue.root.children.some((child: unknown) => lexicalNodeHasContent(child));
};

const renderLexicalRichText = (value: unknown): string => {
  if (!hasLexicalContent(value)) return '';

  try {
    return convertLexicalToHTML({
      data: value as LexicalValue,
      disableContainer: true,
    });
  } catch (error) {
    console.error('[contentV2] Failed to render lexical content:', error);
    return '';
  }
};

const renderLegacyArrayContent = (contentBlocks: unknown[]): string =>
  contentBlocks
    .map((block) => {
      if (!isRecord(block)) return '';

      if ((block.type === 'paragraph' || block._type === 'block') && Array.isArray(block.children)) {
        const paragraph = block.children
          .map((child: unknown) => (isRecord(child) ? asText(child.text) : ''))
          .join('');
        return paragraph ? `<p>${escapeHtml(paragraph)}</p>` : '';
      }

      if (block.type === 'heading' || block._type === 'heading') {
        const level = Number(block.level) || 2;
        const safeLevel = level >= 2 && level <= 6 ? level : 2;
        const text = Array.isArray(block.children)
          ? block.children
              .map((child: unknown) => (isRecord(child) ? asText(child.text) : ''))
              .join('')
          : '';
        return text ? `<h${safeLevel}>${escapeHtml(text)}</h${safeLevel}>` : '';
      }

      if (block.type === 'list' || block._type === 'list') {
        const listType = asText(block.listType);
        const tag = listType === 'number' ? 'ol' : 'ul';
        const listItems = Array.isArray(block.children)
          ? block.children
              .map((item: unknown) => {
                if (!isRecord(item) || !Array.isArray(item.children)) return '';
                const text = item.children
                  .map((child: unknown) => (isRecord(child) ? asText(child.text) : ''))
                  .join('');
                return text ? `<li>${escapeHtml(text)}</li>` : '';
              })
              .filter(Boolean)
              .join('')
          : '';
        return listItems ? `<${tag}>${listItems}</${tag}>` : '';
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');

const extractImageAttributes = (tag: string): { alt: string; height: null | number; url: string; width: null | number } | null => {
  if (!tag || typeof tag !== 'string') return null;

  const srcMatch =
    tag.match(/\s(?:src|data-src)=["']([^"']+)["']/i) ||
    tag.match(/\s(?:data-lazy-src|data-original)=["']([^"']+)["']/i);

  const rawUrl = asText(srcMatch?.[1]);
  if (!rawUrl) return null;

  const widthMatch = tag.match(/\swidth=["'](\d+)["']/i);
  const heightMatch = tag.match(/\sheight=["'](\d+)["']/i);
  const altMatch = tag.match(/\salt=["']([^"']*)["']/i);

  return {
    alt: asText(altMatch?.[1]),
    height: toPositiveInt(heightMatch?.[1]),
    url: replaceCdnUrl(rawUrl),
    width: toPositiveInt(widthMatch?.[1]),
  };
};

const extractImageUrlsFromHtml = (html: string): Set<string> => {
  const urls = new Set<string>();
  if (!html || typeof html !== 'string') return urls;

  const imageTagRegex = /<img\b[^>]*>/gi;
  let match: null | RegExpExecArray = null;

  while ((match = imageTagRegex.exec(html))) {
    const image = extractImageAttributes(match[0]);
    if (!image?.url) continue;
    urls.add(image.url);
  }

  return urls;
};

const extractImagesFromHtml = (
  html: string,
): Array<{ alt: string; height: null | number; url: string; width: null | number }> => {
  const images: Array<{ alt: string; height: null | number; url: string; width: null | number }> = [];
  if (!html || typeof html !== 'string') return images;

  const imageTagRegex = /<img\b[^>]*>/gi;
  let match: null | RegExpExecArray = null;

  while ((match = imageTagRegex.exec(html))) {
    const image = extractImageAttributes(match[0]);
    if (!image?.url) continue;
    images.push(image);
  }

  return images;
};

const extractLegacyStepImages = (
  article: UnknownRecord,
): Array<{ alt: string; height: null | number; url: string; width: null | number }> => {
  const legacyHtml = typeof article.content === 'string' ? article.content : '';
  if (!legacyHtml) return [];

  const excludedImageUrls = new Set(
    [
      resolveMedia(article.featuredMedia),
      resolveMedia(article.featuredImage),
      resolveMedia(article.featured_image),
      resolveMedia(article.featured_img_url),
      resolveMedia(article.featured_image_url),
      resolveMedia(article.featuredImageUrl),
    ]
      .map((image) => image?.url)
      .filter(Boolean),
  );
  const seen = new Set<string>();

  return extractImagesFromHtml(legacyHtml).filter((image) => {
    if (!image.url || seen.has(image.url)) return false;
    if (excludedImageUrls.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
};

const renderLegacyImageFallback = (article: UnknownRecord, structuredContent: string): string => {
  const hasRecipeSteps =
    Array.isArray(article.recipeBlocks) &&
    article.recipeBlocks.some(
      (block: unknown) => isRecord(block) && Array.isArray(block.steps) && block.steps.length > 0,
    );
  if (hasRecipeSteps) return '';

  const legacyHtml = typeof article.content === 'string' ? article.content : '';
  if (!legacyHtml) return '';

  const imageTagRegex = /<img\b[^>]*>/gi;
  const alreadyRendered = extractImageUrlsFromHtml(structuredContent);
  const featuredImage = resolveMedia(article.featuredMedia ?? article.featuredImage);
  if (featuredImage?.url) alreadyRendered.add(featuredImage.url);

  const figures: string[] = [];
  const seen = new Set<string>();
  let match: null | RegExpExecArray = null;

  while ((match = imageTagRegex.exec(legacyHtml))) {
    const image = extractImageAttributes(match[0]);
    if (!image?.url || seen.has(image.url) || alreadyRendered.has(image.url)) continue;

    seen.add(image.url);
    const imageDimensions =
      image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';

    figures.push(
      [
        '<figure class="content-v2-legacy-image-fallback-item">',
        `  <img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt || article.title || 'Article image')}" loading="lazy" decoding="async"${imageDimensions} />`,
        '</figure>',
      ].join('\n'),
    );
  }

  if (figures.length === 0) return '';

  return [
    '<section class="content-v2-block content-v2-legacy-image-fallback">',
    '  <div class="content-v2-legacy-image-fallback-grid">',
    figures.join('\n'),
    '  </div>',
    '</section>',
  ].join('\n');
};

const renderIntroductionBlock = (block: AnyRecord): string => {
  const title = asText(block.title) || 'Introduction';
  const body = renderLexicalRichText(block.body);

  if (!body) return '';

  return [
    '<section class="content-v2-block content-v2-introduction">',
    `  <h2>${escapeHtml(title)}</h2>`,
    `  ${body}`,
    '</section>',
  ].join('\n');
};

const renderEditorialNoteBlock = (block: AnyRecord): string => {
  const title = asText(block.title) || 'Note';
  const tone = asText(block.tone);
  const body = renderLexicalRichText(block.body);

  if (!body) return '';

  return [
    '<section class="content-v2-block content-v2-note">',
    tone ? `  <p class="content-v2-note-tone">${escapeHtml(tone)}</p>` : '',
    `  <h3>${escapeHtml(title)}</h3>`,
    `  ${body}`,
    '</section>',
  ]
    .filter(Boolean)
    .join('\n');
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const toPositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const formatMinutes = (value: unknown): string => {
  const numeric = toPositiveNumber(value);
  if (numeric !== null) return `${Math.round(numeric)} min`;
  const text = asText(value);
  return text || '';
};

const normalizeRecipeType = (value: unknown, fallbackSource: string): string => {
  const raw = asText(value).toLowerCase();
  if (raw === 'sweet' || raw === 'sucre' || raw === 'sucree') return 'SWEET';
  if (raw === 'savory' || raw === 'savoury' || raw === 'sale' || raw === 'salee') return 'SAVORY';

  const source = fallbackSource.toLowerCase();
  if (
    source.includes('sucre') ||
    source.includes('sweet') ||
    source.includes('dessert') ||
    source.includes('cake') ||
    source.includes('brioche') ||
    source.includes('chocolate')
  ) {
    return 'SWEET';
  }

  if (
    source.includes('sale') ||
    source.includes('savory') ||
    source.includes('savoury') ||
    source.includes('omelette') ||
    source.includes('gratin') ||
    source.includes('soupe') ||
    source.includes('salade')
  ) {
    return 'SAVORY';
  }

  return 'RECIPE';
};

const renderRecipeCardBlock = (
  block: AnyRecord,
  article?: AnyRecord,
  options: RenderArticleContentOptions = {},
): string => {
  const title = asText(block.title) || 'Recette';
  const prepMinutes = toPositiveNumber(block.preparationTimeMinutes);
  const cookMinutes = toPositiveNumber(block.cookingTimeMinutes);
  const prep = formatMinutes(block.preparationTimeMinutes);
  const cook = formatMinutes(block.cookingTimeMinutes);
  const total = prepMinutes !== null || cookMinutes !== null
    ? `${Math.round((prepMinutes || 0) + (cookMinutes || 0))} min`
    : '';
  const difficulty = asText(block.difficulty);
  const servingsCount = toPositiveInt(block.servingsCount);
  const servingsLabel = asText(block.servings);
  const servings = servingsLabel || (servingsCount !== null ? String(servingsCount) : '');
  const dishType = asText(block.dishType);
  const cuisine = asText(block.cuisine);
  const recipeType = normalizeRecipeType(
    block.recipeType,
    [title, dishType, cuisine, difficulty].filter(Boolean).join(' '),
  );
  const nutrition = isRecord(block.nutrition) ? block.nutrition : {};

  const metaItems = [
    recipeType ? `<li><strong>Type :</strong> ${escapeHtml(recipeType)}</li>` : '',
    prep ? `<li><strong>Préparation :</strong> ${escapeHtml(prep)}</li>` : '',
    cook ? `<li><strong>Cuisson :</strong> ${escapeHtml(cook)}</li>` : '',
    total ? `<li><strong>Total :</strong> ${escapeHtml(total)}</li>` : '',
    difficulty ? `<li><strong>Difficulté :</strong> ${escapeHtml(difficulty)}</li>` : '',
    servings ? `<li><strong>Portions :</strong> ${escapeHtml(servings)}</li>` : '',
    dishType ? `<li><strong>Plat :</strong> ${escapeHtml(dishType)}</li>` : '',
    cuisine ? `<li><strong>Cuisine :</strong> ${escapeHtml(cuisine)}</li>` : '',
  ]
    .filter(Boolean)
    .join('');

  const ingredientGroups = Array.isArray(block.ingredients)
    ? block.ingredients.reduce((groups: Array<{ heading: string; items: string[] }>, ingredient: unknown) => {
        if (!isRecord(ingredient)) return groups;

        if (ingredient.isGroupHeading) {
          const heading = asText(ingredient.groupHeading);
          if (heading) {
            groups.push({ heading, items: [] });
          }
          return groups;
        }

        const quantity = asText(ingredient.quantity);
        const item = asText(ingredient.item);
        const notes = asText(ingredient.notes);
        if (!quantity && !item && !notes) return groups;

        const amountHtml = quantity
          ? `<span class="wprm-recipe-ingredient-amount">${escapeHtml(quantity)}</span>`
          : '';
        const itemHtml = item ? escapeHtml(item) : '';
        const notesText = notes ? ` (${escapeHtml(notes)})` : '';
        const row = [amountHtml, itemHtml].filter(Boolean).join(' ').trim();
        const listItem = `<li class="wprm-recipe-ingredient">${row ? row + notesText : notesText}</li>`;

        if (groups.length === 0) {
          groups.push({ heading: '', items: [listItem] });
        } else {
          groups[groups.length - 1].items.push(listItem);
        }

        return groups;
      }, [])
    : [];

  const ingredientsList = ingredientGroups
    .map((group) => {
      if (group.items.length === 0) return '';
      return [
        '<div class="wprm-recipe-ingredient-group">',
        group.heading
          ? `  <h4 class="wprm-recipe-group-name wprm-recipe-ingredient-group-name">${escapeHtml(group.heading)}</h4>`
          : '',
        `  <ul class="wprm-recipe-ingredients">${group.items.join('')}</ul>`,
        '</div>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const legacyStepImages = article ? extractLegacyStepImages(article) : [];
  let fallbackStepImageIndex = 0;

  const stepGroups = Array.isArray(block.steps)
    ? block.steps.reduce(
        (
          groups: Array<
            { heading: string; items: Array<{ caption: string; instruction: string; media: AnyRecord | null }> }
          >,
          step: unknown,
        ) => {
          if (!isRecord(step)) return groups;

          if (step.isGroupHeading) {
            const heading = asText(step.groupHeading);
            if (heading) {
              groups.push({ heading, items: [] });
            }
            return groups;
          }

          const instruction = asText(step.instruction);
          if (!instruction) return groups;

          const explicitMedia =
            resolveMedia(step.image, ['articleStep', 'articleHero', 'gallery']) ||
            resolveMedia(step.imageUrl, ['articleStep', 'articleHero', 'gallery']) ||
            resolveMedia(step.image_url, ['articleStep', 'articleHero', 'gallery']) ||
            resolveMedia(step.media, ['articleStep', 'articleHero', 'gallery']) ||
            resolveMedia(step.photo, ['articleStep', 'articleHero', 'gallery']);
          const fallbackMedia =
            explicitMedia || fallbackStepImageIndex >= legacyStepImages.length
              ? null
              : legacyStepImages[fallbackStepImageIndex];
          const media = explicitMedia || fallbackMedia;

          if (!explicitMedia && fallbackMedia) {
            fallbackStepImageIndex += 1;
          }

          const currentGroup =
            groups.length === 0 ? (groups.push({ heading: '', items: [] }), groups[0]) : groups[groups.length - 1];

          currentGroup.items.push({
            caption: asText(step.imageCaption),
            instruction,
            media,
          });

          return groups;
        },
        [],
      )
    : [];

  const stepRows = stepGroups
    .map((group) => {
      if (group.items.length === 0) return '';

      const groupRows = group.items
        .map((step, index) => {
          const imageDimensions =
            step.media?.width && step.media?.height
              ? ` width="${step.media.width}" height="${step.media.height}"`
              : '';

          return [
            '<li class="content-v2-recipe-visual-step">',
            `  <p class="content-v2-recipe-step-instruction"><span class="content-v2-recipe-step-index">${index + 1}.</span> ${escapeHtml(step.instruction)}</p>`,
            step.media?.url
              ? [
                  '  <figure class="content-v2-recipe-step-media">',
                  `    <img src="${escapeAttribute(step.media.url)}" alt="${escapeAttribute(step.media.alt || step.instruction)}" loading="lazy" decoding="async"${imageDimensions} />`,
                  step.caption ? `    <figcaption>${escapeHtml(step.caption)}</figcaption>` : '',
                  '  </figure>',
                ]
                  .filter(Boolean)
                  .join('\n')
              : '',
            '</li>',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('');

      return [
        '<div class="wprm-recipe-instruction-group">',
        group.heading
          ? `  <h4 class="wprm-recipe-group-name wprm-recipe-instruction-group-name">${escapeHtml(group.heading)}</h4>`
          : '',
        `  <ol class="wprm-recipe-instructions">${groupRows}</ol>`,
        '</div>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const compactSteps = stepGroups
    .map((group) => {
      if (group.items.length === 0) return '';

      return [
        '<div class="wprm-recipe-instruction-group">',
        group.heading
          ? `  <h4 class="wprm-recipe-group-name wprm-recipe-instruction-group-name">${escapeHtml(group.heading)}</h4>`
          : '',
        `  <ol class="wprm-recipe-instructions">${group.items
          .map((step) => `<li>${escapeHtml(step.instruction)}</li>`)
          .join('')}</ol>`,
        '</div>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const nutritionRows = [
    {
      label: 'Calories',
      value: toPositiveNumber(nutrition.caloriesKcal),
      suffix: 'kcal',
    },
    {
      label: 'Protein',
      value: toPositiveNumber(nutrition.proteinGrams),
      suffix: 'g',
    },
    {
      label: 'Carbs',
      value: toPositiveNumber(nutrition.carbohydratesGrams),
      suffix: 'g',
    },
    {
      label: 'Fat',
      value: toPositiveNumber(nutrition.fatGrams),
      suffix: 'g',
    },
    {
      label: 'Fiber',
      value: toPositiveNumber(nutrition.fiberGrams),
      suffix: 'g',
    },
    {
      label: 'Sugar',
      value: toPositiveNumber(nutrition.sugarGrams),
      suffix: 'g',
    },
    {
      label: 'Sodium',
      value: toPositiveNumber(nutrition.sodiumMg),
      suffix: 'mg',
    },
  ]
    .filter((item) => item.value !== null)
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(String(item.value))} ${escapeHtml(item.suffix)}</li>`,
    )
    .join('');

  const topSummaryItems = [
    prep ? { label: 'Temps de préparation', value: prep } : null,
    cook ? { label: 'Temps de cuisson', value: cook } : null,
    dishType ? { label: 'Type de plat', value: dishType } : null,
    cuisine ? { label: 'Cuisine', value: cuisine } : null,
    servings ? { label: 'Portions', value: servings } : null,
    toPositiveNumber(nutrition.caloriesKcal) !== null
      ? { label: 'Calories', value: `${Math.round(toPositiveNumber(nutrition.caloriesKcal) || 0)} kcal` }
      : null,
  ]
    .filter((item): item is { label: string; value: string } => Boolean(item))
    .map(
      (item) =>
        [
          '<div class="content-v2-recipe-summary-item">',
          `  <p class="content-v2-recipe-summary-label">${escapeHtml(item.label)}</p>`,
          `  <p class="content-v2-recipe-summary-value">${escapeHtml(item.value)}</p>`,
          '</div>',
        ].join('\n'),
    )
    .join('\n');

  const tips = renderLexicalRichText(block.tips);
  const personalNotes = renderLexicalRichText(block.personalNotes);

  const recipeId = 'main-recipe';

  const servingsControls = [`
    <button type="button" class="wprm-recipe-adjustable-servings wprm-toggle-active" data-recipe="${recipeId}" data-multiplier="1">1x</button>
    <button type="button" class="wprm-recipe-adjustable-servings" data-recipe="${recipeId}" data-multiplier="2">2x</button>
    <button type="button" class="wprm-recipe-adjustable-servings" data-recipe="${recipeId}" data-multiplier="3">3x</button>
  `].join('');

  const ingredientSection = ingredientsList
    ? [
        '<section class="content-v2-block content-v2-recipe-ingredients">',
        '  <div class="content-v2-recipe-ingredients-header">',
        '    <h2>Ingrédients</h2>',
        `    <div class="wprm-recipe-servings">${servingsControls}</div>`,
        '  </div>',
        `  <div class="content-v2-recipe-ingredients-list wprm-recipe-ingredients-container" data-recipe="${recipeId}" id="recipe-${recipeId}-ingredients">${ingredientsList}</div>`,
        '</section>',
      ].join('\n')
    : '';

  const topSummarySection = topSummaryItems
    ? [
        '<section class="content-v2-block content-v2-recipe-summary-grid-section">',
        !options.suppressRecipeSummaryTitle ? `  <h2>${escapeHtml(title)}</h2>` : '',
        '  <div class="content-v2-recipe-summary-grid">',
        topSummaryItems,
        '  </div>',
        '</section>',
      ].join('\n')
    : '';

  const visualStepsSection = stepRows
    ? [
        '<section class="content-v2-block content-v2-recipe-steps-visual">',
        '  <h2>Étapes en photos</h2>',
        `  <ol class="content-v2-recipe-visual-list">${stepRows}</ol>`,
        '</section>',
      ].join('\n')
    : '';

  const bonAppetitSection = stepRows
    ? [
        '<div class="content-v2-recipe-bon-appetit">',
        '  <p>Bon appétit !</p>',
        '</div>',
      ].join('\n')
    : '';

  const compactRecipeCardSection = [
    '<section class="content-v2-block content-v2-recipe-card">',
    !topSummaryItems ? `  <h2>${escapeHtml(title)}</h2>` : '',
    !topSummaryItems && metaItems ? `  <ul class="content-v2-recipe-meta">${metaItems}</ul>` : '',
    compactSteps && !stepRows
      ? [
          '  <div class="content-v2-recipe-section">',
          '    <h3>Étapes</h3>',
          `    <ol>${compactSteps}</ol>`,
          '  </div>',
        ].join('\n')
      : '',
    nutritionRows
      ? [
          '  <div class="content-v2-recipe-section">',
          '    <h3>Nutrition (par portion)</h3>',
          `    <ul class="content-v2-recipe-nutrition-list">${nutritionRows}</ul>`,
          '  </div>',
        ].join('\n')
      : '',
    tips
      ? [
          '  <div class="content-v2-recipe-section">',
          '    <h3>Astuces</h3>',
          `    ${tips}`,
          '  </div>',
        ].join('\n')
      : '',
    personalNotes
      ? [
          '  <div class="content-v2-recipe-section">',
          '    <h3>Notes</h3>',
          `    ${personalNotes}`,
          '  </div>',
        ].join('\n')
      : '',
    '</section>',
  ]
    .filter(Boolean)
    .join('\n');

  return [topSummarySection, ingredientSection, visualStepsSection, bonAppetitSection, compactRecipeCardSection]
    .filter(Boolean)
    .join('\n');
};

const resolveMedia = (
  value: unknown,
  preferredSizes: string[] = [],
): { alt: string; height: null | number; url: string; width: null | number } | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    return value.trim()
      ? {
          alt: '',
          height: null,
          url: replaceCdnUrl(value),
          width: null,
        }
      : null;
  }

  if (!isRecord(value)) return null;

  let selectedURL = '';
  let selectedWidth = toPositiveInt(value.width);
  let selectedHeight = toPositiveInt(value.height);

  const sizes = isRecord(value.sizes) ? value.sizes : null;
  if (sizes && preferredSizes.length > 0) {
    for (const sizeName of preferredSizes) {
      const sizeCandidate = sizes[sizeName];
      if (!isRecord(sizeCandidate)) continue;

      const sizedURL = asText(sizeCandidate.url);
      if (!sizedURL) continue;

      selectedURL = sizedURL;
      selectedWidth = toPositiveInt(sizeCandidate.width) ?? selectedWidth;
      selectedHeight = toPositiveInt(sizeCandidate.height) ?? selectedHeight;
      break;
    }
  }

  if (!selectedURL) {
    selectedURL = asText(value.url);
  }

  const url = selectedURL;
  if (!url) return null;

  return {
    alt: asText(value.alt),
    height: selectedHeight,
    url: replaceCdnUrl(url),
    width: selectedWidth,
  };
};

const renderImageGalleryBlock = (block: AnyRecord): string => {
  const title = asText(block.title) || 'Image gallery';
  const images = Array.isArray(block.images)
    ? block.images
        .map((entry: unknown) => {
          if (!isRecord(entry)) return '';
          const media = resolveMedia(entry.image, ['gallery', 'articleStep', 'articleHero']);
          if (!media?.url) return '';

          const caption = asText(entry.caption);
          const imageDimensions =
            media.width && media.height ? ` width="${media.width}" height="${media.height}"` : '';
          return [
            '  <figure class="content-v2-gallery-item">',
            `    <img src="${escapeAttribute(media.url)}" alt="${escapeAttribute(media.alt || caption || title)}" loading="lazy" decoding="async"${imageDimensions} />`,
            caption ? `    <figcaption>${escapeHtml(caption)}</figcaption>` : '',
            '  </figure>',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .filter(Boolean)
        .join('\n')
    : '';

  if (!images) return '';

  return [
    '<section class="content-v2-block content-v2-gallery">',
    `  <h2>${escapeHtml(title)}</h2>`,
    '  <div class="content-v2-gallery-grid">',
    images,
    '  </div>',
    '</section>',
  ].join('\n');
};

const renderBlocks = (
  blocks: unknown,
  article?: AnyRecord,
  options: RenderArticleContentOptions = {},
): string => {
  if (!Array.isArray(blocks)) return '';

  return blocks
    .map((block) => {
      if (!isRecord(block)) return '';

      switch (block.blockType) {
        case 'introduction':
          return renderIntroductionBlock(block);
        case 'editorialNote':
          return renderEditorialNoteBlock(block);
        case 'recipeCard':
          return renderRecipeCardBlock(block, article, options);
        case 'imageGallery':
          return renderImageGalleryBlock(block);
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
};

const renderStructuredContent = (article: AnyRecord, options: RenderArticleContentOptions = {}): string => {
  const structuredContent = [
    options.includeRecipeBlocks === false ? '' : renderBlocks(article.recipeBlocks, article, options),
    options.includeContentV2 === false ? '' : renderLexicalRichText(article.contentV2),
    options.includeContentBlocks === false ? '' : renderBlocks(article.contentBlocks, article, options),
    options.includeImageBlocks === false ? '' : renderBlocks(article.imageBlocks, article, options),
  ]
    .filter(Boolean)
    .join('\n');

  if (!structuredContent) return '';

  const legacyImageFallback = renderLegacyImageFallback(article, structuredContent);
  return [structuredContent, legacyImageFallback].filter(Boolean).join('\n');
};

export const renderArticleContent = (
  article: unknown,
  options: RenderArticleContentOptions = {},
): string => {
  if (!isRecord(article)) return '';

  const structuredContent = renderStructuredContent(article, options);
  if (structuredContent) return structuredContent;

  if (options.includeLegacyFallback === false) return '';

  if (typeof article.content === 'string') return article.content;
  if (isLexicalValue(article.content)) return renderLexicalRichText(article.content);
  if (Array.isArray(article.content)) return renderLegacyArrayContent(article.content);

  return '';
};
