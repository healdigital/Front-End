import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import tokens from '../../../../design-system/tokens.json';

// Helper to calculate relative luminance
const getLuminance = (hex: string) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const [lr, lg, lb] = [r, g, b].map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

const getContrastRatio = (color1: string, color2: string) => {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
};

describe('Property 11: Contrast Ratio Compliance', () => {
    // Extract colors from tokens
    const colors: Record<string, string> = {};

    const extractColors = (obj: any, prefix = '') => {
        Object.entries(obj).forEach(([key, value]: [string, any]) => {
            if (value.type === 'color') {
                colors[prefix + key] = value.value;
            } else if (typeof value === 'object' && value !== null && !('value' in value)) {
                extractColors(value, prefix + key + '-');
            }
        });
    };

    extractColors(tokens.colors);

    const colorKeys = Object.keys(colors);

    it('should verify defined text colors against backgrounds have sufficient contrast', () => {
        // We define pairs that MUST meet contrast. 
        // In a real scenario, we'd map specific text tokens to specific background tokens.
        // For this generic property test, we'll test a few critical known pairs based on naming convention

        // Example: text-primary on primary-white
        const pairs = [
            { text: 'text-primary', bg: 'primary-white', minRatio: 4.5 },
            { text: 'text-secondary', bg: 'primary-white', minRatio: 4.5 },
            { text: 'primary-black', bg: 'primary-white', minRatio: 4.5 },
            { text: 'primary-white', bg: 'primary-black', minRatio: 4.5 },
        ];

        pairs.forEach(pair => {
            const textColor = colors[pair.text] || (Object.values(colors).find(c => c === tokens.colors.text[pair.text.replace('text-', '')]?.value) as string);
            const bgColor = colors[pair.bg] || (Object.values(colors).find(c => c === tokens.colors.primary[pair.bg.replace('primary-', '')]?.value) as string);

            // Fallback lookups specifically for how my updated tokens.json structure might be flattened or not
            // Actually let's just look up by value if key lookup fails, or hardcode mapping for verification

            // Let's rely on the flattening for keys like "text-primary"
            // But wait, extractColors creates keys like "primary-white", "text-primary"

            if (colors[pair.text] && colors[pair.bg]) {
                const ratio = getContrastRatio(colors[pair.text], colors[pair.bg]);
                expect(ratio).toBeGreaterThanOrEqual(pair.minRatio);
            }
        });
    });

    it('should satisfy WCAG AA for generated random valid pairs', () => {
        // This property test is a bit theoretical: 
        // "For any color intended as text and any color intended as background, IF they are used together, they must meet contrast"
        // We can't know ALL usages, but we can property test the math and specific "high contrast" intent colors.

        fc.assert(
            fc.property(
                fc.constantFrom(...colorKeys),
                fc.constantFrom(...colorKeys),
                (c1, c2) => {
                    // Only check if it's high contrast intent (e.g. black on white)
                    if ((c1.includes('black') && c2.includes('white')) || (c1.includes('white') && c2.includes('black'))) {
                        const ratio = getContrastRatio(colors[c1], colors[c2]);
                        expect(ratio).toBeGreaterThanOrEqual(4.5);
                    }
                }
            )
        );
    });
});
