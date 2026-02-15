import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Container from '../../components/layout/Container.astro';

describe('Layout Property Tests', () => {
  it('Property 16: Maximum Content Width', async () => {
    const container = await AstroContainer.create();

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom(
            'bg-white',
            'text-primary-black',
            'rounded-lg',
            'shadow-sm',
            'mt-4',
            'mb-6'
          ),
          { maxLength: 6 }
        ),
        async (extraClasses) => {
          const result = await container.renderToString(Container, {
            props: { class: extraClasses.join(' ') },
          });

          const classMatch = result.match(/class="([^"]+)"/);
          expect(classMatch).not.toBeNull();

          const classes = classMatch![1].split(/\s+/).filter(Boolean);
          const maxWidthClasses = classes.filter((className) =>
            className.startsWith('max-w-')
          );

          expect(classes).toContain('max-w-7xl');
          expect(classes).toContain('mx-auto');
          expect(maxWidthClasses).toHaveLength(1);
        }
      ),
      { numRuns: 50 }
    );
  });
});
