import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, it, expect, beforeEach } from 'vitest';
import Container from '../../components/layout/Container.astro';
import Grid from '../../components/layout/Grid.astro';

describe('Layout Components', () => {
    let container: AstroContainer;

    beforeEach(async () => {
        container = await AstroContainer.create();
    });

    describe('Container', () => {
        it('renders with correct layout classes', async () => {
            const result = await container.renderToString(Container);

            expect(result).toContain('max-w-7xl');
            expect(result).toContain('mx-auto');
            expect(result).toContain('px-5');
            expect(result).toContain('md:px-10');
            expect(result).toContain('lg:px-[90px]');
        });

        it('renders children correctly', async () => {
            const result = await container.renderToString(Container, {
                slots: { default: '<div id="test-child">Child Content</div>' }
            });

            expect(result).toContain('Child Content');
            expect(result).toContain('id="test-child"');
        });

        it('accepts custom classes', async () => {
            const result = await container.renderToString(Container, {
                props: { class: 'custom-class' }
            });

            expect(result).toContain('custom-class');
        });

        it('accepts id prop', async () => {
            const result = await container.renderToString(Container, {
                props: { id: 'container-id' }
            });

            expect(result).toContain('id="container-id"');
        });
    });

    describe('Grid System', () => {
        it('renders responsive columns for mobile/tablet/desktop', async () => {
            const result = await container.renderToString(Grid);

            expect(result).toContain('grid');
            expect(result).toContain('grid-cols-1');
            expect(result).toContain('md:grid-cols-4');
            expect(result).toContain('lg:grid-cols-12');
        });

        it('uses 28px gutters', async () => {
            const result = await container.renderToString(Grid);

            expect(result).toContain('gap-7');
        });

        it('preserves container margins alongside grid usage', async () => {
            const result = await container.renderToString(Container, {
                slots: { default: '<div>Grid Content</div>' }
            });

            expect(result).toContain('px-5');
            expect(result).toContain('md:px-10');
            expect(result).toContain('lg:px-[90px]');
        });

        it('accepts custom classes and id', async () => {
            const result = await container.renderToString(Grid, {
                props: { class: 'custom-grid', id: 'grid-id' }
            });

            expect(result).toContain('custom-grid');
            expect(result).toContain('id="grid-id"');
        });
    });
});
