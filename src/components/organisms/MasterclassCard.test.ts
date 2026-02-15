import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import MasterclassCard from './MasterclassCard.astro';
import fc from 'fast-check';

describe('MasterclassCard Component', () => {

    it('always displays premium badge', async () => {
        const container = await AstroContainer.create();

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                fc.integer({ min: 10, max: 1000 }),
                async (title, price) => {
                    const props = {
                        title,
                        image: '/img.jpg',
                        price,
                        features: ['Feature 1', 'Feature 2'],
                        slug: 'masterclass'
                    };

                    const result = await container.renderToString(MasterclassCard, { props });

                    expect(result).toContain('RÉSERVÉ PREMIUM');
                    expect(result).toContain('star'); // icon check
                }
            ),
            { numRuns: 10 }
        );
    });
});
