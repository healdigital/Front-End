import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getPageNumbers } from '../../utils/pagination';

describe('Pagination Logic', () => {
    it('should return correct pages for simple case', () => {
        expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should add ellipses correctly', () => {
        // 1 ... 4 5 6 ... 10
        expect(getPageNumbers(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10]);
    });

    it('Property 20: Pagination first page is always 1', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }), // current
                fc.integer({ min: 1, max: 100 }), // total
                (current, total) => {
                    const c = Math.min(current, total);
                    const pages = getPageNumbers(c, total);
                    return pages[0] === 1;
                }
            )
        );
    });

    it('Property 21: Pagination last page is always total', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }), // current
                fc.integer({ min: 1, max: 100 }), // total
                (current, total) => {
                    const c = Math.min(current, total);
                    const pages = getPageNumbers(c, total);
                    return pages[pages.length - 1] === total;
                }
            )
        );
    });

    it('should contain current page', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }), // current
                fc.integer({ min: 1, max: 100 }), // total
                (current, total) => {
                    const c = Math.min(current, total);
                    const pages = getPageNumbers(c, total);
                    return pages.includes(c);
                }
            )
        );
    });
});
