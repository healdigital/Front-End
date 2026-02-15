import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import WorkshopCard from './WorkshopCard.astro';
import fc from 'fast-check';

describe('WorkshopCard Component', () => {

    it('button state reflects availability', async () => {
        const container = await AstroContainer.create();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 20 }), // maxParticipants
                fc.integer({ min: 0, max: 30 }), // currentParticipants
                async (max, current) => {
                    const props = {
                        title: 'Workshop',
                        image: '/img.jpg',
                        date: new Date(),
                        price: 50,
                        duration: '2h',
                        maxParticipants: max,
                        currentParticipants: current,
                        slug: 'workshop'
                    };

                    const result = await container.renderToString(WorkshopCard, { props });
                    const isFull = current >= max;

                    if (isFull) {
                        expect(result).toContain('Complet');
                        expect(result).toContain('disabled');
                        expect(result).not.toContain('Réserver');
                    } else {
                        expect(result).toContain('Réserver');
                        expect(result).not.toContain('Complet');
                    }
                }
            ),
            { numRuns: 20 }
        );
    });
});
