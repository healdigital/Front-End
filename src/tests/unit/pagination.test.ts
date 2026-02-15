import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getPageNumbers } from '../../utils/pagination';

describe('pagination logic', () => {
    it('always includes 1 and total', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 1000 }), (c, t) => {
                const current = (c % t) + 1; // ensure current is within 1..total
                const total = t;
                const pages = getPageNumbers(current, total);
                expect(pages).toContain(1);
                if (total > 0) {
                    expect(pages).toContain(total); // Logic might return empty if total=0? function sig says number, assume >=1
                }
            })
        );
    });

    it('returns 1..total if total <= 7', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 7 }), (total) => {
                const current = Math.floor(Math.random() * total) + 1;
                const pages = getPageNumbers(current, total);
                expect(pages).toHaveLength(total);
                for (let i = 0; i < total; i++) {
                    expect(pages[i]).toBe(i + 1);
                }
            })
        );
    });

    it('never has two "..." in a row', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 1000 }), (c, t) => {
                const current = (c % t) + 1;
                const total = t;
                const pages = getPageNumbers(current, total);
                for (let i = 0; i < pages.length - 1; i++) {
                    if (pages[i] === '...') {
                        expect(pages[i + 1]).not.toBe('...');
                    }
                }
            })
        );
    });

    it('is always sorted (treating ... as gaps)', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 1000 }), (c, t) => {
                const current = (c % t) + 1;
                const total = t;
                const pages = getPageNumbers(current, total);

                let lastNum = 0;
                for (const p of pages) {
                    if (typeof p === 'number') {
                        expect(p).toBeGreaterThan(lastNum);
                        lastNum = p;
                    }
                }
            })
        );
    });

    it('never exceeds 9 items', () => { // 1, ..., prev, curr, next, ..., total (roughly 7-9 items usually)
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 10000 }), fc.integer({ min: 8, max: 10000 }), (c, t) => {
                const current = (c % t) + 1;
                const total = t;
                const pages = getPageNumbers(current, total);
                expect(pages.length).toBeLessThanOrEqual(9);
            })
        );
    });
});
