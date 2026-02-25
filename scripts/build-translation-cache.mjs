import fs from 'fs';
import path from 'path';

const TRANSLATE_ENDPOINT_DEFAULT = 'https://admin.lacuisinedebernard.com/api/translate';
const TRANSLATION_CACHE_VERSION = 1;

const deeplLanguageMap = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  'pt-br': 'PT-BR',
  ar: 'AR',
};

const normalizeLanguage = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'pt' || raw === 'pt_br' || raw === 'ptbr') return 'pt-br';
  return raw;
};

const toDeepLTargetLanguage = (lang) => deeplLanguageMap[lang] || String(lang || '').toUpperCase();

const normalizeEndpoint = (value) => {
  const raw = String(value || '').trim().replace(/\/+$/g, '');
  if (!raw) return '';
  return raw.endsWith('/translate') ? raw : `${raw}/translate`;
};

const endpoint = normalizeEndpoint(
  process.env.TRANSLATE_CACHE_API_URL ||
    process.env.PUBLIC_TRANSLATE_API_URL ||
    process.env.PUBLIC_PAYLOAD_API_URL ||
    TRANSLATE_ENDPOINT_DEFAULT,
);

const distDir = path.resolve(process.cwd(), process.env.TRANSLATE_CACHE_DIST_DIR || 'dist');

const defaultOutputPaths = [
  path.resolve(process.cwd(), 'dist/translation-cache.json'),
  path.resolve(process.cwd(), 'public/translation-cache.json'),
];

const outputPaths = String(process.env.TRANSLATE_CACHE_OUTPUT || '')
  .split(',')
  .map((item) => String(item || '').trim())
  .filter(Boolean)
  .map((item) => path.resolve(process.cwd(), item));

if (!outputPaths.length) {
  outputPaths.push(...defaultOutputPaths);
}
const sourceLanguage = normalizeLanguage(process.env.TRANSLATE_CACHE_SOURCE_LANG || 'fr') || 'fr';
const targetLanguages = String(process.env.TRANSLATE_CACHE_LANGS || 'en,fr,es,pt-br,ar')
  .split(',')
  .map((item) => normalizeLanguage(item))
  .filter(Boolean);
const chunkSize = Math.max(1, Number(process.env.TRANSLATE_CACHE_CHUNK_SIZE) || 80);
const maxTextLength = Math.max(32, Number(process.env.TRANSLATE_CACHE_MAX_TEXT_LENGTH) || 400);
const maxTexts = Math.max(0, Number(process.env.TRANSLATE_CACHE_MAX_TEXTS) || 0);

const decodeHtml = (value) => {
  const decoded = String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&hellip;/gi, '...')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });

  return decoded.replace(/\s+/g, ' ').trim();
};

const hasLetters = (value) => /[\p{L}]/u.test(String(value || ''));

const shouldKeepText = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  if (trimmed.length > maxTextLength) return false;
  if (!hasLetters(trimmed)) return false;
  if (/^[\W\d_]+$/u.test(trimmed)) return false;
  return true;
};

const collectHtmlFiles = (dir, output = []) => {
  if (!fs.existsSync(dir)) return output;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath, output);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      output.push(fullPath);
    }
  }
  return output;
};

const extractTextsFromHtml = (html) => {
  const texts = [];
  const cleaned = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  const textMatches = cleaned.match(/>([^<]+)</g) || [];
  for (const match of textMatches) {
    const raw = match.slice(1, -1);
    const normalized = decodeHtml(raw);
    if (shouldKeepText(normalized)) {
      texts.push(normalized);
    }
  }

  const attrPattern = /\b(?:placeholder|title|aria-label|alt)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let attrMatch;
  while ((attrMatch = attrPattern.exec(cleaned))) {
    const raw = attrMatch[2] || attrMatch[3] || '';
    const normalized = decodeHtml(raw);
    if (shouldKeepText(normalized)) {
      texts.push(normalized);
    }
  }

  return texts;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const readExistingCache = () => {
  const existingPath = outputPaths.find((candidatePath) => fs.existsSync(candidatePath));
  if (!existingPath) {
    return {
      version: TRANSLATION_CACHE_VERSION,
      generatedAt: '',
      sourceLanguage,
      languages: {},
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    return {
      version: TRANSLATION_CACHE_VERSION,
      generatedAt: parsed?.generatedAt || '',
      sourceLanguage: parsed?.sourceLanguage || sourceLanguage,
      languages: parsed?.languages && typeof parsed.languages === 'object' ? parsed.languages : {},
    };
  } catch (error) {
    console.warn(`[translate-cache] Existing cache parse failed, recreating file. ${String(error)}`);
    return {
      version: TRANSLATION_CACHE_VERSION,
      generatedAt: '',
      sourceLanguage,
      languages: {},
    };
  }
};

const writeCache = (cache) => {
  const serialized = JSON.stringify(cache);
  for (const outputPath of outputPaths) {
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, serialized);
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestTranslations = async (texts, targetLang) => {
  const params = new URLSearchParams();
  params.append('targetLang', toDeepLTargetLanguage(targetLang));
  texts.forEach((text) => params.append('text', text));

  let lastError = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${response.statusText}${body ? ` | ${body.slice(0, 200)}` : ''}`);
      }

      const payload = await response.json();
      const translations = Array.isArray(payload?.translations) ? payload.translations : [];
      if (!translations.length) {
        throw new Error('Empty translation payload');
      }

      return texts.map((source, index) => {
        const translated = translations[index];
        return typeof translated === 'string' && translated.trim() ? translated : source;
      });
    } catch (error) {
      lastError = error;
      const backoffMs = attempt * 1500;
      console.warn(
        `[translate-cache] ${targetLang} chunk failed (attempt ${attempt}/${maxAttempts}): ${String(error)}. Retrying in ${backoffMs}ms`,
      );
      if (attempt < maxAttempts) {
        await wait(backoffMs);
      }
    }
  }

  throw lastError || new Error('Unknown translation request failure');
};

const main = async () => {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Dist directory not found: ${distDir}. Run site build first.`);
  }

  if (!endpoint) {
    throw new Error('Translate endpoint is empty. Set TRANSLATE_CACHE_API_URL or PUBLIC_TRANSLATE_API_URL.');
  }

  const htmlFiles = collectHtmlFiles(distDir);
  if (!htmlFiles.length) {
    throw new Error(`No HTML files found in dist directory: ${distDir}`);
  }

  console.log(`[translate-cache] Scanning ${htmlFiles.length} HTML files from ${distDir}`);

  const textSet = new Set();
  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const texts = extractTextsFromHtml(html);
    texts.forEach((text) => textSet.add(text));
  }

  let sourceTexts = Array.from(textSet);
  if (maxTexts > 0 && sourceTexts.length > maxTexts) {
    sourceTexts = sourceTexts.slice(0, maxTexts);
    console.log(`[translate-cache] Unique text entries limited to ${sourceTexts.length} (TRANSLATE_CACHE_MAX_TEXTS=${maxTexts})`);
  } else {
    console.log(`[translate-cache] Unique text entries: ${sourceTexts.length}`);
  }

  const cache = readExistingCache();
  if (!cache.languages || typeof cache.languages !== 'object') {
    cache.languages = {};
  }

  for (const language of targetLanguages) {
    if (language === sourceLanguage) continue;
    if (!cache.languages[language] || typeof cache.languages[language] !== 'object') {
      cache.languages[language] = {};
    }

    const languageMap = cache.languages[language];
    const pending = sourceTexts.filter((text) => typeof languageMap[text] !== 'string');
    if (!pending.length) {
      console.log(`[translate-cache] ${language}: already up-to-date`);
      continue;
    }

    const chunks = chunkArray(pending, chunkSize);
    console.log(`[translate-cache] ${language}: translating ${pending.length} entries in ${chunks.length} chunks`);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const translated = await requestTranslations(chunk, language);
      chunk.forEach((sourceText, itemIndex) => {
        languageMap[sourceText] = translated[itemIndex];
      });

      if ((index + 1) % 5 === 0 || index === chunks.length - 1) {
        cache.generatedAt = new Date().toISOString();
        cache.sourceLanguage = sourceLanguage;
        writeCache(cache);
      }

      console.log(
        `[translate-cache] ${language}: chunk ${index + 1}/${chunks.length} complete`,
      );
    }
  }

  cache.generatedAt = new Date().toISOString();
  cache.sourceLanguage = sourceLanguage;
  cache.version = TRANSLATION_CACHE_VERSION;
  writeCache(cache);
  console.log(`[translate-cache] Done. Cache written to: ${outputPaths.join(', ')}`);
};

main().catch((error) => {
  console.error('[translate-cache] Failed:', error);
  process.exit(1);
});
