import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

const pagesRoot = path.resolve(process.cwd(), 'src', 'pages');

const collectAstroPages = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAstroPages(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.astro')) {
      files.push(fullPath);
    }
  }

  return files;
};

const pageFiles = collectAstroPages(pagesRoot);

describe('Property 18: Heading Hierarchy Correctness', () => {
  it('limits each non-redirect page to at most one H1', () => {
    fc.assert(
      fc.property(fc.constantFrom(...pageFiles), (filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        if (/Astro\.redirect\(/.test(source)) return;

        const h1Count = (source.match(/<h1\b/gi) || []).length;
        expect(h1Count).toBeLessThanOrEqual(1);
      }),
      { numRuns: pageFiles.length },
    );
  });

  it('requires every non-redirect page to expose one H1 directly or via StaticPage wrapper', () => {
    fc.assert(
      fc.property(fc.constantFrom(...pageFiles), (filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        if (/Astro\.redirect\(/.test(source)) return;

        const hasDirectH1 = (source.match(/<h1\b/gi) || []).length === 1;
        const hasStaticPageWrapper = /<StaticPage\b/.test(source);

        expect(hasDirectH1 || hasStaticPageWrapper).toBe(true);
      }),
      { numRuns: pageFiles.length },
    );
  });
});
