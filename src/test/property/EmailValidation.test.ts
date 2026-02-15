import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { NEWSLETTER_EMAIL_PATTERN, newsletterSchema } from '../../lib/validation/schemas';

describe('Feature: homepage-integration, Property 14: Email Validation Pattern', () => {
    it('accepts generated valid emails', () => {
        fc.assert(
            fc.property(
                fc.emailAddress(),
                (email) => {
                    const result = newsletterSchema.safeParse({ email, consent: true });
                    return result.success;
                },
            ),
            { numRuns: 100 },
        );
    });

    it('rejects any non-matching email pattern', () => {
        fc.assert(
            fc.property(
                fc.string().filter((s) => s.length > 0 && !NEWSLETTER_EMAIL_PATTERN.test(s.trim())),
                (invalidEmail) => {
                    const result = newsletterSchema.safeParse({ email: invalidEmail, consent: true });
                    return !result.success;
                },
            ),
            { numRuns: 100 },
        );
    });

    it('always rejects empty and whitespace-only emails', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^\s*$/),
                (blankEmail) => {
                    const result = newsletterSchema.safeParse({ email: blankEmail, consent: true });
                    return !result.success;
                },
            ),
            { numRuns: 100 },
        );
    });
});
