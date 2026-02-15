// i18n utility for multilingual support
import en from './en.json';
import fr from './fr.json';
import es from './es.json';
import ptBr from './pt-br.json';
import ar from './ar.json';

export const translations: Record<string, any> = {
  en,
  fr,
  es,
  'pt-br': ptBr,
  ar,
};

/**
 * Get translated string for a given key and language
 * @param key Dot-notation key (e.g., "recipe.ingredients")
 * @param lang Language code (en, fr, es, pt-br, ar)
 * @returns Translated string or original key if not found
 */
export function t(key: string, lang: string = 'en'): string {
  const parts = key.split('.');
  let current: any = translations[lang] || translations.en;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Fallback to English if translation not found
      current = translations.en;
      for (const p of parts) {
        if (current && typeof current === 'object' && p in current) {
          current = current[p];
        } else {
          return key; // Return key if not found anywhere
        }
      }
      break;
    }
  }

  return typeof current === 'string' ? current : key;
}

/**
 * Get all translations for a language
 * @param lang Language code
 * @returns Translation object
 */
export function getTranslations(lang: string = 'en'): any {
  return translations[lang] || translations.en;
}

/**
 * Check if language is supported
 * @param lang Language code
 * @returns Boolean
 */
export function isLanguageSupported(lang: string): boolean {
  return lang in translations;
}

/**
 * Get list of all supported languages
 * @returns Array of language codes
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(translations);
}

export default { t, getTranslations, isLanguageSupported, getSupportedLanguages };
