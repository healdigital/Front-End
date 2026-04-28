import {
  changeLanguage,
  getCurrentLanguage,
  initializeTranslations,
  setupLanguageSwitcher,
  watchDynamicContentTranslations,
  watchLanguageChanges,
} from '../utils/dynamicTranslate';

const LANGUAGE_STORAGE_KEY = 'preferred-language';
const TRANSLATION_LOADER_MAX_BLOCK_MS = 4500;

declare global {
  interface Window {
    __lcdbPendingLanguage?: string;
  }
}

const getHtmlLanguage = (): string =>
  String(
    document.documentElement.getAttribute('data-lang') ||
      document.documentElement.lang ||
      'fr',
  ).toLowerCase();

const getPendingLanguage = (): string =>
  String(window.__lcdbPendingLanguage || '').toLowerCase();

const showTranslationStatus = (
  translationStatusEl: HTMLElement | null,
  translationStatusTextEl: HTMLElement | null,
  state: 'loading' | 'success' | 'warning' | 'error',
  message: string,
  timeoutRef: { current: number | null },
): void => {
  // Client request: disable on-screen translation toast notifications.
  // Keep event wiring intact, but never render status UI.
  if (!translationStatusEl) return;
  if (timeoutRef.current) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  translationStatusEl.hidden = true;
  translationStatusEl.dataset.state = '';
  if (translationStatusTextEl) translationStatusTextEl.textContent = '';
  void state;
  void message;
};

const clearTranslationLoader = (): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.removeAttribute('data-lcdb-translate-loading');
  root.removeAttribute('aria-busy');
};

const withTranslationLoaderTimeout = async <T>(task: Promise<T>): Promise<T> => {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      clearTranslationLoader();
      reject(new Error('Translation init timed out'));
    }, TRANSLATION_LOADER_MAX_BLOCK_MS);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

async function initTranslations(): Promise<void> {
  try {
    await initializeTranslations();
    setupLanguageSwitcher();
    watchLanguageChanges();
    watchDynamicContentTranslations();

    const currentLang = String(getCurrentLanguage() || '').toLowerCase();
    const htmlLang = getHtmlLanguage();
    const pendingLang = getPendingLanguage();

    if (pendingLang || (currentLang && currentLang !== htmlLang)) {
      await changeLanguage(currentLang);
    }
  } finally {
    clearTranslationLoader();
  }
}

const translationStatusEl = document.querySelector<HTMLElement>('[data-translation-status]');
const translationStatusTextEl = translationStatusEl?.querySelector<HTMLElement>('[data-translation-status-text]') || null;
const translationStatusTimeout = { current: null as number | null };

const startTranslationInit = (): void => {
  withTranslationLoaderTimeout(initTranslations()).catch((error) => {
    console.error('Failed to initialize translations:', error);
    clearTranslationLoader();
  });
};

window.addEventListener('lcdb:translation-status', (event: Event) => {
  const customEvent = event as CustomEvent<{
    state?: 'loading' | 'success' | 'warning' | 'error';
    message?: string;
  }>;
  const state = customEvent.detail?.state;
  const message = customEvent.detail?.message;
  if (!state || !message) return;

  showTranslationStatus(
    translationStatusEl,
    translationStatusTextEl,
    state,
    message,
    translationStatusTimeout,
  );
});

let storedLang = '';
try {
  storedLang = String(localStorage.getItem(LANGUAGE_STORAGE_KEY) || '').toLowerCase();
} catch {
  storedLang = '';
}

const htmlLang = getHtmlLanguage();
const pendingLang = getPendingLanguage();
const needsImmediateTranslationBoot =
  Boolean(pendingLang) || (storedLang && storedLang !== htmlLang);

if (needsImmediateTranslationBoot) {
  startTranslationInit();
} else {
  // Run immediately for consistent language-switch behavior on first interaction.
  startTranslationInit();
}
