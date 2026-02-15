import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';

import { replaceCdnUrl } from './cdnUrlReplacer';

type AnyRecord = Record<string, any>;

const isRecord = (value: unknown): value is AnyRecord =>
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
  const lexicalValue = value as { root: { children: unknown[] } };
  return lexicalValue.root.children.some((child: unknown) => lexicalNodeHasContent(child));
};

const renderLexicalRichText = (value: unknown): string => {
  if (!hasLexicalContent(value)) return '';

  try {
    return convertLexicalToHTML({
      data: value as any,
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

const renderRecipeCardBlock = (block: AnyRecord): string => {
  const title = asText(block.title) || 'Recipe card';
  const prep = asText(block.preparationTimeMinutes);
  const cook = asText(block.cookingTimeMinutes);
  const difficulty = asText(block.difficulty);
  const servings = asText(block.servings);

  const metaItems = [
    prep ? `<li><strong>Prep:</strong> ${escapeHtml(prep)} min</li>` : '',
    cook ? `<li><strong>Cook:</strong> ${escapeHtml(cook)} min</li>` : '',
    difficulty ? `<li><strong>Difficulty:</strong> ${escapeHtml(difficulty)}</li>` : '',
    servings ? `<li><strong>Servings:</strong> ${escapeHtml(servings)}</li>` : '',
  ]
    .filter(Boolean)
    .join('');

  const ingredients = Array.isArray(block.ingredients)
    ? block.ingredients
        .map((ingredient: unknown) => {
          if (!isRecord(ingredient)) return '';
          const quantity = asText(ingredient.quantity);
          const item = asText(ingredient.item);
          const notes = asText(ingredient.notes);
          if (!quantity && !item && !notes) return '';

          const content = [quantity, item].filter(Boolean).join(' ');
          const notesText = notes ? ` (${notes})` : '';
          return `<li>${escapeHtml(`${content}${notesText}`.trim())}</li>`;
        })
        .filter(Boolean)
        .join('')
    : '';

  const steps = Array.isArray(block.steps)
    ? block.steps
        .map((step: unknown) => {
          if (!isRecord(step)) return '';
          const instruction = asText(step.instruction);
          if (!instruction) return '';
          return `<li>${escapeHtml(instruction)}</li>`;
        })
        .filter(Boolean)
        .join('')
    : '';

  const tips = renderLexicalRichText(block.tips);
  const personalNotes = renderLexicalRichText(block.personalNotes);

  return [
    '<section class="content-v2-block content-v2-recipe-card">',
    `  <h2>${escapeHtml(title)}</h2>`,
    metaItems ? `  <ul class="content-v2-recipe-meta">${metaItems}</ul>` : '',
    ingredients
      ? [
          '  <div class="content-v2-recipe-section">',
          '    <h3>Ingredients</h3>',
          `    <ul>${ingredients}</ul>`,
          '  </div>',
        ].join('\n')
      : '',
    steps
      ? [
          '  <div class="content-v2-recipe-section">',
          '    <h3>Steps</h3>',
          `    <ol>${steps}</ol>`,
          '  </div>',
        ].join('\n')
      : '',
    tips
      ? [
          '  <div class="content-v2-recipe-section">',
          '    <h3>Tips</h3>',
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
};

const resolveMedia = (value: unknown): { alt: string; url: string } | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    return value.trim()
      ? {
          alt: '',
          url: replaceCdnUrl(value),
        }
      : null;
  }

  if (!isRecord(value)) return null;

  const url = asText(value.url);
  if (!url) return null;

  return {
    alt: asText(value.alt),
    url: replaceCdnUrl(url),
  };
};

const renderImageGalleryBlock = (block: AnyRecord): string => {
  const title = asText(block.title) || 'Image gallery';
  const images = Array.isArray(block.images)
    ? block.images
        .map((entry: unknown) => {
          if (!isRecord(entry)) return '';
          const media = resolveMedia(entry.image);
          if (!media?.url) return '';

          const caption = asText(entry.caption);
          return [
            '  <figure class="content-v2-gallery-item">',
            `    <img src="${escapeAttribute(media.url)}" alt="${escapeAttribute(media.alt)}" loading="lazy" />`,
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

const renderBlocks = (blocks: unknown): string => {
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
          return renderRecipeCardBlock(block);
        case 'imageGallery':
          return renderImageGalleryBlock(block);
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
};

const renderStructuredContent = (article: AnyRecord): string =>
  [
    renderLexicalRichText(article.contentV2),
    renderBlocks(article.contentBlocks),
    renderBlocks(article.recipeBlocks),
    renderBlocks(article.imageBlocks),
  ]
    .filter(Boolean)
    .join('\n');

export const renderArticleContent = (article: unknown): string => {
  if (!isRecord(article)) return '';

  const structuredContent = renderStructuredContent(article);
  if (structuredContent) return structuredContent;

  if (typeof article.content === 'string') return article.content;
  if (isLexicalValue(article.content)) return renderLexicalRichText(article.content);
  if (Array.isArray(article.content)) return renderLegacyArrayContent(article.content);

  return '';
};
