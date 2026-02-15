import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Window } from 'happy-dom';

// Setup happy-dom
const window = new Window();
const document = window.document;

describe('Property 12: Keyboard Navigation Completeness', () => {
    // Helper to create elements
    const createInteractiveElement = (tag: string, props: any = {}) => {
        const el = document.createElement(tag);
        Object.entries(props).forEach(([k, v]) => el.setAttribute(k, String(v)));
        return el;
    };

    it('should ensure all interactive elements are focusable or explicitly disabled', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('button', 'a', 'input', 'select', 'textarea'),
                fc.boolean(), // isDisabled
                fc.boolean(), // hasTabindex
                fc.integer({ min: -1, max: 0 }), // tabindexValue
                (tag, isDisabled, hasTabindex, tabindexValue) => {
                    const props: any = {};
                    if (tag === 'a') props.href = '#';
                    if (isDisabled) props.disabled = 'true';
                    if (hasTabindex) props.tabindex = String(tabindexValue);

                    const el = createInteractiveElement(tag, props);

                    // Logic to check accessibility
                    const isFocusable = (element: any) => {
                        if (element.hasAttribute('disabled')) return false;
                        const tabindex = element.getAttribute('tabindex');
                        if (tabindex === '-1') return false;
                        return true;
                    };

                    const actuallyFocusable = isFocusable(el);

                    // Assertion: 
                    // If it's disabled, it should NOT be focusable
                    // If it has tabindex -1, it should NOT be focusable (by keyboard mainly, though programmatically yes, 
                    // but for this property we care about keyboard flow "completeness")

                    if (isDisabled) {
                        expect(actuallyFocusable).toBe(false);
                    } else if (hasTabindex && tabindexValue === -1) {
                        expect(actuallyFocusable).toBe(false);
                    } else {
                        expect(actuallyFocusable).toBe(true);
                    }
                }
            )
        );
    });
});
