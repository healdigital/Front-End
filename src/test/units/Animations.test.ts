import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Button from '../../components/atoms/Button.astro';
import NewsletterModal from '../../components/organisms/NewsletterModal.astro';
import { REDUCED_MOTION_MEDIA_QUERY, isReducedMotionPreferred, resolveMotionDuration } from '../../utils/motion';

describe('Animation and Transition Classes', () => {
    let container: AstroContainer;

    beforeEach(async () => {
        container = await AstroContainer.create();
    });

    it('Button uses 0.3s hover transitions and 0.2s state transitions', async () => {
        const result = await container.renderToString(Button);
        const buttonSource = fs.readFileSync(
            path.resolve(process.cwd(), 'src/components/atoms/Button.astro'),
            'utf-8'
        );

        expect(result).toContain('btn-hover-transition');
        expect(result).toContain('btn-state-transition');
        expect(buttonSource).toContain('transition-duration: 0.3s');
        expect(buttonSource).toContain('transition-duration: 0.2s');
        expect(buttonSource).toContain('transition-property: transform');
        expect(buttonSource).not.toContain('transition-property: top');
        expect(buttonSource).not.toContain('transition-property: left');
    });

    it('NewsletterModal has fade-in animation driven by transform/opacity', async () => {
        const result = await container.renderToString(NewsletterModal);
        const modalSource = fs.readFileSync(
            path.resolve(process.cwd(), 'src/components/organisms/NewsletterModal.astro'),
            'utf-8'
        );

        expect(result).toContain('newsletter-modal-panel');
        expect(modalSource).toContain('newsletter-modal-fade-in');
        expect(modalSource).toContain('animation: newsletter-modal-fade-in 0.3s ease forwards');
        expect(modalSource).toContain('transform: translateY(16px) scale(0.98)');
    });

    it('prefers-reduced-motion toggles animation durations', () => {
        const normalDuration = resolveMotionDuration({
            prefersReducedMotion: false,
            regularDurationMs: 300,
            reducedDurationMs: 0
        });
        const reducedDuration = resolveMotionDuration({
            prefersReducedMotion: true,
            regularDurationMs: 300,
            reducedDurationMs: 0
        });

        expect(REDUCED_MOTION_MEDIA_QUERY).toBe('(prefers-reduced-motion: reduce)');
        expect(normalDuration).toBe(300);
        expect(reducedDuration).toBe(0);

        const prefersReducedMotionMatch = isReducedMotionPreferred(
            () => ({ matches: true } as MediaQueryList)
        );
        const prefersStandardMotionMatch = isReducedMotionPreferred(
            () => ({ matches: false } as MediaQueryList)
        );

        expect(prefersReducedMotionMatch).toBe(true);
        expect(prefersStandardMotionMatch).toBe(false);
    });
});
