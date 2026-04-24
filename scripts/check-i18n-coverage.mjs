import { readFileSync } from 'node:fs';
import path from 'node:path';

const I18N_DIR = path.resolve(process.cwd(), 'src', 'i18n');
const REQUIRED_LOCALES = ['en', 'fr', 'es', 'pt-br', 'ar'];
const REFERENCE_LOCALE = 'en';

const loadJson = (locale) => {
  const filePath = path.join(I18N_DIR, `${locale}.json`);
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const flattenObject = (value, prefix = '', acc = new Map()) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) acc.set(prefix, value);
    return acc;
  }

  Object.entries(value).forEach(([key, nested]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    flattenObject(nested, nextKey, acc);
  });

  return acc;
};

const assertNonEmptyString = (locale, key, value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Invalid translation value for locale "${locale}" at "${key}". Expected a non-empty string.`,
    );
  }
};

const run = () => {
  const dictionaries = Object.fromEntries(
    REQUIRED_LOCALES.map((locale) => [locale, flattenObject(loadJson(locale))]),
  );

  const reference = dictionaries[REFERENCE_LOCALE];
  if (!reference || reference.size === 0) {
    throw new Error(`Reference locale "${REFERENCE_LOCALE}" has no translation keys.`);
  }

  const referenceKeys = new Set(reference.keys());
  const total = referenceKeys.size;
  let failed = false;

  console.log(`Checking i18n coverage for locales: ${REQUIRED_LOCALES.join(', ')}`);
  console.log(`Reference locale: ${REFERENCE_LOCALE} (${total} keys)\n`);

  REQUIRED_LOCALES.forEach((locale) => {
    const localeEntries = dictionaries[locale];
    const missing = [];
    const extra = [];

    referenceKeys.forEach((key) => {
      if (!localeEntries.has(key)) {
        missing.push(key);
        return;
      }
      assertNonEmptyString(locale, key, localeEntries.get(key));
    });

    localeEntries.forEach((_, key) => {
      if (!referenceKeys.has(key)) {
        extra.push(key);
      }
    });

    const covered = total - missing.length;
    const percentage = ((covered / total) * 100).toFixed(2);
    console.log(`${locale}: ${covered}/${total} (${percentage}%)`);

    if (missing.length > 0 || extra.length > 0) {
      failed = true;
      if (missing.length > 0) {
        console.error(`  Missing keys (${missing.length}): ${missing.join(', ')}`);
      }
      if (extra.length > 0) {
        console.error(`  Extra keys (${extra.length}): ${extra.join(', ')}`);
      }
    }
  });

  if (failed) {
    throw new Error('Translation coverage check failed. 100% coverage is required.');
  }

  console.log('\nTranslation coverage is 100% for all required locales.');
};

run();
