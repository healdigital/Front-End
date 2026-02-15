import { describe, it, expect } from 'vitest';
import { newsletterSchema, searchSchema } from '../../lib/validation/schemas';

describe('Validation Schemas', () => {
    describe('newsletterSchema', () => {
        it('should validate a correct email and consent', () => {
            const validData = {
                email: 'test@example.com',
                consent: true,
            };
            const result = newsletterSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid email', () => {
            const invalidData = {
                email: 'invalid-email',
                consent: true,
            };
            const result = newsletterSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('valide');
            }
        });

        it('should reject empty email with required message', () => {
            const invalidData = {
                email: '   ',
                consent: true,
            };
            const result = newsletterSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('requise');
            }
        });

        it('should reject missing consent', () => {
            const invalidData = {
                email: 'test@example.com',
                consent: false,
            };
            const result = newsletterSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('politique de confidentialité');
            }
        });
    });

    describe('searchSchema', () => {
        it('should validate correct query', () => {
            const sortedData = { query: 'recette de poulet' };
            const result = searchSchema.safeParse(sortedData);
            expect(result.success).toBe(true);
        });

        it('should reject short query', () => {
            const invalidData = { query: 'a' };
            const result = searchSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('au moins 2 caractères');
            }
        });

        it('should reject too long query', () => {
            const invalidData = { query: 'a'.repeat(51) };
            const result = searchSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid characters', () => {
            const invalidData = { query: 'recette <script>' };
            const result = searchSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should trim a valid query before validation', () => {
            const sortedData = { query: '  recette de poulet  ' };
            const result = searchSchema.safeParse(sortedData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.query).toBe('recette de poulet');
            }
        });
    });
});
