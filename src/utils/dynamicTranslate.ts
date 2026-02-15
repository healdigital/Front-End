// Dynamic client-side translation system
// This allows instant page translation without reload

export interface TranslationsData {
  [lang: string]: {
    [key: string]: any;
  };
}

let translationsData: TranslationsData = {};
let currentLanguage: string = 'en';
let translationInProgress = false;

const deeplEndpoint =
  import.meta.env.PUBLIC_TRANSLATE_API_URL ||
  import.meta.env.PUBLIC_PAYLOAD_API_URL ||
  (import.meta.env.DEV ? '/api' : '');

const deeplLanguageMap: Record<string, string> = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  'pt-br': 'PT-BR',
  ar: 'AR',
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

/**
 * Initialize translations - load all translation files
 */
export async function initializeTranslations(): Promise<void> {
  try {
    // Import all translation files
    const languages = ['en', 'fr', 'es', 'pt-br', 'ar'];
    
    for (const lang of languages) {
      try {
        // For Astro, we import the JSON directly
        const translations = await import(`../i18n/${lang}.json`);
        translationsData[lang] = translations.default || translations;
      } catch (error) {
        console.warn(`Failed to load ${lang} translations:`, error);
      }
    }

    // Load saved language preference
    const savedLang = localStorage.getItem('preferred-language');
    if (savedLang && Object.keys(translationsData).includes(savedLang)) {
      currentLanguage = savedLang;
    }

    console.log('✓ Translations initialized for languages:', Object.keys(translationsData).join(', '));
  } catch (error) {
    console.error('Failed to initialize translations:', error);
  }
}

const getDeepLTargetLang = (lang: string): string => {
  return deeplLanguageMap[lang] || lang.toUpperCase();
};

const shouldIgnoreElement = (element: Element | null): boolean => {
  if (!element) return true;
  if (element.closest('[data-no-translate="true"]')) return true;
  const tag = element.tagName;
  if (ignoreTags.has(tag)) return true;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return true;
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

const requestDeepLTranslation = async (texts: string[], targetLang: string): Promise<string[]> => {
  if (!deeplEndpoint) return texts;

  const params = new URLSearchParams();
  params.append('targetLang', targetLang);
  texts.forEach((text) => params.append('text', text));

  const response = await fetch(`${deeplEndpoint}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    console.warn('[translate] DeepL API error:', response.status, response.statusText);
    return texts;
  }

  const data = await response.json();
  const translations = Array.isArray(data?.translations) ? data.translations : [];
  return translations.length ? translations : texts;
};

const translateTextNodes = async (targetLang: string): Promise<void> => {
  if (!deeplEndpoint) return;
  if (translationInProgress) return;
  translationInProgress = true;

  try {
    const root = document.body;
    const nodes = collectTextNodes(root);
    const batchSize = 40;
    const target = getDeepLTargetLang(targetLang);

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
      translations.forEach((translated, idx) => {
        if (typeof translated === 'string') {
          batch[idx].textContent = translated;
        }
      });
    }
  } catch (error) {
    console.error('[translate] Failed to translate page:', error);
  } finally {
    translationInProgress = false;
  }
};

const restoreOriginalText = (): void => {
  const root = document.body;
  const nodes = collectTextNodes(root);
  nodes.forEach((node) => {
    const original = originalTextMap.get(node);
    if (original !== undefined) {
      node.textContent = original;
    }
  });
};

/**
 * Get translation for a key using dot notation
 */
export function getTranslation(key: string, lang?: string): string {
  const targetLang = lang || currentLanguage;
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
  if (!Object.keys(translationsData).includes(newLang)) {
    console.error(`Language ${newLang} not available`);
    return;
  }

  currentLanguage = newLang;
  localStorage.setItem('preferred-language', newLang);
  
  // Update HTML lang attribute
  document.documentElement.lang = newLang;
  document.documentElement.setAttribute('data-lang', newLang);
  document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  
  // Translate page content using DeepL when configured
  if (deeplEndpoint) {
    if (newLang === 'en') {
      restoreOriginalText();
    } else {
      await translateTextNodes(newLang);
    }
  }

  // Update i18n labels/attributes
  translatePageContent();
  
  console.log(`✓ Language changed to: ${newLang}`);
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
  // Listen for language button clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const langEl = target.closest('[data-lang]') as HTMLElement | null;

    if (!langEl) return;
    if (langEl.classList.contains('lang-btn')) {
      if (langEl.tagName === 'A') {
        e.preventDefault();
      }
      const lang = langEl.getAttribute('data-lang');
      if (!lang) return;

      // Just change the language - let the appropriate handler take care of content
      changeLanguage(lang);

      // Update button states
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
    }
  });
}

/**
 * Watch for localStorage changes (from other tabs/windows)
 */
export function watchLanguageChanges(): void {
  window.addEventListener('storage', (e) => {
    if (e.key === 'preferred-language' && e.newValue && e.newValue !== currentLanguage) {
      changeLanguage(e.newValue);
    }
  });
}
