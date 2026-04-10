import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const chunksDir = path.join(
  process.cwd(),
  'node_modules',
  'vite',
  'dist',
  'node',
  'chunks'
);

if (!existsSync(chunksDir)) {
  process.exit(0);
}

const marker = `const output = esbuildOutputFromId(
          meta.outputs,
          id,
          processingCacheDir
        );`;

const guard = `const output = esbuildOutputFromId(
          meta.outputs,
          id,
          processingCacheDir
        );
        if (!output) {
          continue;
        }`;

const files = readdirSync(chunksDir).filter(
  (name) => name.startsWith('dep-') && name.endsWith('.js')
);

let patchedAny = false;

for (const fileName of files) {
  const filePath = path.join(chunksDir, fileName);
  const source = readFileSync(filePath, 'utf8');

  if (!source.includes('JSON.stringify(output.imports)')) {
    continue;
  }

  if (source.includes('if (!output) {\n          continue;\n        }')) {
    patchedAny = true;
    break;
  }

  if (!source.includes(marker)) {
    continue;
  }

  const patched = source.replace(marker, guard);
  writeFileSync(filePath, patched, 'utf8');
  patchedAny = true;
  console.log(`[fix:vite-optimize] patched ${fileName}`);
  break;
}

if (!patchedAny) {
  console.log('[fix:vite-optimize] no patch needed');
}
