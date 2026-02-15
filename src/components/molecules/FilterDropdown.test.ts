import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import FilterDropdown from './FilterDropdown.astro';

describe('FilterDropdown Component', () => {
    it('renders label and options correctly', async () => {
        const container = await AstroContainer.create();
        const props = {
            label: 'Filter By',
            options: [
                { label: 'Option A', value: 'a' },
                { label: 'Option B', value: 'b' }
            ]
        };
        const result = await container.renderToString(FilterDropdown, { props });

        expect(result).toContain('Filter By');
        expect(result).toContain('Option A');
        expect(result).toContain('Option B');
        expect(result).toContain('data-filter-dropdown');
        expect(result).toContain('aria-expanded="false"');
    });

    // Validating interactablity script presence
    it('includes client-side script for dropdown interactions', async () => {
        const container = await AstroContainer.create();
        const props = { label: 'Test', options: [] };
        const result = await container.renderToString(FilterDropdown, { props });

        // Verify script is attached
        expect(result).toContain('type="module"');
        expect(result).toContain('src=');
        expect(result).toContain('FilterDropdown.astro');
    });
});
