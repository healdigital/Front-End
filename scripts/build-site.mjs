import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const isTruthy = (value) => {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const run = (command, env) => {
  execSync(command, {
    stdio: 'inherit',
    env,
  });
};

const env = {
  ...process.env,
  NODE_ENV: 'production',
};

const articleOnlyBuild =
  isTruthy(env.BUILD_ONLY_ARTICLE_PAGES) || isTruthy(env.BUILD_ONLY_ARTICLES);
const disableSearch = isTruthy(env.BUILD_DISABLE_SEARCH);
const useLocalJson = isTruthy(env.USE_LOCAL_JSON);
const preparedUrl = env.PREPARED_JSON_URL || '';

const downloadPreparedSnapshot = () => {
  if (!preparedUrl) return;
  console.log(`[BUILD] Downloading prepared-articles.json from ${preparedUrl}...`);
  run(`curl -fL "${preparedUrl}" -o prepared-articles.json`, env);
};

try {
  if (articleOnlyBuild) {
    // In article-only mode we force local JSON to avoid Mongo timeouts during CI/deploy builds.
    env.USE_LOCAL_JSON = '1';
    console.log('BUILD_ONLY_ARTICLE_PAGES enabled: using prepared JSON for fast build.');
  }

  if (articleOnlyBuild || useLocalJson) {
    downloadPreparedSnapshot();
  }

  if (disableSearch) {
    console.log('BUILD_DISABLE_SEARCH enabled: skipping search index generation.');
  } else {
    run('npm run generate-search-index', env);
  }

  run('npx astro build', env);

  if (articleOnlyBuild) {
    // Keep homepage + article routes, remove non-article static outputs before deploy sync.
    rmSync('dist/categories', { recursive: true, force: true });
    rmSync('dist/tags', { recursive: true, force: true });
    rmSync('dist/author', { recursive: true, force: true });
    rmSync('dist/test-golden-recipe', { recursive: true, force: true });
    rmSync('dist/test-translation', { recursive: true, force: true });
    if (disableSearch) {
      rmSync('dist/search', { recursive: true, force: true });
      console.log('Removed category/tag/author/search/test routes for article-only deploy.');
    } else {
      console.log('Removed category/tag/author/test routes for article-only deploy.');
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
