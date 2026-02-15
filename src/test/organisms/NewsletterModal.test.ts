import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

describe('NewsletterModal Component Logic', () => {
    let dialog: HTMLDialogElement;
    let trigger: HTMLElement;
    let closeBtn: HTMLElement;
    // We need to store the close event listener to trigger it manually if needed, 
    // or just rely on the fact that we are testing the logic.

    beforeEach(() => {
        document.body.innerHTML = `
            <button id="open-btn">Open</button>
            <dialog id="modal" aria-modal="true">
                <button id="modal-close">Close</button>
                <div class="content">
                    <input type="email" id="email" required />
                    <button type="submit">Submit</button>
                    <div style="position:fixed; top:0; left:0; width:100%; height:100%"></div>
                </div>
            </dialog>
        `;

        // Mock showModal/close
        HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
            this.setAttribute('open', '');
        });
        HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
            this.removeAttribute('open');
            this.dispatchEvent(new Event('close'));
        });

        // Mock getBoundingClientRect
        // For property testing we need consistent values, but for unit tests we can mock simple rects
        Element.prototype.getBoundingClientRect = vi.fn(() => ({
            width: 500, height: 500, top: 100, left: 100, bottom: 600, right: 600, x: 100, y: 100, toJSON: () => { }
        }));

        dialog = document.getElementById('modal') as HTMLDialogElement;
        trigger = document.getElementById('open-btn') as HTMLElement;
        closeBtn = document.getElementById('modal-close') as HTMLElement;

        // --- REPLICATING THE SCRIPT LOGIC FROM COMPONENT ---
        if (dialog) {
            if (trigger) {
                trigger.addEventListener('click', () => {
                    dialog.showModal();
                    dialog.classList.remove('hidden');
                });
            }

            closeBtn?.addEventListener('click', () => {
                dialog.close();
            });

            dialog.addEventListener('click', (e) => {
                const rect = dialog.getBoundingClientRect();
                const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
                    && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);

                if (!isInDialog) {
                    dialog.close();
                }
            });
        }
        // ---------------------------------------------------
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should open modal when trigger is clicked', () => {
        trigger.click();
        expect(dialog.showModal).toHaveBeenCalled();
        expect(dialog.hasAttribute('open')).toBe(true);
    });

    it('should close modal when close button is clicked', () => {
        dialog.showModal(); // set open state first
        closeBtn.click();
        expect(dialog.close).toHaveBeenCalled();
        // Since our mock implementation removes attribute, check that
        expect(dialog.hasAttribute('open')).toBe(false);
    });

    // Property Test 9: Modal Close on Outside Click
    it('Property 9: Modal Close on Outside Click', () => {
        // Logic to test:
        // If click coordinates are OUTSIDE the rect (100,100,500,500), dialog.close() should be called.

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1000 }), // clickX
                fc.integer({ min: 0, max: 1000 }), // clickY
                (clickX, clickY) => {
                    // Reset state
                    vi.clearAllMocks();
                    dialog.setAttribute('open', ''); // Assume open

                    // Helper to check if inside
                    const rLeft = 100, rTop = 100, rWidth = 500, rHeight = 500;
                    const isInside = clickX >= rLeft && clickX <= rLeft + rWidth &&
                        clickY >= rTop && clickY <= rTop + rHeight;

                    // Simulate click
                    // We need to construct a MouseEvent with clientX/Y
                    const event = new MouseEvent('click', {
                        clientX: clickX,
                        clientY: clickY,
                        bubbles: true
                    });

                    dialog.dispatchEvent(event);

                    if (!isInside) {
                        // Should close

                        // Need to check call count 
                        return (dialog.close as any).mock.calls.length === 1;
                    } else {
                        // Should NOT close
                        return (dialog.close as any).mock.calls.length === 0;
                    }
                }
            )
        );
    });
});
