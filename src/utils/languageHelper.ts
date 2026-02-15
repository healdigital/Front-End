/**
 * Language Helper - Client-side language utilities
 */

export const SUPPORTED_LANGUAGES = {
  en: { name: '🇺🇸 English', flag: '🇺🇸', code: 'en' },
  fr: { name: '🇫🇷 Français', flag: '🇫🇷', code: 'fr' },
  es: { name: '🇪🇸 Español', flag: '🇪🇸', code: 'es' },
  'pt-br': { name: '🇧🇷 Português', flag: '🇧🇷', code: 'pt-br' },
  ar: { name: '🇸🇦 العربية', flag: '🇸🇦', code: 'ar' },
};

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Get stored language preference from localStorage
 */
export function getStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('preferred-language');
  return (stored as LanguageCode) || 'en';
}

/**
 * Set language preference in localStorage
 */
export function setStoredLanguage(lang: LanguageCode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('preferred-language', lang);
}

/**
 * Format date according to language
 */
export function formatDate(date: Date | string, lang: LanguageCode): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const localeMap: Record<LanguageCode, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
    'pt-br': 'pt-BR',
    ar: 'ar-SA',
  };

  return dateObj.toLocaleDateString(localeMap[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get text direction for language (RTL for Arabic)
 */
export function getTextDirection(lang: LanguageCode): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
