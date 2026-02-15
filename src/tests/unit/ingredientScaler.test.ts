import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateScaledAmount } from '../../utils/ingredientScaler';

describe('ingredient scaling logic', () => {

    it('returns "0" for invalid inputs or negative multiplier', () => {
        expect(calculateScaledAmount(NaN, 1)).toBe('0');
        expect(calculateScaledAmount(1, NaN)).toBe('0');
        expect(calculateScaledAmount(1, -1)).toBe('0');
    });

    it('scales linearly (within float precision)', () => {
        fc.assert(
            fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), fc.double({ min: 0.1, max: 10, noNaN: true }), (original, multiplier) => {
                const result = calculateScaledAmount(original, multiplier);
                const numericResult = parseFloat(result);
                const expected = original * multiplier;

                // Allow small precision error due to toFixed(2)
                expect(Math.abs(numericResult - expected)).toBeLessThan(0.01 + 0.0001);
                // 0.01 because toFixed(2) rounds to 0.01 precision, so max error is 0.005, but let's be safe.
            })
        );
    });

    it('formats correctly (no trailing zeros)', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 10 }), (original, multiplier) => {
                // Integer * Integer = Integer
                const result = calculateScaledAmount(original, multiplier);
                expect(result).not.toMatch(/\.0+$/); // No .00
                expect(result).not.toMatch(/\.$/);   // No .
                // Should just be a number string
                expect(String(parseFloat(result))).toBe(result);
            })
        );
    });

    it('handles decimal results correctly', () => {
        // Known inputs
        expect(calculateScaledAmount(1, 1.5)).toBe('1.5');
        expect(calculateScaledAmount(1, 1.25)).toBe('1.25');
        expect(calculateScaledAmount(1, 1.3333)).toBe('1.33');
    });
});
