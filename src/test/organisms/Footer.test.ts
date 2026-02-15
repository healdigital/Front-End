import { describe, it, expect } from 'vitest';
import Footer from '../../components/organisms/Footer.astro';

describe('Footer Component', () => {
    it('should be importable', () => {
        // Basic check to ensure the component syntax is valid and it can be resolved
        expect(Footer).toBeDefined();
    });

    it('should have a smoke test', () => {
        expect(true).toBe(true);
    });
});
