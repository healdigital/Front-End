import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

const roots = [
  path.resolve(process.cwd(), 'src', 'pages'),
  path.resolve(process.cwd(), 'src', 'components'),
  path.resolve(process.cwd(), 'src', 'layouts'),
];

const collectAstroFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAstroFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.astro')) {
      files.push(fullPath);
    }
  }

  return files;
};

const astroFiles = roots.flatMap((rootPath) => collectAstroFiles(rootPath));

const getRenderableMarkup = (source: string) => {
  const withoutFrontmatter = source.replace(/^---[\s\S]*?---\s*/, '');
  return withoutFrontmatter.replace(/<script[\s\S]*?<\/script>/gi, '');
};

describe('Property 19.7: Image alt attributes', () => {
  it('ensures every <img> tag includes an alt attribute', () => {
    fc.assert(
      fc.property(fc.constantFrom(...astroFiles), (filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        const markup = getRenderableMarkup(source);
        const imageTags = markup.match(/<img\b[^>]*>/gi) || [];

        for (const imageTag of imageTags) {
          expect(/\balt\s*=/i.test(imageTag)).toBe(true);
        }
      }),
      { numRuns: astroFiles.length },
    );
  });

  it('rejects non-descriptive placeholder alt text literals', () => {
    fc.assert(
      fc.property(fc.constantFrom(...astroFiles), (filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        const markup = getRenderableMarkup(source);
        const imageTags = markup.match(/<img\b[^>]*>/gi) || [];

        for (const imageTag of imageTags) {
          const literalAltMatch = imageTag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
          const literalAlt = literalAltMatch?.[1] || literalAltMatch?.[2] || '';
          if (!literalAlt) continue;

          expect(['book', 'image', 'photo', 'picture']).not.toContain(literalAlt.trim().toLowerCase());
        }
      }),
      { numRuns: astroFiles.length },
    );
  });
});
