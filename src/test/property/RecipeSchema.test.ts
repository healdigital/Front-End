import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { buildRecipeJsonLd } from '../../utils/buildRecipeJsonLd.js';

const wordArb = fc.constantFrom(
  'tarte',
  'chocolat',
  'vanille',
  'citron',
  'poulet',
  'salade',
  'gateau',
  'soupe',
  'noisette',
  'curry',
);

const textArb = fc.array(wordArb, { minLength: 2, maxLength: 8 }).map((words) => words.join(' '));
const slugArb = fc.array(wordArb, { minLength: 2, maxLength: 6 }).map((words) => words.join('-'));

const hasEmptyValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasEmptyValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasEmptyValue(item));
  }

  return value === undefined || value === null || value === '';
};

describe('Property 19: Recipe Schema.org Markup', () => {
  it('always exposes required Schema.org recipe fields for valid payloads', () => {
    fc.assert(
      fc.property(
        slugArb,
        textArb,
        fc.array(textArb, { minLength: 1, maxLength: 12 }),
        fc.array(textArb, { minLength: 1, maxLength: 12 }),
        (slug, title, ingredients, instructions) => {
          const payload = {
            slug,
            name: title,
            summary: `${title} maison`,
            ingredients_flat: ingredients.map((item) => ({
              type: 'ingredient',
              amount: '1',
              unit: 'portion',
              name: item,
            })),
            instructions_flat: instructions.map((step) => ({ text: step })),
            images: [`https://example.com/${slug}.jpg`],
          };

          const jsonLd = buildRecipeJsonLd(payload);
          expect(jsonLd).not.toBeNull();
          expect(jsonLd?.['@context']).toBe('https://schema.org');
          expect(jsonLd?.['@type']).toBe('Recipe');
          expect(jsonLd?.name).toBe(title);
          expect(jsonLd?.recipeIngredient).toHaveLength(ingredients.length);
          expect(jsonLd?.recipeInstructions).toHaveLength(instructions.length);

          expect(
            (jsonLd?.recipeInstructions || []).every(
              (step: any, index: number) =>
                step?.['@type'] === 'HowToStep' &&
                step?.position === index + 1 &&
                typeof step?.text === 'string' &&
                step.text.length > 0,
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('keeps cooking durations consistent when prep/cook times are provided', () => {
    fc.assert(
      fc.property(
        slugArb,
        textArb,
        fc.option(fc.integer({ min: 0, max: 600 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 600 }), { nil: undefined }),
        (slug, title, prepTime, cookTime) => {
          const payload = {
            slug,
            name: title,
            summary: title,
            prep_time: prepTime,
            cook_time: cookTime,
            ingredients_flat: [{ type: 'ingredient', amount: '1', unit: 'piece', name: 'ingredient test' }],
            instructions_flat: [{ text: 'instruction test' }],
            images: [`https://example.com/${slug}.jpg`],
          };

          const jsonLd = buildRecipeJsonLd(payload);
          expect(jsonLd).not.toBeNull();

          if (prepTime === undefined) {
            expect(jsonLd?.prepTime).toBeUndefined();
          } else {
            expect(jsonLd?.prepTime).toBe(`PT${prepTime}M`);
          }

          if (cookTime === undefined) {
            expect(jsonLd?.cookTime).toBeUndefined();
          } else {
            expect(jsonLd?.cookTime).toBe(`PT${cookTime}M`);
          }

          if (prepTime === undefined && cookTime === undefined) {
            expect(jsonLd?.totalTime).toBeUndefined();
          } else {
            const total = Number(prepTime || 0) + Number(cookTime || 0);
            expect(jsonLd?.totalTime).toBe(`PT${total}M`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('never emits undefined/null/empty-string values in generated JSON-LD', () => {
    fc.assert(
      fc.property(
        slugArb,
        textArb,
        fc.option(textArb, { nil: undefined }),
        (slug, title, maybeDescription) => {
          const payload = {
            slug,
            name: title,
            summary: maybeDescription || '',
            ingredients_flat: [{ type: 'ingredient', amount: '', unit: '', name: 'beurre' }],
            instructions_flat: [{ text: 'melanger' }],
            images: [`https://example.com/${slug}.jpg`],
            nutrition: {
              calories: '',
              protein: '',
            },
          };

          const jsonLd = buildRecipeJsonLd(payload);
          expect(jsonLd).not.toBeNull();
          expect(hasEmptyValue(jsonLd)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
