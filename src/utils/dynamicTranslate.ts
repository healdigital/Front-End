// Dynamic client-side translation system
// This allows instant page translation without reload

export interface TranslationsData {
  [lang: string]: {
    [key: string]: unknown;
  };
}

declare global {
  interface Window {
    __lcdbPendingLanguage?: string;
    __lcdbChangeLanguage?: (lang: string) => Promise<void>;
  }
}

let translationsData: TranslationsData = {};
let currentLanguage: string = 'fr';
let sourceLanguage: string = 'fr';
let translationInProgress = false;
let deeplUnavailable = false;
let deeplUnavailableLogged = false;
let appliedLanguage: string | null = null;
let languageChangeQueue: Promise<void> = Promise.resolve();
let languageSwitcherBound = false;
let storageWatcherBound = false;
let languageCustomEventBound = false;
let hasTranslatedContent = false;
let deeplFailureCount = 0;
const loadedTranslationLangs = new Set<string>();
const unavailableDeeplEndpoints = new Set<string>();
const deeplTranslationCache = new Map<string, Map<string, string>>();
const ENABLE_RUNTIME_AUTO_TRANSLATION =
  String(import.meta.env.PUBLIC_ENABLE_RUNTIME_AUTO_TRANSLATION || '0') === '1';

const DEEPL_FAILURE_THRESHOLD = 3;
const TRANSLATE_API_CHUNK_SIZE = Math.max(20, Number(import.meta.env.PUBLIC_TRANSLATE_CHUNK_SIZE) || 180);
const TRANSLATE_API_MAX_ENCODED_CHARS = Math.max(5000, Number(import.meta.env.PUBLIC_TRANSLATE_CHUNK_MAX_CHARS) || 45000);

const DEFAULT_TRANSLATE_ENDPOINT = 'https://admin.lacuisinedebernard.com/api';

const rawDeeplEndpoints = [
  import.meta.env.PUBLIC_TRANSLATE_API_URL,
  import.meta.env.PUBLIC_PAYLOAD_API_URL,
  import.meta.env.DEV ? '/api' : '',
  DEFAULT_TRANSLATE_ENDPOINT,
];

const normalizeDeeplEndpoint = (endpoint: string): string => {
  if (!endpoint) return '';
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (typeof window === 'undefined') return trimmed;

  // Prevent mixed-content requests from https pages to http API endpoints.
  if (window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
    console.warn('[translate] PUBLIC_TRANSLATE_API_URL is http on an https page. Trying https upgrade.');
    return `https://${trimmed.slice('http://'.length)}`;
  }

  return trimmed;
};

const deeplEndpoints = Array.from(
  new Set(
    rawDeeplEndpoints
      .map((endpoint) => normalizeDeeplEndpoint(String(endpoint || '')))
      .filter(Boolean),
  ),
);
let activeDeeplEndpointIndex = 0;

const hasDeeplEndpoint = (): boolean =>
  ENABLE_RUNTIME_AUTO_TRANSLATION && deeplEndpoints.length > 0;

const getLanguageCache = (targetLang: string): Map<string, string> => {
  const normalized = String(targetLang || '').trim().toUpperCase();
  let cache = deeplTranslationCache.get(normalized);
  if (!cache) {
    cache = new Map<string, string>();
    deeplTranslationCache.set(normalized, cache);
  }
  return cache;
};

const getEndpointTryOrder = (): string[] => {
  if (!deeplEndpoints.length) return [];
  return deeplEndpoints
    .filter((endpoint) => !unavailableDeeplEndpoints.has(endpoint))
    .slice(activeDeeplEndpointIndex)
    .concat(
      deeplEndpoints
        .filter((endpoint) => !unavailableDeeplEndpoints.has(endpoint))
        .slice(0, activeDeeplEndpointIndex),
    );
};

const getTranslateRequestUrl = (endpoint: string): string => {
  return endpoint.endsWith('/translate')
    ? endpoint
    : `${endpoint}/translate`;
};

interface TranslationChunk {
  uniqueIndexes: number[];
  texts: string[];
}

const estimateEncodedTextLength = (text: string): number => {
  // Account for "text=" + value + "&" in urlencoded payload.
  return encodeURIComponent(text).length + 6;
};

const buildTranslationChunks = (uniqueTexts: string[]): TranslationChunk[] => {
  if (!uniqueTexts.length) return [];

  const chunks: TranslationChunk[] = [];
  let currentTexts: string[] = [];
  let currentIndexes: number[] = [];
  let currentEncodedChars = 0;

  uniqueTexts.forEach((text, uniqueIndex) => {
    const encodedLength = estimateEncodedTextLength(text);
    const exceedBySize = currentTexts.length >= TRANSLATE_API_CHUNK_SIZE;
    const exceedByChars =
      currentTexts.length > 0 &&
      currentEncodedChars + encodedLength > TRANSLATE_API_MAX_ENCODED_CHARS;

    if (exceedBySize || exceedByChars) {
      chunks.push({ texts: currentTexts, uniqueIndexes: currentIndexes });
      currentTexts = [];
      currentIndexes = [];
      currentEncodedChars = 0;
    }

    currentTexts.push(text);
    currentIndexes.push(uniqueIndex);
    currentEncodedChars += encodedLength;
  });

  if (currentTexts.length) {
    chunks.push({ texts: currentTexts, uniqueIndexes: currentIndexes });
  }

  return chunks;
};

const deeplLanguageMap: Record<string, string> = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  'pt-br': 'PT-BR',
  ar: 'AR',
};

const supportedLanguages = ['en', 'fr', 'es', 'pt-br', 'ar'];
const supportedLanguageSet = new Set(supportedLanguages);
const LANGUAGE_STORAGE_KEY = 'preferred-language';

type TranslationStatusState = 'loading' | 'success' | 'warning' | 'error';

const emitTranslationStatus = (
  state: TranslationStatusState,
  detail: { lang?: string; message?: string } = {},
): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('lcdb:translation-status', {
      detail: {
        state,
        ...detail,
      },
    }),
  );
};

const normalizeLanguageCode = (lang: string): string => {
  const raw = String(lang || '').trim().toLowerCase();
  if (raw === 'pt' || raw === 'pt_br' || raw === 'ptbr') return 'pt-br';
  return raw;
};

const isSupportedLanguage = (lang: string): boolean => {
  return supportedLanguageSet.has(normalizeLanguageCode(lang));
};

const loadTranslationData = async (lang: string): Promise<boolean> => {
  const normalizedLang = normalizeLanguageCode(lang);
  if (!supportedLanguageSet.has(normalizedLang)) return false;
  if (loadedTranslationLangs.has(normalizedLang) && translationsData[normalizedLang]) {
    return true;
  }

  try {
    const translations = await import(`../i18n/${normalizedLang}.json`);
    translationsData[normalizedLang] = translations.default || translations;
    loadedTranslationLangs.add(normalizedLang);
    return true;
  } catch (error) {
    console.warn(`Failed to load ${normalizedLang} translations:`, error);
    return false;
  }
};

const resolvePageLanguage = (): string => {
  const raw = normalizeLanguageCode(
    document.documentElement.getAttribute('data-lang') ||
    document.documentElement.lang ||
    'fr'
  );

  if (supportedLanguageSet.has(raw)) return raw;
  return 'fr';
};

const ignoreTags = new Set([
  'SCRIPT',
  'STYLE',
  'CODE',
  'PRE',
  'NOSCRIPT',
  'SVG',
]);

const originalTextMap = new WeakMap<Node, string>();
const originalAttributeMap = new WeakMap<Element, Map<string, string>>();
const translatableAttributes = ['placeholder', 'title', 'aria-label', 'alt'];
let letterRegex: RegExp | null = null;
try {
  // Use constructor so older engines don't fail at parse time.
  letterRegex = new RegExp('\\p{L}', 'u');
} catch {
  letterRegex = null;
}

const hasTranslatableLetters = (value: string): boolean => {
  const text = String(value || '').trim();
  if (!text) return false;
  return letterRegex
    ? letterRegex.test(text)
    : /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF]/.test(text);
};

const markDeepLUnavailable = (reason: string, error?: unknown): void => {
  deeplUnavailable = true;
  deeplFailureCount = DEEPL_FAILURE_THRESHOLD;
  if (deeplUnavailableLogged) return;
  deeplUnavailableLogged = true;

  if (error) {
    console.error(`[translate] DeepL disabled for this session: ${reason}`, error);
  } else {
    console.error(`[translate] DeepL disabled for this session: ${reason}`);
  }
};

const registerDeepLFailure = (reason: string, error?: unknown): void => {
  deeplFailureCount += 1;
  if (error) {
    console.warn(`[translate] DeepL temporary failure (${deeplFailureCount}/${DEEPL_FAILURE_THRESHOLD}): ${reason}`, error);
  } else {
    console.warn(`[translate] DeepL temporary failure (${deeplFailureCount}/${DEEPL_FAILURE_THRESHOLD}): ${reason}`);
  }

  if (deeplFailureCount >= DEEPL_FAILURE_THRESHOLD) {
    markDeepLUnavailable(reason, error);
  }
};

const resetDeepLFailureState = (): void => {
  deeplFailureCount = 0;
};

/**
 * Initialize translations - load all translation files
 */
export async function initializeTranslations(): Promise<void> {
  try {
    sourceLanguage = resolvePageLanguage();
    currentLanguage = sourceLanguage;
    appliedLanguage = null;
    hasTranslatedContent = false;

    const pendingLang = normalizeLanguageCode(String(window.__lcdbPendingLanguage || ''));
    let storedLang = '';
    try {
      storedLang = normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY) || '');
    } catch {
      storedLang = '';
    }

    const preferredLang = isSupportedLanguage(pendingLang)
      ? pendingLang
      : isSupportedLanguage(storedLang)
      ? storedLang
      : sourceLanguage;

    const requiredLanguages = new Set<string>([sourceLanguage]);
    if (preferredLang !== sourceLanguage) {
      requiredLanguages.add(preferredLang);
    }

    for (const lang of requiredLanguages) {
      await loadTranslationData(lang);
    }

    currentLanguage =
      preferredLang &&
      isSupportedLanguage(preferredLang) &&
      Object.keys(translationsData).includes(preferredLang)
        ? preferredLang
        : sourceLanguage;

    if (!Object.keys(translationsData).includes(currentLanguage)) {
      currentLanguage = sourceLanguage;
    }

    // Keep stored preference valid without rewriting on every page load.
    try {
      if (!storedLang || !isSupportedLanguage(storedLang)) {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
      }
    } catch {
      // Ignore storage write failures (private mode / blocked storage).
    }

  } catch (error) {
    console.error('Failed to initialize translations:', error);
  }
}

const getDeepLTargetLang = (lang: string): string => {
  return deeplLanguageMap[lang] || lang.toUpperCase();
};

const shouldIgnoreElement = (element: Element | null): boolean => {
  if (!element) return true;
  const tag = element.tagName;
  if (ignoreTags.has(tag)) return true;
  if (element.closest('[data-no-translate="true"], [translate="no"]')) return true;
  if ((element as HTMLElement).isContentEditable) return true;
  return false;
};

const collectTextNodes = (root: HTMLElement): Text[] => {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.textContent || !node.textContent.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!hasTranslatableLetters(node.textContent)) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (shouldIgnoreElement(parent)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
};

const getOriginalAttributeValue = (element: Element, attr: string, currentValue: string): string => {
  let attrs = originalAttributeMap.get(element);
  if (!attrs) {
    attrs = new Map<string, string>();
    originalAttributeMap.set(element, attrs);
  }
  if (!attrs.has(attr)) {
    attrs.set(attr, currentValue);
  }
  return attrs.get(attr) || currentValue;
};

const collectAttributeTargets = (root: HTMLElement): Array<{ element: Element; attr: string; original: string }> => {
  const targets: Array<{ element: Element; attr: string; original: string }> = [];
  const elements = root.querySelectorAll('[placeholder], [title], [aria-label], [alt]');

  elements.forEach((element) => {
    if (shouldIgnoreElement(element)) return;

    translatableAttributes.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (!value || !value.trim()) return;
      if (!hasTranslatableLetters(value)) return;
      const original = getOriginalAttributeValue(element, attr, value);
      targets.push({ element, attr, original });
    });
  });

  return targets;
};

const requestDeepLTranslation = async (texts: string[], targetLang: string): Promise<string[]> => {
  if (!ENABLE_RUNTIME_AUTO_TRANSLATION) return texts;
  if (!texts.length) return texts;
  const languageCache = getLanguageCache(targetLang);
  const resolved: string[] = new Array(texts.length);
  const uncachedUniqueTexts: string[] = [];
  const uncachedTextToIndex = new Map<string, number>();
  const uncachedIndexMap: number[] = [];

  texts.forEach((text, idx) => {
    const cached = languageCache.get(text);
    if (cached !== undefined) {
      resolved[idx] = cached;
      uncachedIndexMap.push(-1);
      return;
    }

    let uniqueIndex = uncachedTextToIndex.get(text);
    if (uniqueIndex === undefined) {
      uniqueIndex = uncachedUniqueTexts.length;
      uncachedUniqueTexts.push(text);
      uncachedTextToIndex.set(text, uniqueIndex);
    }
    uncachedIndexMap.push(uniqueIndex);
  });

  if (!uncachedUniqueTexts.length) {
    return resolved.map((item, idx) => item ?? texts[idx]);
  }

  if (!hasDeeplEndpoint() || deeplUnavailable) {
    return resolved.map((item, idx) => item ?? texts[idx]);
  }

  let lastNetworkError: unknown = null;
  let lastStatus: { status: number; statusText: string } | null = null;
  const endpointOrder = getEndpointTryOrder();

  if (!endpointOrder.length) {
    markDeepLUnavailable('No healthy translate API endpoints are available.');
    return resolved.map((item, idx) => item ?? texts[idx]);
  }

  const endpoint = endpointOrder[0];
  const requestUrl = getTranslateRequestUrl(endpoint);
  const translatedUniqueTexts: Array<string | undefined> = new Array(uncachedUniqueTexts.length);
  const chunks = buildTranslationChunks(uncachedUniqueTexts);
  let hadChunkSuccess = false;
  let hadChunkFailure = false;

  for (const chunk of chunks) {
    const params = new URLSearchParams();
    params.append('targetLang', targetLang);
    chunk.texts.forEach((text) => params.append('text', text));

    let response: Response | null = null;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: params.toString(),
      });
    } catch (error) {
      hadChunkFailure = true;
      lastNetworkError = error;
      const message = error instanceof Error ? error.message : String(error || '');
      if (
        message.includes('ERR_CERT_AUTHORITY_INVALID') ||
        message.includes('ERR_CERT_COMMON_NAME_INVALID') ||
        message.includes('ERR_SSL') ||
        message.includes('certificate')
      ) {
        unavailableDeeplEndpoints.add(endpoint);
      }
      continue;
    }

    if (!response.ok) {
      hadChunkFailure = true;
      lastStatus = { status: response.status, statusText: response.statusText };
      if (response.status === 404 || response.status === 405) {
        unavailableDeeplEndpoints.add(endpoint);
      }
      continue;
    }

    try {
      const data = (await response.json()) as { translations?: unknown[] } | null;
      const translations = Array.isArray(data?.translations) ? data.translations : [];
      if (translations.length !== chunk.texts.length) {
        hadChunkFailure = true;
        lastStatus = { status: 502, statusText: 'Mismatched translation payload size' };
        continue;
      }

      hadChunkSuccess = true;
      chunk.uniqueIndexes.forEach((uniqueIndex, localIndex) => {
        const source = chunk.texts[localIndex];
        const translated = translations[localIndex];
        if (typeof translated === 'string') {
          translatedUniqueTexts[uniqueIndex] = translated;
          languageCache.set(source, translated);
        } else {
          translatedUniqueTexts[uniqueIndex] = source;
        }
      });
    } catch (error) {
      hadChunkFailure = true;
      lastNetworkError = error;
    }
  }

  if (hadChunkSuccess) {
    const successIndex = deeplEndpoints.indexOf(endpoint);
    if (successIndex >= 0 && successIndex !== activeDeeplEndpointIndex) {
      activeDeeplEndpointIndex = successIndex;
    }
    resetDeepLFailureState();
  }

  if (hadChunkFailure) {
    if (lastStatus && !hadChunkSuccess) {
      if (lastStatus.status === 401 || lastStatus.status === 403 || lastStatus.status === 404) {
        markDeepLUnavailable(
          `Translate API responded with ${lastStatus.status} ${lastStatus.statusText}.`,
        );
      } else {
        registerDeepLFailure(`Translate API responded with ${lastStatus.status} ${lastStatus.statusText}.`);
      }
    } else if (lastNetworkError && !hadChunkSuccess) {
      const message = lastNetworkError instanceof Error
        ? lastNetworkError.message
        : String(lastNetworkError || '');
      if (message.includes('ERR_CERT_AUTHORITY_INVALID')) {
        markDeepLUnavailable(
          'TLS certificate is invalid on translate API endpoint. Use a valid HTTPS cert.',
          lastNetworkError,
        );
      } else {
        registerDeepLFailure('Network error while calling translate API.', lastNetworkError);
      }
    } else if (hadChunkSuccess) {
      registerDeepLFailure('Translate API partially failed for some chunks.');
    }
  }

  return uncachedIndexMap.map((uniqueIndex, originalIndex) => {
    if (uniqueIndex < 0) {
      return resolved[originalIndex] ?? texts[originalIndex];
    }

    const translated = translatedUniqueTexts[uniqueIndex];
    if (typeof translated === 'string') {
      return translated;
    }
    return texts[originalIndex];
  });
};

const translateTextNodes = async (targetLang: string, roots?: HTMLElement[]): Promise<void> => {
  if (!ENABLE_RUNTIME_AUTO_TRANSLATION) return;
  if (!hasDeeplEndpoint() || deeplUnavailable) return;
  if (translationInProgress) return;
  translationInProgress = true;

  try {
    const targetRoots = (Array.isArray(roots) && roots.length ? roots : [document.body])
      .filter((root): root is HTMLElement => root instanceof HTMLElement && root.isConnected);
    if (!targetRoots.length) return;

    const target = getDeepLTargetLang(targetLang);
    const allTextTargets: Array<{ node: Text; original: string }> = [];
    const allAttributeTargets: Array<{ element: Element; attr: string; original: string }> = [];
    const seenNodes = new Set<Text>();
    const seenAttributes = new WeakMap<Element, Set<string>>();
    let anyChanges = false;

    for (const root of targetRoots) {
      const nodes = collectTextNodes(root);
      const rootAttributeTargets = collectAttributeTargets(root);
      for (const node of nodes) {
        if (seenNodes.has(node)) continue;
        seenNodes.add(node);
        const existing = originalTextMap.get(node);
        const original = existing !== undefined ? existing : (node.textContent || '');
        if (existing === undefined) {
          originalTextMap.set(node, original);
        }
        allTextTargets.push({ node, original });
      }

      for (const attrTarget of rootAttributeTargets) {
        let attrs = seenAttributes.get(attrTarget.element);
        if (!attrs) {
          attrs = new Set<string>();
          seenAttributes.set(attrTarget.element, attrs);
        }
        if (attrs.has(attrTarget.attr)) continue;
        attrs.add(attrTarget.attr);
        allAttributeTargets.push(attrTarget);
      }
    }

    if (!allTextTargets.length && !allAttributeTargets.length) return;

    const allTexts = allTextTargets.map((item) => item.original)
      .concat(allAttributeTargets.map((item) => item.original));
    const translations = await requestDeepLTranslation(allTexts, target);
    if (deeplUnavailable) return;

    allTextTargets.forEach((item, index) => {
      const translated = translations[index];
      if (typeof translated === 'string' && item.node.textContent !== translated) {
        item.node.textContent = translated;
        anyChanges = true;
      }
    });

    const attributeOffset = allTextTargets.length;
    allAttributeTargets.forEach((item, index) => {
      const translated = translations[attributeOffset + index];
      if (typeof translated === 'string' && item.element.getAttribute(item.attr) !== translated) {
        item.element.setAttribute(item.attr, translated);
        anyChanges = true;
      }
    });

    if (anyChanges) {
      hasTranslatedContent = true;
    }
  } catch (error) {
    console.error('[translate] Failed to translate page:', error);
  } finally {
    translationInProgress = false;
  }
};

const stopDynamicTranslationObserver = (): void => {
  // Observer-based dynamic polling intentionally disabled.
};

const restoreOriginalText = (): void => {
  if (!hasTranslatedContent) return;

  const root = document.body;
  const nodes = collectTextNodes(root);
  nodes.forEach((node) => {
    const original = originalTextMap.get(node);
    if (original !== undefined) {
      node.textContent = original;
    }
  });

  const elements = root.querySelectorAll('*');
  elements.forEach((element) => {
    const attrs = originalAttributeMap.get(element);
    if (!attrs) return;
    attrs.forEach((value, attr) => {
      element.setAttribute(attr, value);
    });
  });

  hasTranslatedContent = false;
};

/**
 * Get translation for a key using dot notation
 */
export function getTranslation(key: string, lang?: string): string {
  const targetLang = normalizeLanguageCode(lang || currentLanguage);
  const parts = key.split('.');
  
  if (!translationsData[targetLang]) {
    return key;
  }

  let current: unknown = translationsData[targetLang];

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Fallback to English
      if (targetLang !== 'en' && translationsData['en']) {
        current = translationsData['en'];
        for (const p of parts) {
          if (current && typeof current === 'object' && p in current) {
            current = current[p];
          } else {
            return key;
          }
        }
      }
      return key;
    }
  }

  return typeof current === 'string' ? current : key;
}

/**
 * Translate all elements with data-i18n attributes
 */
export function translatePageContent(): void {
  const elementsWithI18n = document.querySelectorAll('[data-i18n]');
  
  elementsWithI18n.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    const type = element.getAttribute('data-i18n-type') || 'text';
    
    if (key) {
      const translation = getTranslation(key);
      
      if (type === 'placeholder') {
        // Handle placeholder attributes
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.placeholder = translation;
        }
      } else {
        // Handle text content
        element.textContent = translation;
      }
    }
  });

  // Trigger custom event for other components to update
  window.dispatchEvent(new CustomEvent('page-translated', { detail: { lang: currentLanguage } }));
}

/**
 * Change language and update entire page
 */
export async function changeLanguage(newLang: string): Promise<void> {
  languageChangeQueue = languageChangeQueue
    .then(async () => {
      const normalizedLang = normalizeLanguageCode(newLang);
      if (!isSupportedLanguage(normalizedLang)) {
        console.error(`Language ${newLang} not available`);
        return;
      }

      if (!Object.keys(translationsData).includes(normalizedLang)) {
        const loaded = await loadTranslationData(normalizedLang);
        if (!loaded) {
          console.error(`Language ${normalizedLang} not available`);
          return;
        }
      }

      if (appliedLanguage === normalizedLang) {
        return;
      }

      const switchingToSourceLanguage = normalizedLang === sourceLanguage;
      emitTranslationStatus('loading', {
        lang: normalizedLang,
        message: switchingToSourceLanguage
          ? 'Retour à la version originale en cours...'
          : 'Traduction de la page en cours...',
      });

      currentLanguage = normalizedLang;
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLang);

      // Update HTML lang attribute
      document.documentElement.lang = normalizedLang;
      document.documentElement.setAttribute('data-lang', normalizedLang);
      document.documentElement.dir = normalizedLang === 'ar' ? 'rtl' : 'ltr';

      // Translate page content using DeepL when configured
      stopDynamicTranslationObserver();
      if (hasDeeplEndpoint()) {
        if (normalizedLang === sourceLanguage) {
          restoreOriginalText();
        } else {
          await translateTextNodes(normalizedLang);
        }
      }

      // Update i18n labels/attributes
      translatePageContent();
      appliedLanguage = normalizedLang;

      if (switchingToSourceLanguage) {
        emitTranslationStatus('success', {
          lang: normalizedLang,
          message: 'Version originale affichée.',
        });
      } else if (!ENABLE_RUNTIME_AUTO_TRANSLATION) {
        emitTranslationStatus('success', {
          lang: normalizedLang,
          message: 'Langue changée. Traduction automatique désactivée.',
        });
      } else if (deeplUnavailable || !hasDeeplEndpoint()) {
        emitTranslationStatus('warning', {
          lang: normalizedLang,
          message: 'Certaines traductions automatiques sont temporairement indisponibles.',
        });
      } else {
        emitTranslationStatus('success', {
          lang: normalizedLang,
          message: 'Traduction terminée.',
        });
      }
    })
    .catch((error) => {
      emitTranslationStatus('error', {
        lang: normalizeLanguageCode(newLang),
        message: 'La traduction a rencontré une erreur. Veuillez réessayer.',
      });
      console.error('[translate] Failed to apply language change:', error);
    });

  await languageChangeQueue;
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return currentLanguage;
}

/**
 * Set up language switcher handlers
 */
export function setupLanguageSwitcher(): void {
  if (languageSwitcherBound) return;
  languageSwitcherBound = true;
  const globalWindow = window;

  const syncLanguageButtonState = (lang: string): void => {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      const btnLang = btn.getAttribute('data-lang');
      if (btnLang === lang) {
        btn.classList.add('active');
        btn.classList.remove('inactive');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.classList.add('inactive');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  };

  // Listen for language button clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const langEl = target.closest('[data-lang]') as HTMLElement | null;

    if (!langEl) return;
    if (langEl.classList.contains('lang-btn')) {
      if (langEl.tagName === 'A') {
        e.preventDefault();
      }
      const lang = normalizeLanguageCode(langEl.getAttribute('data-lang') || '');
      if (!lang || !isSupportedLanguage(lang)) return;

      // Just change the language - let the appropriate handler take care of content
      changeLanguage(lang);
      syncLanguageButtonState(lang);
    }
  });

  if (!languageCustomEventBound) {
    languageCustomEventBound = true;
    window.addEventListener('lcdb:language-select', ((event: Event) => {
      const customEvent = event as CustomEvent<{ lang?: string }>;
      const lang = normalizeLanguageCode(customEvent?.detail?.lang || '');
      if (!lang || !isSupportedLanguage(lang)) return;
      globalWindow.__lcdbPendingLanguage = lang;
      changeLanguage(lang);
      syncLanguageButtonState(lang);
    }) as EventListener);
  }

  window.__lcdbChangeLanguage = async (lang: string) => {
    const normalizedLang = normalizeLanguageCode(lang || '');
    if (normalizedLang) {
      globalWindow.__lcdbPendingLanguage = normalizedLang;
    }

    try {
      await changeLanguage(lang);
      const appliedLang = normalizeLanguageCode(getCurrentLanguage());
      if (appliedLang) {
        syncLanguageButtonState(appliedLang);
      }
    } finally {
      if (globalWindow.__lcdbPendingLanguage === normalizedLang) {
        delete globalWindow.__lcdbPendingLanguage;
      }
    }
  };

  const pendingLang = normalizeLanguageCode(
    String(globalWindow.__lcdbPendingLanguage || ''),
  );
  if (pendingLang && isSupportedLanguage(pendingLang) && pendingLang !== getCurrentLanguage()) {
    changeLanguage(pendingLang);
    syncLanguageButtonState(pendingLang);
  } else {
    syncLanguageButtonState(getCurrentLanguage());
  }
}

/**
 * Watch for localStorage changes (from other tabs/windows)
 */
export function watchLanguageChanges(): void {
  if (storageWatcherBound) return;
  storageWatcherBound = true;

  window.addEventListener('storage', (e) => {
    const nextLang = normalizeLanguageCode(e.newValue || '');
    if (
      e.key === LANGUAGE_STORAGE_KEY &&
      nextLang &&
      isSupportedLanguage(nextLang) &&
      nextLang !== currentLanguage
    ) {
      changeLanguage(nextLang);
    }
  });
}


