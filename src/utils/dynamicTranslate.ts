// Dynamic client-side translation system
// This allows instant page translation without reload

export interface TranslationsData {
  [lang: string]: {
    [key: string]: any;
  };
}

let translationsData: TranslationsData = {};
let currentLanguage: string = 'en';
let sourceLanguage: string = 'en';
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
let dynamicTranslationObserver: MutationObserver | null = null;
let dynamicTranslationTimer: number | null = null;
const loadedTranslationLangs = new Set<string>();
const pendingDynamicRoots = new Set<HTMLElement>();

const DEEPL_FAILURE_THRESHOLD = 3;

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

const hasDeeplEndpoint = (): boolean => deeplEndpoints.length > 0;

const getEndpointTryOrder = (): string[] => {
  if (!deeplEndpoints.length) return [];
  return deeplEndpoints
    .slice(activeDeeplEndpointIndex)
    .concat(deeplEndpoints.slice(0, activeDeeplEndpointIndex));
};

const getTranslateRequestUrl = (endpoint: string): string => {
  return endpoint.endsWith('/translate')
    ? endpoint
    : `${endpoint}/translate`;
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
    'en'
  );

  if (supportedLanguageSet.has(raw)) return raw;
  return 'en';
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
  if (deeplFailureCount >= DEEPL_FAILURE_THRESHOLD) {
    markDeepLUnavailable(`${reason} (${deeplFailureCount} consecutive failures)`, error);
    return;
  }

  if (error) {
    console.warn(`[translate] DeepL temporary failure (${deeplFailureCount}/${DEEPL_FAILURE_THRESHOLD}): ${reason}`, error);
  } else {
    console.warn(`[translate] DeepL temporary failure (${deeplFailureCount}/${DEEPL_FAILURE_THRESHOLD}): ${reason}`);
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

    // Load saved language preference
    const savedLang = normalizeLanguageCode(localStorage.getItem('preferred-language') || '');
    const requiredLanguages = new Set<string>(['en', sourceLanguage]);
    if (isSupportedLanguage(savedLang)) {
      requiredLanguages.add(savedLang);
    }

    for (const lang of requiredLanguages) {
      await loadTranslationData(lang);
    }

    if (
      savedLang &&
      isSupportedLanguage(savedLang) &&
      Object.keys(translationsData).includes(savedLang) &&
      savedLang !== sourceLanguage
    ) {
      currentLanguage = savedLang;
    } else {
      currentLanguage = 'en';
    }

    if (!Object.keys(translationsData).includes(currentLanguage)) {
      currentLanguage = sourceLanguage;
    }

    console.log('Translations initialized for languages:', Object.keys(translationsData).join(', '));
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
      const original = getOriginalAttributeValue(element, attr, value);
      targets.push({ element, attr, original });
    });
  });

  return targets;
};

const requestDeepLTranslation = async (texts: string[], targetLang: string): Promise<string[]> => {
  if (!hasDeeplEndpoint() || deeplUnavailable) return texts;
  if (!texts.length) return texts;

  // Reduce API payload when batches contain repeated labels.
  const uniqueTexts: string[] = [];
  const textToIndex = new Map<string, number>();
  const indexMap: number[] = [];
  texts.forEach((text) => {
    const existing = textToIndex.get(text);
    if (existing !== undefined) {
      indexMap.push(existing);
      return;
    }
    const nextIndex = uniqueTexts.length;
    uniqueTexts.push(text);
    textToIndex.set(text, nextIndex);
    indexMap.push(nextIndex);
  });

  const params = new URLSearchParams();
  params.append('targetLang', targetLang);
  uniqueTexts.forEach((text) => params.append('text', text));

  const requestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params.toString(),
  };

  let lastNetworkError: unknown = null;
  let lastStatus: { status: number; statusText: string } | null = null;

  for (const endpoint of getEndpointTryOrder()) {
    const requestUrl = getTranslateRequestUrl(endpoint);
    let response: Response;

    try {
      response = await fetch(requestUrl, requestInit);
    } catch (error) {
      lastNetworkError = error;
      continue;
    }

    if (!response.ok) {
      lastStatus = { status: response.status, statusText: response.statusText };
      continue;
    }

    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      lastNetworkError = error;
      continue;
    }

    const translations = Array.isArray(data?.translations) ? data.translations : [];
    if (!translations.length) {
      lastStatus = { status: 502, statusText: 'Empty translation payload' };
      continue;
    }

    const successIndex = deeplEndpoints.indexOf(endpoint);
    if (successIndex >= 0 && successIndex !== activeDeeplEndpointIndex) {
      activeDeeplEndpointIndex = successIndex;
      console.info(`[translate] Switched to fallback endpoint: ${endpoint}`);
    }

    resetDeepLFailureState();
    return indexMap.map((index, originalIndex) => {
      const translated = translations[index];
      return typeof translated === 'string' ? translated : texts[originalIndex];
    });
  }

  if (lastStatus) {
    if (lastStatus.status === 401 || lastStatus.status === 403 || lastStatus.status === 404) {
      markDeepLUnavailable(
        `Translate API responded with ${lastStatus.status} ${lastStatus.statusText}.`,
      );
    } else {
      registerDeepLFailure(`Translate API responded with ${lastStatus.status} ${lastStatus.statusText}.`);
    }
    return texts;
  }

  if (lastNetworkError) {
    const message = String((lastNetworkError as any)?.message || lastNetworkError || '');
    if (message.includes('ERR_CERT_AUTHORITY_INVALID')) {
      markDeepLUnavailable(
        'TLS certificate is invalid on translate API endpoint. Use a valid HTTPS cert.',
        lastNetworkError,
      );
    } else {
      registerDeepLFailure('Network error while calling translate API.', lastNetworkError);
    }
    return texts;
  }

  registerDeepLFailure('Translate API failed for all configured endpoints.');
  return texts;
};

const translateTextNodes = async (targetLang: string, roots?: HTMLElement[]): Promise<void> => {
  if (!hasDeeplEndpoint() || deeplUnavailable) return;
  if (translationInProgress) return;
  translationInProgress = true;

  try {
    const targetRoots = (Array.isArray(roots) && roots.length ? roots : [document.body])
      .filter((root): root is HTMLElement => root instanceof HTMLElement && root.isConnected);
    if (!targetRoots.length) return;

    const batchSize = 120;
    const target = getDeepLTargetLang(targetLang);
    let anyChanges = false;

    for (const root of targetRoots) {
      const nodes = collectTextNodes(root);
      const attributeTargets = collectAttributeTargets(root);

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const texts = batch.map((node) => {
          const existing = originalTextMap.get(node);
          if (existing !== undefined) return existing;
          const original = node.textContent || '';
          originalTextMap.set(node, original);
          return original;
        });

        const translations = await requestDeepLTranslation(texts, target);
        if (deeplUnavailable) break;
        translations.forEach((translated, idx) => {
          if (
            typeof translated === 'string' &&
            batch[idx].textContent !== translated
          ) {
            batch[idx].textContent = translated;
            anyChanges = true;
          }
        });
      }

      if (deeplUnavailable) break;

      for (let i = 0; i < attributeTargets.length; i += batchSize) {
        const batch = attributeTargets.slice(i, i + batchSize);
        const texts = batch.map((item) => item.original);
        const translations = await requestDeepLTranslation(texts, target);
        if (deeplUnavailable) break;

        translations.forEach((translated, idx) => {
          if (
            typeof translated === 'string' &&
            batch[idx].element.getAttribute(batch[idx].attr) !== translated
          ) {
            batch[idx].element.setAttribute(batch[idx].attr, translated);
            anyChanges = true;
          }
        });
      }
    }

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
  if (dynamicTranslationObserver) {
    dynamicTranslationObserver.disconnect();
    dynamicTranslationObserver = null;
  }
  pendingDynamicRoots.clear();
  if (dynamicTranslationTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(dynamicTranslationTimer);
    dynamicTranslationTimer = null;
  }
};

const flushDynamicTranslation = async (): Promise<void> => {
  if (!pendingDynamicRoots.size) return;
  if (!hasDeeplEndpoint() || deeplUnavailable) return;
  if (currentLanguage === sourceLanguage) return;

  const roots = Array.from(pendingDynamicRoots).filter((root) => root.isConnected);
  pendingDynamicRoots.clear();
  if (!roots.length) return;

  await translateTextNodes(currentLanguage, roots);
};

const queueDynamicTranslation = (root: HTMLElement): void => {
  pendingDynamicRoots.add(root);
  if (dynamicTranslationTimer !== null || typeof window === 'undefined') return;

  dynamicTranslationTimer = window.setTimeout(() => {
    dynamicTranslationTimer = null;
    flushDynamicTranslation().catch((error) => {
      console.error('[translate] Failed to translate dynamic content:', error);
    });
  }, 250);
};

const startDynamicTranslationObserver = (): void => {
  if (typeof window === 'undefined') return;
  if (!document.body || !hasDeeplEndpoint() || deeplUnavailable) return;
  if (dynamicTranslationObserver) return;

  dynamicTranslationObserver = new MutationObserver((mutations) => {
    if (currentLanguage === sourceLanguage) return;
    if (!hasDeeplEndpoint() || deeplUnavailable) return;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (shouldIgnoreElement(element)) return;
          queueDynamicTranslation(element);
          return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (!parent || shouldIgnoreElement(parent)) return;
          queueDynamicTranslation(parent as HTMLElement);
        }
      });
    });
  });

  dynamicTranslationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
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

  let current: any = translationsData[targetLang];

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

      currentLanguage = normalizedLang;
      localStorage.setItem('preferred-language', normalizedLang);

      // Update HTML lang attribute
      document.documentElement.lang = normalizedLang;
      document.documentElement.setAttribute('data-lang', normalizedLang);
      document.documentElement.dir = normalizedLang === 'ar' ? 'rtl' : 'ltr';

      // Translate page content using DeepL when configured
      if (hasDeeplEndpoint()) {
        if (normalizedLang === sourceLanguage) {
          stopDynamicTranslationObserver();
          restoreOriginalText();
        } else {
          await translateTextNodes(normalizedLang);
          if (!deeplUnavailable) {
            startDynamicTranslationObserver();
          } else {
            stopDynamicTranslationObserver();
          }
        }
      } else {
        stopDynamicTranslationObserver();
      }

      // Update i18n labels/attributes
      translatePageContent();
      appliedLanguage = normalizedLang;

      console.log(`Language changed to: ${normalizedLang}`);
    })
    .catch((error) => {
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
  const globalWindow = window as any;

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

  (window as any).__lcdbChangeLanguage = async (lang: string) => {
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
    String(globalWindow.__lcdbPendingLanguage || localStorage.getItem('preferred-language') || ''),
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
      e.key === 'preferred-language' &&
      nextLang &&
      isSupportedLanguage(nextLang) &&
      nextLang !== currentLanguage
    ) {
      changeLanguage(nextLang);
    }
  });
}
