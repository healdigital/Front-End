import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import RecipeCard from './RecipeCard.astro';
import fc from 'fast-check';

describe('RecipeCard Component', () => {

    it('truncates description to 375 characters', async () => {
        const container = await AstroContainer.create();

        await fc.assert(
            fc.asyncProperty(fc.string({ minLength: 1 }).filter(s => /^[a-zA-Z0-9 ]+$/.test(s)), async (description) => {
                const props = {
                    title: 'Test Recipe',
                    slug: 'test-recipe',
                    image: '/test.jpg',
                    description: description,
                    prepTime: '20 min',
                    difficulty: 'Facile'
                };

                const result = await container.renderToString(RecipeCard, { props });

                const MAX_LEN = 375;
                // The truncation logic in component adds "..." if truncated
                const expected = description.length > MAX_LEN
                    ? description.slice(0, MAX_LEN).trim()
                    : description;

                expect(result).toContain(expected);
                if (description.length > MAX_LEN) {
                    expect(result).toContain('...');
                }
            }),
            { numRuns: 20 }
        );
    });

    it('renders image with lazy loading', async () => {
        const container = await AstroContainer.create();
        const props = {
            title: 'Test',
            slug: 'test',
            image: '/test.jpg',
            description: 'desc',
            prepTime: '10m',
            difficulty: 'Easy'
        };
        const result = await container.renderToString(RecipeCard, { props });
        expect(result).toContain('loading="lazy"');
    });
    it('has hover effects', async () => {
        const container = await AstroContainer.create();
        const props = {
            title: 'Test',
            slug: 'test',
            image: '/test.jpg',
            description: 'desc',
            prepTime: '10m',
            difficulty: 'Easy'
        };
        const result = await container.renderToString(RecipeCard, { props });
        expect(result).toContain('hover:-translate-y-1');
        expect(result).toContain('hover:shadow-xl');
    });
});
