import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import tokens from '../../../design-system/tokens.json';

describe('Design Tokens Completeness', () => {

    it('Property 22: Design Tokens Completeness - All colors should have valid hex values', () => {
        // Flatten colors to verify them
        const extractColors = (obj: any): string[] => {
            let colors: string[] = [];
            for (const key in obj) {
                if (obj[key].type === 'color') {
                    colors.push(obj[key].value);
                } else if (typeof obj[key] === 'object' && obj[key] !== null && !('value' in obj[key])) {
                    colors = colors.concat(extractColors(obj[key]));
                }
            }
            return colors;
        };

        const colorValues = extractColors(tokens.colors);

        // Property: All color values must be valid hex strings
        fc.assert(
            fc.property(fc.constantFrom(...colorValues), (color) => {
                return /^#([0-9A-F]{3}){1,2}$/i.test(color);
            })
        );
    });

    it('should have all required top-level categories', () => {
        const requiredCategories = [
            'colors',
            'typography',
            'spacing',
            'borderRadius',
            'shadows',
            'breakpoints',
            'grid',
            'iconSizes'
        ];

        requiredCategories.forEach(category => {
            expect(tokens).toHaveProperty(category);
        });
    });

    it('should ensure all dimensions are valid strings with units or numbers', () => {
        const validateDimension = (value: string | number) => {
            if (typeof value === 'number') return true;
            return /^(-?[\d.]+(px|rem|em|%)?|0)$/.test(value);
        };

        // Check spacing
        Object.values(tokens.spacing).forEach((token: any) => {
            expect(validateDimension(token.value)).toBe(true);
        });
    });
});
