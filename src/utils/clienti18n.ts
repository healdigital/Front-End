// Client-side i18n utility for dynamic translation switching

export interface Translations {
  [key: string]: any;
}

let currentLanguage = 'en';
let translations: Record<string, Translations> = {};

/**
 * Initialize client-side i18n with translations
 */
export async function initI18n(lang: string = 'en'): Promise<void> {
  // Load translations
  const supportedLanguages = ['en', 'fr', 'es', 'pt-br', 'ar'];
  
  for (const lng of supportedLanguages) {
    try {
      const module = await import(`../i18n/${lng}.json`, { assert: { type: 'json' } });
      translations[lng] = module.default;
    } catch (error) {
      console.warn(`Failed to load ${lng} translations:`, error);
    }
  }

  // Set current language from localStorage or parameter
  const savedLang = localStorage.getItem('preferred-language');
  currentLanguage = savedLang || lang || 'en';
}

/**
 * Get translated text
 */
export function t(key: string, lang?: string): string {
  const targetLang = lang || currentLanguage;
  const parts = key.split('.');
  let current: any = translations[targetLang] || translations['en'];

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Fallback to English
      current = translations['en'];
      for (const p of parts) {
        if (current && typeof current === 'object' && p in current) {
          current = current[p];
        } else {
          return key;
        }
      }
      break;
    }
  }

  return typeof current === 'string' ? current : key;
}

/**
 * Set current language and optionally reload page
 */
export function setLanguage(lang: string, reload: boolean = true): void {
  currentLanguage = lang;
  localStorage.setItem('preferred-language', lang);
  
  if (reload) {
    location.reload();
  }
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return currentLanguage;
}

/**
 * Translate element content dynamically
 */
export function translateElement(element: Element): void {
  // Find all elements with data-i18n attribute
  const elementsToTranslate = element.querySelectorAll('[data-i18n]');
  
  elementsToTranslate.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
}

/**
 * Watch for language changes and update page
 */
export function watchLanguageChanges(): void {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-lang') {
        const lang = (mutation.target as HTMLElement).getAttribute('data-lang');
        if (lang && lang !== currentLanguage) {
          currentLanguage = lang;
          localStorage.setItem('preferred-language', lang);
          // Trigger custom event for page updates
          window.dispatchEvent(new CustomEvent('language-changed', { detail: { lang } }));
        }
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-lang'],
  });
}
