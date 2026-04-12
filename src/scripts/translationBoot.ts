import {
  changeLanguage,
  getCurrentLanguage,
  initializeTranslations,
  setupLanguageSwitcher,
  watchLanguageChanges,
} from '../utils/dynamicTranslate';

const LANGUAGE_STORAGE_KEY = 'preferred-language';

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
  if (!translationStatusEl || !translationStatusTextEl || !message) return;
  if (timeoutRef.current) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  translationStatusEl.hidden = false;
  translationStatusEl.dataset.state = state;
  translationStatusTextEl.textContent = message;

  if (state !== 'loading') {
    timeoutRef.current = window.setTimeout(() => {
      translationStatusEl.hidden = true;
    }, state === 'error' ? 5200 : 3200);
  }
};

async function initTranslations(): Promise<void> {
  await initializeTranslations();
  setupLanguageSwitcher();
  watchLanguageChanges();

  const currentLang = String(getCurrentLanguage() || '').toLowerCase();
  const htmlLang = getHtmlLanguage();
  const pendingLang = getPendingLanguage();

  if (pendingLang || (currentLang && currentLang !== htmlLang)) {
    await changeLanguage(currentLang);
  }
}

const translationStatusEl = document.querySelector<HTMLElement>('[data-translation-status]');
const translationStatusTextEl = translationStatusEl?.querySelector<HTMLElement>('[data-translation-status-text]') || null;
const translationStatusTimeout = { current: null as number | null };

const startTranslationInit = (): void => {
  initTranslations().catch((error) => {
    console.error('Failed to initialize translations:', error);
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
