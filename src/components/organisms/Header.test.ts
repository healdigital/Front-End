import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Header from './Header.astro';

describe('Header Component', () => {
    it('initial load: renders logo, navigation links, search, and actions', async () => {
        const container = await AstroContainer.create();
        const result = await container.renderToString(Header);

        // Logo
        expect(result).toContain('La Cuisine de Bernard');

        // Navigation Links
        const links = ["Recettes", "Ateliers", "Masterclass", "Livres", "Voyages", "Vidéos", "À propos", "Partenaires"];
        links.forEach(link => {
            expect(result).toContain(link);
        });

        // Search Field
        expect(result).toContain('Rechercher...');

        // Actions
        expect(result).toContain('aria-label="Favoris"');
        expect(result).toContain('aria-label="Panier"');

        // Mobile Menu Trigger
        expect(result).toContain('aria-label="Ouvrir le menu"');
    });

    it('focus visibility: navigation links have focus styles', async () => {
        const container = await AstroContainer.create();
        const result = await container.renderToString(Header);

        // Check for focus classes in the output
        // Navigation Links
        expect(result).toContain('focus-visible:ring-primary-turquoise');
        expect(result).toContain('focus-visible:outline-none');
    });
});
