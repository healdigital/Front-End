
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Header from '../../components/organisms/Header.astro';
import RecipeCard from '../../components/organisms/RecipeCard.astro';
import ArticleGrid from '../../components/ArticleGrid.astro';

describe('Responsive Layouts', () => {
    const container = Promise.resolve(AstroContainer.create());

    it('Header should have responsive navigation visibility classes', async () => {
        const c = await container;
        const result = await c.renderToString(Header);

        // Check for mobile menu trigger visibility capability (lg:hidden)
        expect(result).toContain('lg:hidden');

        // Check for desktop navigation visibility capability (hidden lg:block)
        expect(result).toContain('hidden lg:block');

        // Check for responsive padding
        expect(result).toMatch(/px-container-mobile/);
        expect(result).toMatch(/md:px-container-tablet/);
        expect(result).toMatch(/lg:px-container-desktop/);
    });

    it('RecipeCard should have responsive width and padding classes', async () => {
        const c = await container;
        const result = await c.renderToString(RecipeCard, {
            props: {
                title: 'Test Recipe',
                slug: '/test-recipe',
                image: '/img.jpg',
                description: 'A test description',
                prepTime: '20 min',
                difficulty: 'Facile'
            }
        });

        // Check for responsive width (w-full max-w-[432px])
        expect(result).toContain('w-full');
        expect(result).toContain('max-w-[432px]');

        // Check for responsive margins (mx-auto md:mx-0)
        expect(result).toContain('mx-auto');
        expect(result).toContain('md:mx-0');

        // Check for responsive padding (p-4 md:p-6 lg:p-8)
        expect(result).toContain('p-4');
        expect(result).toContain('md:p-6');
        expect(result).toContain('lg:p-8');

        // Check for responsive image height (h-[200px] md:h-[256px])
        expect(result).toContain('h-[200px]');
        expect(result).toContain('md:h-[256px]');

        // Check for responsive title size (text-lg md:text-xl)
        expect(result).toContain('text-lg');
        expect(result).toContain('md:text-xl');
    });

    it('ArticleGrid should have responsive grid columns', async () => {
        const c = await container;
        // We can pass empty articles array for this test as we just want to check container classes
        const result = await c.renderToString(ArticleGrid, {
            props: {
                limit: 6
            }
        });

        // Check for responsive grid columns (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
        expect(result).toContain('grid-cols-1');
        expect(result).toContain('md:grid-cols-2');
        expect(result).toContain('lg:grid-cols-3');

        // Check for gap
        expect(result).toContain('gap-8');
    });
});
