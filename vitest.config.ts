/// <reference types="vitest" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    exclude: ['src/tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/components/atoms/**/*.astro',
        'src/components/organisms/RecipeCard.astro',
        'src/components/organisms/WorkshopCard.astro',
        'src/components/organisms/MasterclassCard.astro',
        'src/lib/validation/schemas.ts',
        'src/utils/pagination.ts',
      ],
      exclude: ['src/test/**', 'src/tests/**', '**/*.stories.ts', '**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
