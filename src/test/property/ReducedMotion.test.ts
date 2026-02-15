import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import { isReducedMotionPreferred, resolveMotionDuration } from '../../utils/motion';

describe('Property 17: Reduced Motion Preference', () => {
    it('global.css should contain the prefers-reduced-motion media query', () => {
        const globalCssPath = path.resolve(process.cwd(), 'src/styles/global.css');
        const cssContent = fs.readFileSync(globalCssPath, 'utf-8');

        expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
        expect(cssContent).toContain('animation-duration: 0.01ms !important');
        expect(cssContent).toContain('transition-duration: 0.01ms !important');
    });

    it('Property 17a: duration resolution respects reduced motion preference', () => {
        fc.assert(
            fc.property(
                fc.boolean(),
                fc.integer({ min: 1, max: 5000 }),
                fc.integer({ min: 0, max: 5000 }),
                (prefersReducedMotion, regularDurationMs, reducedDurationMs) => {
                    const resolvedDuration = resolveMotionDuration({
                        prefersReducedMotion,
                        regularDurationMs,
                        reducedDurationMs
                    });

                    if (prefersReducedMotion) {
                        return resolvedDuration === reducedDurationMs;
                    }

                    return resolvedDuration === regularDurationMs;
                }
            )
        );
    });

    it('Property 17b: matchMedia detection mirrors system preference', () => {
        fc.assert(
            fc.property(fc.boolean(), (matches) => {
                const mockMatchMedia = () => ({ matches } as MediaQueryList);
                return isReducedMotionPreferred(mockMatchMedia) === matches;
            })
        );
    });
});
