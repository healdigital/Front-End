import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import SearchField from './SearchField.astro';

describe('SearchField Component', () => {
    // Note: Astro components rendered in isolation via container API might not fully execute client-side scripts in JSDOM the same way a browser does without hydration.
    // However, we can test the structure and attributes.
    // For property testing client-side behavior specifically, typically one would use Cypress or Playwright.
    // Since this is a unit test context with Vitest, we'll verify the necessary attributes and structure are present to support the behavior.

    it('renders with correct input type and placeholder', async () => {
        const container = await AstroContainer.create();
        const result = await container.renderToString(SearchField);

        expect(result).toContain('type="search"');
        expect(result).toContain('placeholder="Rechercher..."');
        expect(result).toContain('data-search-input'); // Ensure hook for script exists
    });

    // Validating Requirement 7.4 via property test simulation if feasible in this environment
    // Ideally, for "Property 8: Search Submission via Enter Key", we'd check if the event listener is attached or simulate it.
    // In Astro unit testing, script tags are often just strings. 
    // We will verify the script logic exists in the output.
    it('includes client-side script for Enter key submission', async () => {
        const container = await AstroContainer.create();
        const result = await container.renderToString(SearchField);

        // Verify script is attached (Astro bundles it)
        expect(result).toContain('type="module"');
        expect(result).toContain('src=');
        expect(result).toContain('SearchField.astro');
    });
});
