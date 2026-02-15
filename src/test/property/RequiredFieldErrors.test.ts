import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { newsletterSchema } from '../../lib/validation/schemas';
import { validateForm } from '../../lib/validation/client';

describe('Feature: homepage-integration, Property 15: Required Field Error Display', () => {
    it('always returns email and consent errors for missing required fields', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^\s*$/),
                fc.constantFrom(undefined, false),
                (blankEmail, consentValue) => {
                    const result = validateForm(newsletterSchema, {
                        email: blankEmail,
                        consent: consentValue,
                    });

                    return (
                        result.success === false &&
                        !!result.errors?.email &&
                        !!result.errors?.consent
                    );
                },
            ),
            { numRuns: 100 },
        );
    });

    it('always returns required errors when fields are omitted', () => {
        fc.assert(
            fc.property(
                fc.constantFrom({}, { consent: undefined }, { email: undefined }),
                (payload) => {
                    const result = validateForm(newsletterSchema, payload);
                    return (
                        result.success === false &&
                        !!result.errors?.email &&
                        !!result.errors?.consent
                    );
                },
            ),
            { numRuns: 100 },
        );
    });
});
